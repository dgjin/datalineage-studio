package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.datalineage.dto.FeedbackEntryView;
import com.datalineage.dto.FeedbackReviewRequest;
import com.datalineage.dto.FeedbackRevisionView;
import com.datalineage.dto.FeedbackSubmitRequest;
import com.datalineage.dto.IsoTime;
import com.datalineage.entity.FeedbackEntryEntity;
import com.datalineage.entity.FeedbackEntryRevisionEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.FeedbackEntryMapper;
import com.datalineage.mapper.FeedbackEntryRevisionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 需求收集与反馈基线服务（移植自「智能问数据分析系统」需求反馈功能，语义 1:1）：
 * 用户提交需求/建议/缺陷 → 管理员评估分析（纳入基线 / 不予采纳 / 退回待评估）→
 * 已纳入基线的条目经标准导出接口提供给 AIOps 做主动需求分析。
 * 每次评估（含「继续评估」）追加一条评估历史；处理进度经 {@link FeedbackTrackService} 代理。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackService {

    /** 类型枚举（与契约 v1.0 一致） */
    public static final Set<String> VALID_KINDS = Set.of("REQUIREMENT", "SUGGESTION", "BUG", "OTHER");
    /** 状态枚举 */
    public static final Set<String> VALID_STATUSES = Set.of("PENDING", "BASELINED", "REJECTED");
    /** 优先级枚举 */
    public static final Set<String> VALID_PRIORITIES = Set.of("P0", "P1", "P2", "P3");
    /** 评估动作枚举：BASELINE 纳入基线 / REJECT 不予采纳 / PENDING 退回待评估（误操作纠正） */
    public static final Set<String> VALID_REVIEW_ACTIONS = Set.of("BASELINE", "REJECT", "PENDING");

    private static final int MAX_TITLE = 200;
    private static final int MAX_CONTENT = 5000;
    private static final int MAX_ASSESSMENT = 2000;
    private static final int MAX_BASELINE_VERSION = 50;
    /** 导出/列表附带的评估历史条数上限（升序截取最近 N 条，防极端历史撑大响应） */
    private static final int MAX_REVISIONS_PER_ENTRY = 20;
    private static final int MAX_MINE = 100;
    private static final int MAX_ADMIN_LIST = 500;
    /** 进度查询条目数上限（与 AIOps track 接口一致） */
    private static final int MAX_TRACK_IDS = 100;
    /** since 白名单格式：YYYY-MM-DD[ HH:MM[:SS]]（原样传 DB 前置校验，避免非法输入） */
    private static final Pattern TIME_RE =
            Pattern.compile("^\\d{4}-\\d{2}-\\d{2}([ T]\\d{2}:\\d{2}(:\\d{2})?)?$");
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    private final FeedbackEntryMapper entryMapper;
    private final FeedbackEntryRevisionMapper revisionMapper;
    private final FeedbackTrackService trackService;

    // ---------- 用户侧：提交 / 我的列表 ----------

    /**
     * 提交需求/建议/缺陷（登录用户均可提交；管理面板「录入需求反馈」复用本方法，
     * 可选 priority P0-P3 随提交一并入库）。
     */
    @Transactional
    public Map<String, Object> submit(String submitter, FeedbackSubmitRequest request) {
        String kind = upper(trim(request.getKind()));
        if (kind.isEmpty()) {
            kind = "REQUIREMENT";
        }
        if (!VALID_KINDS.contains(kind)) {
            throw new BusinessException("类型无效（REQUIREMENT / SUGGESTION / BUG / OTHER）");
        }
        String title = slice(trim(request.getTitle()), MAX_TITLE);
        if (title.isEmpty()) {
            throw new BusinessException("请填写标题");
        }
        String content = slice(trim(request.getContent()), MAX_CONTENT);
        if (content.isEmpty()) {
            throw new BusinessException("请填写内容描述");
        }
        String priority = upper(trim(request.getPriority()));
        if (!priority.isEmpty() && !VALID_PRIORITIES.contains(priority)) {
            throw new BusinessException("优先级无效（P0 / P1 / P2 / P3）");
        }

        FeedbackEntryEntity entity = new FeedbackEntryEntity();
        entity.setKind(kind);
        entity.setTitle(title);
        entity.setContent(content);
        entity.setStatus("PENDING");
        entity.setPriority(priority);
        entity.setBaselineVersion("");
        entity.setSubmitter(submitter);
        // 契约预留字段：当前系统无部门维度，固定空串
        entity.setDepartment("");
        entity.setReviewer("");
        entryMapper.insert(entity);
        return Map.of("id", entity.getId());
    }

    /** 我的提交列表（按提交时间倒序，最多 100 条）。 */
    public List<FeedbackEntryView> listMine(String submitter) {
        List<FeedbackEntryEntity> rows = entryMapper.selectList(new QueryWrapper<FeedbackEntryEntity>()
                .eq("submitter", submitter)
                .orderByDesc("created_at")
                .last("LIMIT " + MAX_MINE));
        return rows.stream().map(FeedbackEntryView::from).collect(Collectors.toList());
    }

    // ---------- 智能运维处理进度代理 ----------

    /**
     * 查询条目在 AIOps 的处理进度：未配置集成时 configured=false；
     * 归属隔离——非 ADMIN 仅能查询本人提交的条目（越权 ID 静默剔除，不泄露存在性）。
     */
    public Map<String, Object> opsProgress(String caller, boolean isAdmin, String idsParam) {
        List<Long> ids = parseIds(idsParam);
        if (ids.isEmpty()) {
            throw new BusinessException("缺少 ids（逗号分隔的需求条目 ID 列表）");
        }
        if (ids.size() > MAX_TRACK_IDS) {
            throw new BusinessException("ids 最多 " + MAX_TRACK_IDS + " 个");
        }
        Map<String, Object> response = new LinkedHashMap<>();
        if (!trackService.configured()) {
            response.put("configured", false);
            response.put("ops", Map.of());
            return response;
        }
        List<Long> allowed = ids;
        if (!isAdmin) {
            List<FeedbackEntryEntity> mine = entryMapper.selectList(new QueryWrapper<FeedbackEntryEntity>()
                    .select("id")
                    .eq("submitter", caller)
                    .in("id", ids));
            Set<Long> mineIds = mine.stream().map(FeedbackEntryEntity::getId).collect(Collectors.toSet());
            allowed = ids.stream().filter(mineIds::contains).collect(Collectors.toList());
        }
        response.put("configured", true);
        if (allowed.isEmpty()) {
            response.put("ok", true);
            response.put("ops", Map.of());
            return response;
        }
        FeedbackTrackService.TrackResult result = trackService.fetch(allowed);
        if (!result.ok()) {
            // 失败不缓存：AIOps 短暂不可用时，下一次请求立即重试
            response.put("ok", false);
            response.put("error", result.error().isEmpty() ? "处理进度获取失败" : result.error());
            response.put("ops", Map.of());
            return response;
        }
        response.put("ok", true);
        response.put("ops", result.ops());
        if (result.cached()) {
            response.put("cached", true);
        }
        return response;
    }

    // ---------- 管理侧：列表 / 摘要 / 评估 / 删除 ----------

    /** 全部提交（默认待评估优先排序；status/kind 非法值静默忽略，与源实现一致）。 */
    public List<FeedbackEntryView> listAdmin(String status, String kind) {
        QueryWrapper<FeedbackEntryEntity> wrapper = new QueryWrapper<>();
        String normalizedStatus = upper(trim(status));
        if (!normalizedStatus.isEmpty() && VALID_STATUSES.contains(normalizedStatus)) {
            wrapper.eq("status", normalizedStatus);
        }
        String normalizedKind = upper(trim(kind));
        if (!normalizedKind.isEmpty() && VALID_KINDS.contains(normalizedKind)) {
            wrapper.eq("kind", normalizedKind);
        }
        wrapper.last("ORDER BY (status = 'PENDING') DESC, created_at DESC LIMIT " + MAX_ADMIN_LIST);
        List<FeedbackEntryView> views = entryMapper.selectList(wrapper).stream()
                .map(FeedbackEntryView::from).collect(Collectors.toList());
        attachRevisions(views);
        return views;
    }

    /** 统计摘要：按状态 / 类型 / 基线优先级分组计数（供管理面板统计卡）。 */
    public Map<String, Object> summary() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("byStatus", entryMapper.countByStatus());
        result.put("byKind", entryMapper.countByKind());
        result.put("byPriority", entryMapper.countByPriority());
        return result;
    }

    /**
     * 评估分析（ADMIN）：BASELINE 纳入基线（须填评估意见，priority 缺省 P2）/
     * REJECT 不予采纳（清空优先级与基线版本，保留评估意见）/
     * PENDING 退回待评估（清空决策字段，保留评估笔记便于再评估）。
     * 每次评估（含继续评估）追加一条评估历史。
     */
    @Transactional
    public Map<String, Object> review(Long id, FeedbackReviewRequest request, String reviewer) {
        String action = upper(trim(request.getAction()));
        if (!VALID_REVIEW_ACTIONS.contains(action)) {
            throw new BusinessException("action 无效（BASELINE / REJECT / PENDING）");
        }
        String assessment = slice(trim(request.getAssessment()), MAX_ASSESSMENT);
        String priority = upper(trim(request.getPriority()));
        String baselineVersion = slice(trim(request.getBaselineVersion()), MAX_BASELINE_VERSION);
        if ("BASELINE".equals(action)) {
            if (assessment.isEmpty()) {
                throw new BusinessException("纳入基线前须填写评估分析意见");
            }
            if (!priority.isEmpty() && !VALID_PRIORITIES.contains(priority)) {
                throw new BusinessException("priority 无效（P0 / P1 / P2 / P3）");
            }
        }
        FeedbackEntryEntity entry = entryMapper.selectById(id);
        if (entry == null) {
            throw new BusinessException("条目不存在");
        }

        String newStatus;
        // 评估历史落库值（与主表 UPDATE 语义一致：非 BASELINE 不携带优先级/基线版本）
        String revisionPriority = "";
        String revisionVersion = "";
        LambdaUpdateWrapper<FeedbackEntryEntity> update = new LambdaUpdateWrapper<FeedbackEntryEntity>()
                .eq(FeedbackEntryEntity::getId, id);
        if ("BASELINE".equals(action)) {
            newStatus = "BASELINED";
            revisionPriority = priority.isEmpty() ? "P2" : priority;
            revisionVersion = baselineVersion;
            update.set(FeedbackEntryEntity::getStatus, "BASELINED")
                    .set(FeedbackEntryEntity::getPriority, revisionPriority)
                    .set(FeedbackEntryEntity::getBaselineVersion, baselineVersion)
                    .set(FeedbackEntryEntity::getAssessment, assessment)
                    .set(FeedbackEntryEntity::getReviewer, reviewer)
                    .set(FeedbackEntryEntity::getReviewedAt, LocalDateTime.now());
        } else if ("REJECT".equals(action)) {
            newStatus = "REJECTED";
            update.set(FeedbackEntryEntity::getStatus, "REJECTED")
                    .set(FeedbackEntryEntity::getPriority, "")
                    .set(FeedbackEntryEntity::getBaselineVersion, "")
                    .set(FeedbackEntryEntity::getAssessment, assessment)
                    .set(FeedbackEntryEntity::getReviewer, reviewer)
                    .set(FeedbackEntryEntity::getReviewedAt, LocalDateTime.now());
        } else {
            // 退回待评估：清空决策字段（assessment 保留：评估笔记不丢，便于后续再评估）
            newStatus = "PENDING";
            update.set(FeedbackEntryEntity::getStatus, "PENDING")
                    .set(FeedbackEntryEntity::getPriority, "")
                    .set(FeedbackEntryEntity::getBaselineVersion, "")
                    .set(FeedbackEntryEntity::getReviewer, "")
                    .set(FeedbackEntryEntity::getReviewedAt, null);
        }
        entryMapper.update(null, update);

        FeedbackEntryRevisionEntity revision = new FeedbackEntryRevisionEntity();
        revision.setEntryId(id);
        revision.setAction(action);
        revision.setPriority(revisionPriority);
        revision.setBaselineVersion(revisionVersion);
        revision.setAssessment(assessment);
        revision.setReviewer(reviewer);
        revisionMapper.insert(revision);

        return Map.of("id", id, "status", newStatus);
    }

    /** 删除条目（ADMIN；评估历史随外键级联删除，写操作经审计切面留痕）。 */
    @Transactional
    public void delete(Long id) {
        FeedbackEntryEntity entry = entryMapper.selectById(id);
        if (entry == null) {
            throw new BusinessException("条目不存在");
        }
        entryMapper.deleteById(id);
    }

    // ---------- 标准导出接口（供 AIOps 平台拉取做主动需求分析） ----------

    /**
     * 导出需求基线条目（契约 v1.0，响应无 ApiResponse 包裹，以 HTTP 状态码为准）：
     * 默认仅导出已纳入基线（BASELINED）的条目；since 按 updated_at 增量拉取；
     * 条目附评估历史（升序，至多 20 条）——「继续评估」产生的新内容随条目一并提供。
     */
    public Map<String, Object> export(String statusParam, String kindParam, String sinceParam, String limitParam) {
        String status = upper(trim(statusParam));
        if (status.isEmpty()) {
            status = "BASELINED";
        }
        String kind = upper(trim(kindParam));
        String since = trim(sinceParam);
        int limit = clampLimit(limitParam);

        QueryWrapper<FeedbackEntryEntity> wrapper = new QueryWrapper<>();
        if (!"ALL".equals(status)) {
            if (!VALID_STATUSES.contains(status)) {
                throw new BusinessException("status 无效（BASELINED / PENDING / REJECTED / ALL）");
            }
            wrapper.eq("status", status);
        }
        if (!kind.isEmpty()) {
            if (!VALID_KINDS.contains(kind)) {
                throw new BusinessException("kind 无效（REQUIREMENT / SUGGESTION / BUG / OTHER）");
            }
            wrapper.eq("kind", kind);
        }
        if (!since.isEmpty()) {
            LocalDateTime sinceTime = parseSince(since);
            if (sinceTime == null) {
                throw new BusinessException("since 格式无效（YYYY-MM-DD[ HH:MM[:SS]]）");
            }
            wrapper.ge("updated_at", sinceTime);
        }
        wrapper.last("ORDER BY updated_at DESC, created_at DESC LIMIT " + limit);

        List<FeedbackEntryView> views = entryMapper.selectList(wrapper).stream()
                .map(FeedbackEntryView::from).collect(Collectors.toList());
        attachRevisions(views);

        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("status", status);
        filter.put("kind", kind.isEmpty() ? null : kind);
        filter.put("since", since.isEmpty() ? null : since);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("spec_version", "1.0");
        result.put("service", "datalineage-studio");
        result.put("system", "DataLineage Studio 数据血缘治理平台");
        result.put("exportedAt", IsoTime.nowIso());
        result.put("filter", filter);
        result.put("returned", views.size());
        result.put("entries", views);
        return result;
    }

    // ---------- 内部工具 ----------

    /** 批量加载评估历史并按条目分组（自增 id 升序 = 评估先后；超出上限截取最近 N 条）。 */
    private void attachRevisions(List<FeedbackEntryView> views) {
        if (views.isEmpty()) {
            return;
        }
        List<Long> ids = views.stream().map(FeedbackEntryView::getId).collect(Collectors.toList());
        List<FeedbackEntryRevisionEntity> revisions = revisionMapper.selectList(
                new QueryWrapper<FeedbackEntryRevisionEntity>()
                        .in("entry_id", ids)
                        .orderByAsc("id"));
        Map<Long, List<FeedbackRevisionView>> grouped = new LinkedHashMap<>();
        for (FeedbackEntryRevisionEntity revision : revisions) {
            grouped.computeIfAbsent(revision.getEntryId(), key -> new ArrayList<>())
                    .add(FeedbackRevisionView.from(revision));
        }
        for (FeedbackEntryView view : views) {
            List<FeedbackRevisionView> list = grouped.getOrDefault(view.getId(), List.of());
            if (list.size() > MAX_REVISIONS_PER_ENTRY) {
                list = list.subList(list.size() - MAX_REVISIONS_PER_ENTRY, list.size());
            }
            view.setRevisions(list);
        }
    }

    /**
     * ids 解析：逗号分隔的正整数（对齐源实现 Number.isInteger && n > 0 口径），
     * 非法 token 静默忽略，保序去重。
     */
    private List<Long> parseIds(String raw) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (String part : trim(raw).split(",")) {
            String value = part.trim();
            if (value.isEmpty()) {
                continue;
            }
            try {
                long parsed = Long.parseLong(value);
                if (parsed > 0) {
                    ids.add(parsed);
                }
            } catch (NumberFormatException ignored) {
                // 非数字 token 忽略（与源实现容错一致）
            }
        }
        return new ArrayList<>(ids);
    }

    /**
     * since 解析：白名单格式 YYYY-MM-DD[ HH:MM[:SS]]（与源实现同口径）；
     * 扩展接受本服务 exportedAt 输出的 ISO 8601 带偏移格式原样回传（增量游标闭环）。
     * 返回 null 表示格式非法。
     */
    private LocalDateTime parseSince(String raw) {
        String value = raw.trim();
        if (TIME_RE.matcher(value).matches()) {
            try {
                if (value.length() <= 10) {
                    return LocalDate.parse(value).atStartOfDay();
                }
                // ISO_LOCAL_DATE_TIME 接受 T 分隔与缺省秒（12:34 == 12:34:00）
                return LocalDateTime.parse(value.replace(' ', 'T'));
            } catch (DateTimeParseException e) {
                return null;
            }
        }
        try {
            return OffsetDateTime.parse(value).atZoneSameInstant(ZONE).toLocalDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** limit 解析与限幅：非数字回退 200，取值区间 [1, 500]（与源实现 clampInt 同口径）。 */
    private int clampLimit(String raw) {
        int fallback = 200;
        String value = trim(raw);
        if (value.isEmpty()) {
            return fallback;
        }
        try {
            long parsed = (long) Math.floor(Double.parseDouble(value));
            return (int) Math.min(500, Math.max(1, parsed));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String upper(String value) {
        return trim(value).toUpperCase();
    }

    private String slice(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
