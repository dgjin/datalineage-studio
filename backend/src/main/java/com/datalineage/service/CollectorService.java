package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.datalineage.collector.JdbcSchemaCollector;
import com.datalineage.entity.CollectorRunLogEntity;
import com.datalineage.entity.MetadataCollectTaskEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.CollectorRunLogMapper;
import com.datalineage.mapper.MetadataCollectTaskMapper;
import com.datalineage.metrics.GovernanceMetrics;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Metadata collection task management service.
 * Handles task CRUD, manual trigger, scheduled execution and run logs.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CollectorService {

    private final MetadataCollectTaskMapper taskMapper;
    private final CollectorRunLogMapper runLogMapper;
    private final JdbcSchemaCollector jdbcSchemaCollector;
    private final ThreadPoolTaskExecutor collectTaskExecutor;
    private final GovernanceMetrics governanceMetrics;
    private final StandardService standardService;

    /** Collection attempts per run before the run is declared FAILED. */
    private static final int MAX_COLLECT_ATTEMPTS = 3;
    /** Exponential-backoff delays between attempts (attempt 1 -> 2s, attempt 2 -> 8s). */
    private static final long[] RETRY_BACKOFF_MS = {2_000L, 8_000L};

    private ThreadPoolTaskScheduler scheduler;
    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    /** Live progress of in-flight runs, keyed by task id (removed when a run ends). */
    private final Map<String, LiveProgress> liveProgress = new ConcurrentHashMap<>();
    /** Atomic per-task lock so overlapping triggers cannot start two runs at once. */
    private final Set<String> runningTasks = ConcurrentHashMap.newKeySet();

    @PostConstruct
    public void initScheduler() {
        scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("collect-scheduler-");
        scheduler.initialize();
        // A previous process may have died while a run was in flight; mark those
        // stale RUNNING rows as failed so the UI never shows a zombie run.
        cleanupStaleRuns();
        // Restore scheduled tasks from database
        for (MetadataCollectTaskEntity task : taskMapper.selectList(null)) {
            if (task.getScheduleCron() != null && !task.getScheduleCron().isEmpty()) {
                scheduleTask(task);
            }
        }
    }

    private void cleanupStaleRuns() {
        try {
            UpdateWrapper<CollectorRunLogEntity> logWrapper = new UpdateWrapper<>();
            logWrapper.eq("status", "RUNNING");
            CollectorRunLogEntity logPatch = new CollectorRunLogEntity();
            logPatch.setStatus("FAILED");
            logPatch.setEndTime(LocalDateTime.now());
            logPatch.setErrors(List.of(Map.of("message", "服务重启中断了运行中的采集 (interrupted by restart)")));
            runLogMapper.update(logPatch, logWrapper);

            UpdateWrapper<MetadataCollectTaskEntity> taskWrapper = new UpdateWrapper<>();
            taskWrapper.eq("status", "RUNNING");
            MetadataCollectTaskEntity taskPatch = new MetadataCollectTaskEntity();
            taskPatch.setStatus("PENDING");
            taskPatch.setLastErrorMsg("服务重启中断了运行中的采集");
            taskMapper.update(taskPatch, taskWrapper);
        } catch (Exception e) {
            log.warn("Stale RUNNING cleanup failed: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void shutdownScheduler() {
        if (scheduler != null) {
            scheduler.shutdown();
        }
    }

    public List<MetadataCollectTaskEntity> listTasks(String dataSourceId, String status) {
        QueryWrapper<MetadataCollectTaskEntity> wrapper = new QueryWrapper<>();
        if (dataSourceId != null && !dataSourceId.isEmpty()) {
            wrapper.eq("data_source_id", dataSourceId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("created_at");
        return taskMapper.selectList(wrapper);
    }

    public MetadataCollectTaskEntity getTask(String id) {
        MetadataCollectTaskEntity task = taskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("Collect task not found: " + id);
        }
        return task;
    }

    @Transactional
    public MetadataCollectTaskEntity createTask(MetadataCollectTaskEntity task) {
        task.setStatus("PENDING");
        taskMapper.insert(task);
        if (task.getScheduleCron() != null && !task.getScheduleCron().isEmpty()) {
            scheduleTask(task);
        }
        return task;
    }

    @Transactional
    public MetadataCollectTaskEntity updateTask(String id, MetadataCollectTaskEntity task) {
        MetadataCollectTaskEntity existing = getTask(id);
        task.setId(id);
        taskMapper.updateById(task);
        // Reschedule if cron changed
        cancelSchedule(id);
        MetadataCollectTaskEntity updated = taskMapper.selectById(id);
        if (updated.getScheduleCron() != null && !updated.getScheduleCron().isEmpty()) {
            scheduleTask(updated);
        }
        return updated;
    }

    @Transactional
    public void deleteTask(String id) {
        getTask(id);
        cancelSchedule(id);
        taskMapper.deleteById(id);
    }

    /**
     * Trigger a collection run. The run is submitted to the collect-task executor
     * and this method returns immediately; callers poll {@link #getRunStatus} for
     * progress and the final outcome.
     */
    public Map<String, Object> runTask(String id) {
        return triggerRun(id, "MANUAL");
    }

    private Map<String, Object> triggerRun(String id, String runType) {
        MetadataCollectTaskEntity task = getTask(id);
        // Atomic per-task lock: concurrent triggers race on runningTasks.add and
        // exactly one wins; the DB status check additionally guards against stale
        // RUNNING rows (crash leftovers) and runs owned by another instance.
        if ("RUNNING".equals(task.getStatus()) || !runningTasks.add(id)) {
            throw new BusinessException("采集任务正在运行中，请等待本次运行结束后再触发: " + id);
        }

        CollectorRunLogEntity runLog = new CollectorRunLogEntity();
        try {
            runLog.setTaskId(id);
            runLog.setDataSourceId(task.getDataSourceId());
            runLog.setRunType(runType);
            runLog.setStatus("RUNNING");
            runLog.setStartTime(LocalDateTime.now());
            runLogMapper.insert(runLog);

            task.setStatus("RUNNING");
            taskMapper.updateById(task);

            LiveProgress progress = new LiveProgress();
            progress.setRunLogId(runLog.getId());
            progress.setPercent(0);
            progress.setPhase("任务已提交，等待执行");
            progress.setStartedAt(runLog.getStartTime());
            liveProgress.put(id, progress);

            collectTaskExecutor.execute(() -> executeRun(id, runLog));
        } catch (Exception e) {
            // release the lock if submission failed before the run was scheduled
            runningTasks.remove(id);
            liveProgress.remove(id);
            throw e;
        }

        Map<String, Object> response = new HashMap<>();
        response.put("accepted", true);
        response.put("runLogId", runLog.getId());
        response.put("status", "RUNNING");
        response.put("message", "采集任务已异步启动，可轮询 run-status 获取进度");
        return response;
    }

    /**
     * Actual collection execution, running on the collect-task executor.
     * No @Transactional here: a run performs many small writes over tens of seconds,
     * each managed by the collector itself; a single wrapping transaction would hold
     * locks for the whole run and hide intermediate state from the polling endpoint.
     */
    private void executeRun(String taskId, CollectorRunLogEntity runLog) {
        MetadataCollectTaskEntity task = taskMapper.selectById(taskId);
        if (task == null) {
            liveProgress.remove(taskId);
            log.warn("Collect task {} vanished before execution", taskId);
            return;
        }
        int attempts = 0;
        try {
            // Exponential-backoff retry: transient failures (network blips, source briefly
            // unavailable) are retried up to MAX_COLLECT_ATTEMPTS before the run is marked
            // FAILED. The collector is idempotent (assets upserted by code), so repeating
            // a partially applied attempt is safe.
            JdbcSchemaCollector.CollectResult result = null;
            for (int attempt = 1; attempt <= MAX_COLLECT_ATTEMPTS; attempt++) {
                attempts = attempt;
                result = jdbcSchemaCollector.collect(task, (percent, phase) -> {
                    LiveProgress p = liveProgress.get(taskId);
                    if (p != null) {
                        p.setPercent(percent);
                        p.setPhase(phase);
                    }
                });
                if (result.isSuccess()) {
                    break;
                }
                if (attempt < MAX_COLLECT_ATTEMPTS) {
                    log.warn("Collection attempt {}/{} failed for task {}: {} — retrying in {}ms",
                            attempt, MAX_COLLECT_ATTEMPTS, taskId, result.getErrorMessage(),
                            RETRY_BACKOFF_MS[attempt - 1]);
                    LiveProgress p = liveProgress.get(taskId);
                    if (p != null) {
                        p.setPhase("第 " + attempt + " 次尝试失败，退避 "
                                + (RETRY_BACKOFF_MS[attempt - 1] / 1000) + "s 后重试");
                    }
                    Thread.sleep(RETRY_BACKOFF_MS[attempt - 1]);
                }
            }

            LocalDateTime endTime = LocalDateTime.now();
            runLog.setEndTime(endTime);
            runLog.setDurationMs(Duration.between(runLog.getStartTime(), endTime).toMillis());
            runLog.setTablesScanned(result.getTablesFound());
            runLog.setColumnsScanned(result.getColumnsFound());
            runLog.setAssetsCreated(result.getAssetsCreated());
            runLog.setAssetsUpdated(result.getAssetsUpdated());
            runLog.setEdgesDiscovered(result.getEdgesDiscovered());
            runLog.setStatus(result.isSuccess() ? "SUCCESS" : "FAILED");
            if (!result.isSuccess()) {
                runLog.setErrors(List.of(Map.of("message",
                        result.getErrorMessage() == null ? "Unknown error" : result.getErrorMessage())));
            }
            runLog.setDetail(buildRunDetail(attempts, result.isSuccess(),
                    result.getEdgesAdded(), result.getEdgesRevived(), result.getEdgesRetired()));
            runLog.setLogText(buildRunSummary(result));
            runLogMapper.updateById(runLog);

            task.setStatus(result.isSuccess() ? "SUCCESS" : "FAILED");
            task.setLastRunAt(runLog.getStartTime());
            task.setLastRunDuration(runLog.getDurationMs());
            task.setLastRunResult(result.isSuccess() ? "SUCCESS" : "FAILED");
            task.setLastErrorMsg(result.isSuccess() ? null : result.getErrorMessage());
            task.setTotalTablesFound(result.getTablesFound());
            task.setTotalColumnsFound(result.getColumnsFound());
            task.setNewAssetsRegistered(result.getAssetsCreated());
            taskMapper.updateById(task);
            governanceMetrics.recordCollectorRun(result.isSuccess(), runLog.getDurationMs(),
                    result.getEdgesDiscovered());

            // Auto-enforce published naming standards after a successful collection
            // (evaluation report gap: no automatic standard enforcement). Failures here
            // never affect the collection outcome.
            if (result.isSuccess() && attempts > 0) {
                try {
                    Map<String, Object> namingReport = standardService.executeNamingCheck();
                    log.info("Post-collection naming enforcement: checked={}, violations={}",
                            namingReport.get("checked"), namingReport.get("violationAssets"));
                } catch (Exception e) {
                    log.warn("Post-collection naming enforcement failed: {}", e.getMessage());
                }
            }

            log.info("Collection run {} for task {} finished: success={}, attempts={}, tables={}, columns={}",
                    runLog.getId(), taskId, result.isSuccess(), attempts,
                    result.getTablesFound(), result.getColumnsFound());
        } catch (Exception e) {
            log.error("Collection run failed for task: {}", taskId, e);
            runLog.setEndTime(LocalDateTime.now());
            runLog.setDurationMs(Duration.between(runLog.getStartTime(), runLog.getEndTime()).toMillis());
            runLog.setStatus("FAILED");
            runLog.setErrors(List.of(Map.of("message", String.valueOf(e.getMessage()))));
            runLog.setDetail(buildRunDetail(attempts, false, 0, 0, 0));
            runLogMapper.updateById(runLog);

            task.setStatus("FAILED");
            task.setLastRunAt(runLog.getStartTime());
            task.setLastErrorMsg(e.getMessage());
            taskMapper.updateById(task);
            governanceMetrics.recordCollectorRun(false, runLog.getDurationMs(), 0);
        } finally {
            liveProgress.remove(taskId);
            runningTasks.remove(taskId);
        }
    }

    /**
     * Poll payload: live progress while running, otherwise the outcome of the most
     * recent run so the UI can render the final state after polling stops.
     */
    public Map<String, Object> getRunStatus(String id) {
        MetadataCollectTaskEntity task = getTask(id);
        LiveProgress progress = liveProgress.get(id);
        boolean running = progress != null;

        List<CollectorRunLogEntity> logs = runLogMapper.findByTaskId(id, 1);
        CollectorRunLogEntity lastRun = logs.isEmpty() ? null : logs.get(0);

        Map<String, Object> status = new HashMap<>();
        status.put("taskId", id);
        status.put("taskName", task.getTaskName());
        status.put("dataSourceId", task.getDataSourceId());
        status.put("status", task.getStatus());
        status.put("running", running);
        if (running) {
            status.put("percent", progress.getPercent());
            status.put("phase", progress.getPhase());
            status.put("elapsedMs", Duration.between(progress.getStartedAt(), LocalDateTime.now()).toMillis());
            status.put("runLogId", progress.getRunLogId());
        } else if (lastRun != null && "SUCCESS".equals(lastRun.getStatus())) {
            status.put("percent", 100);
            status.put("phase", "采集完成");
            status.put("elapsedMs", lastRun.getDurationMs());
            status.put("runLogId", lastRun.getId());
        } else {
            status.put("percent", 0);
            status.put("phase", lastRun == null ? "尚未执行" : "采集失败");
            status.put("elapsedMs", lastRun == null ? 0L : lastRun.getDurationMs());
            status.put("runLogId", lastRun == null ? null : lastRun.getId());
        }

        if (lastRun != null) {
            Map<String, Object> lr = new HashMap<>();
            lr.put("id", lastRun.getId());
            lr.put("status", lastRun.getStatus());
            lr.put("startTime", lastRun.getStartTime());
            lr.put("durationMs", lastRun.getDurationMs());
            lr.put("tablesScanned", lastRun.getTablesScanned());
            lr.put("columnsScanned", lastRun.getColumnsScanned());
            lr.put("assetsCreated", lastRun.getAssetsCreated());
            lr.put("assetsUpdated", lastRun.getAssetsUpdated());
            lr.put("edgesDiscovered", lastRun.getEdgesDiscovered());
            status.put("lastRun", lr);
        }
        status.put("totalTablesFound", task.getTotalTablesFound());
        status.put("totalColumnsFound", task.getTotalColumnsFound());
        status.put("newAssetsRegistered", task.getNewAssetsRegistered());
        status.put("lastRunAt", task.getLastRunAt());
        status.put("lastErrorMsg", task.getLastErrorMsg());
        return status;
    }

    public MetadataCollectTaskEntity pauseTask(String id) {
        MetadataCollectTaskEntity task = getTask(id);
        if (runningTasks.contains(id) || "RUNNING".equals(task.getStatus())) {
            throw new BusinessException("采集任务运行中，无法暂停: " + id);
        }
        cancelSchedule(id);
        task.setStatus("PAUSED");
        taskMapper.updateById(task);
        return task;
    }

    public MetadataCollectTaskEntity resumeTask(String id) {
        MetadataCollectTaskEntity task = getTask(id);
        if (task.getScheduleCron() == null || task.getScheduleCron().isEmpty()) {
            throw new BusinessException("Task has no schedule cron, cannot resume: " + id);
        }
        scheduleTask(task);
        task.setStatus("PENDING");
        taskMapper.updateById(task);
        return task;
    }

    public List<CollectorRunLogEntity> getTaskLogs(String taskId, int limit) {
        return runLogMapper.findByTaskId(taskId, limit);
    }

    public List<CollectorRunLogEntity> getDataSourceLogs(String dataSourceId, int limit) {
        return runLogMapper.findByDataSourceId(dataSourceId, limit);
    }

    private void scheduleTask(MetadataCollectTaskEntity task) {
        cancelSchedule(task.getId());
        try {
            ScheduledFuture<?> future = scheduler.schedule(() -> {
                try {
                    log.info("Scheduled collection triggered for task: {}", task.getId());
                    triggerRun(task.getId(), "SCHEDULED");
                } catch (Exception e) {
                    log.error("Scheduled collection failed for task: {}", task.getId(), e);
                }
            }, new CronTrigger(task.getScheduleCron()));

            if (future != null) {
                scheduledTasks.put(task.getId(), future);
                log.info("Scheduled task {} with cron: {}", task.getId(), task.getScheduleCron());
            }
        } catch (Exception e) {
            log.warn("Invalid cron expression for task {}: {}", task.getId(), task.getScheduleCron());
        }
    }

    private void cancelSchedule(String taskId) {
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
    }

    /** Mutable progress snapshot for an in-flight run, read by the polling endpoint. */
    @lombok.Data
    private static class LiveProgress {
        private Long runLogId;
        private int percent;
        private String phase;
        private LocalDateTime startedAt;
    }

    private String buildRunSummary(JdbcSchemaCollector.CollectResult result) {
        return String.format("Schemas scanned: %d, Tables found: %d, Assets created: %d, Assets updated: %d",
                result.getSchemasScanned(), result.getTablesFound(),
                result.getAssetsCreated(), result.getAssetsUpdated());
    }

    /** Structured run detail persisted to collector_run_logs.detail (JSON). */
    private Map<String, Object> buildRunDetail(int attempts, boolean success,
                                               int edgesAdded, int edgesRevived, int edgesRetired) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("attempts", attempts);
        detail.put("maxAttempts", MAX_COLLECT_ATTEMPTS);
        detail.put("success", success);
        detail.put("edgesAdded", edgesAdded);
        detail.put("edgesRevived", edgesRevived);
        detail.put("edgesRetired", edgesRetired);
        return detail;
    }
}
