package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.collector.JdbcSchemaCollector;
import com.datalineage.entity.CollectorRunLogEntity;
import com.datalineage.entity.MetadataCollectTaskEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.CollectorRunLogMapper;
import com.datalineage.mapper.MetadataCollectTaskMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    private ThreadPoolTaskScheduler scheduler;
    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    @PostConstruct
    public void initScheduler() {
        scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("collect-scheduler-");
        scheduler.initialize();
        // Restore scheduled tasks from database
        for (MetadataCollectTaskEntity task : taskMapper.selectList(null)) {
            if (task.getScheduleCron() != null && !task.getScheduleCron().isEmpty()) {
                scheduleTask(task);
            }
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
     * Manually trigger a collection run (synchronous execution).
     */
    @Transactional
    public Map<String, Object> runTask(String id) {
        MetadataCollectTaskEntity task = getTask(id);

        CollectorRunLogEntity runLog = new CollectorRunLogEntity();
        runLog.setTaskId(id);
        runLog.setDataSourceId(task.getDataSourceId());
        runLog.setRunType("MANUAL");
        runLog.setStatus("RUNNING");
        runLog.setStartTime(LocalDateTime.now());
        runLogMapper.insert(runLog);

        task.setStatus("RUNNING");
        taskMapper.updateById(task);

        try {
            JdbcSchemaCollector.CollectResult result = jdbcSchemaCollector.collect(task);

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

            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("runLogId", runLog.getId());
            response.put("tablesFound", result.getTablesFound());
            response.put("columnsFound", result.getColumnsFound());
            response.put("assetsCreated", result.getAssetsCreated());
            response.put("assetsUpdated", result.getAssetsUpdated());
            response.put("edgesDiscovered", result.getEdgesDiscovered());
            response.put("changesDetected", result.getChangesDetected());
            response.put("durationMs", runLog.getDurationMs());
            if (!result.isSuccess()) {
                response.put("error", result.getErrorMessage());
            }
            return response;
        } catch (Exception e) {
            log.error("Manual run failed for task: {}", id, e);
            runLog.setEndTime(LocalDateTime.now());
            runLog.setDurationMs(Duration.between(runLog.getStartTime(), runLog.getEndTime()).toMillis());
            runLog.setStatus("FAILED");
            runLog.setErrors(List.of(Map.of("message", String.valueOf(e.getMessage()))));
            runLogMapper.updateById(runLog);

            task.setStatus("FAILED");
            task.setLastRunAt(runLog.getStartTime());
            task.setLastErrorMsg(e.getMessage());
            taskMapper.updateById(task);
            throw new BusinessException("Collection run failed: " + e.getMessage());
        }
    }

    public MetadataCollectTaskEntity pauseTask(String id) {
        MetadataCollectTaskEntity task = getTask(id);
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
                    runTask(task.getId());
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

    private String buildRunSummary(JdbcSchemaCollector.CollectResult result) {
        return String.format("Schemas scanned: %d, Tables found: %d, Assets created: %d, Assets updated: %d",
                result.getSchemasScanned(), result.getTablesFound(),
                result.getAssetsCreated(), result.getAssetsUpdated());
    }
}
