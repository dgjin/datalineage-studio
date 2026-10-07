#!/usr/bin/env bash
# ============================================================================
# reset-prod-db.sh — 将 datalineage 元数据库重置为「干净初始化的生产环境」
#
# 保留（平台初始化资产，视为出厂内容，不清理）：
#   - roles / users                    RBAC 登录账户（admin/governor/viewer）
#   - validation_rules                 M7 内置规则库（8 条）
#   - data_standards                   M12 命名标准（5 条）
#   - glossary_terms                   M12 业务术语（3 条）
#   - reference_codes                  M12 参考码 / 编码字典（9 条）
#   - flyway_schema_history            Flyway 迁移历史（保留，重启不触发重放）
#
# 清空（运行时业务数据与样例数据）：
#   资产 / 字段 / 血缘 / 模式版本、变更 / 审批 / 影响确认、
#   质量问题台账、通知、指标 / 指标历史、契约、
#   数据源、采集任务 / 运行日志 / 适配器、层间导入关系、
#   数据模型 / 明细 / 版本、元数据快照、Webhook、审计日志
#
# 不动（演示数据资产）：
#   - dl_demo / dw_warehouse / dw_app 物理演示库
#   - 前端内置演示数据集（Header「演示数据」开关）
#   演示态可随时执行 bash scripts/switch-demo.sh 重装（支持从干净库自举）
#
# 用法:
#   bash scripts/reset-prod-db.sh
# ============================================================================
set -euo pipefail

MYSQL_CONTAINER="${MYSQL_CONTAINER:-dl-mysql-test}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root123}"
DB="${DB:-datalineage}"

log() { printf '\033[1;36m[reset]\033[0m %s\n' "$*"; }
ok()  { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[FATAL]\033[0m %s\n' "$*" >&2; exit 1; }

mysql_exec() { docker exec -i -e MYSQL_PWD="$MYSQL_PASS" "$MYSQL_CONTAINER" mysql -u"$MYSQL_USER" --default-character-set=utf8mb4 "$@"; }
meta_query() { mysql_exec -N -B "$DB" -e "$1"; }

# ---------------------------------------------------------------------------
# 前置检查
# ---------------------------------------------------------------------------
docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER" 2>/dev/null | grep -q true \
  || die "MySQL 容器 $MYSQL_CONTAINER 未运行"

# ---------------------------------------------------------------------------
# 清空运行时表（FK 检查临时关闭，TRUNCATE 同时重置自增序列）
# ---------------------------------------------------------------------------
log "清空运行时业务数据（${DB}）..."
mysql_exec "$DB" <<'SQL'
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE approval_records;
TRUNCATE TABLE asset_columns;
TRUNCATE TABLE asset_schema_versions;
TRUNCATE TABLE assets;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE change_events;
TRUNCATE TABLE collector_adapters;
TRUNCATE TABLE collector_run_logs;
TRUNCATE TABLE contracts;
TRUNCATE TABLE data_model_tables;
TRUNCATE TABLE data_model_versions;
TRUNCATE TABLE data_models;
TRUNCATE TABLE data_sources;
TRUNCATE TABLE impact_acks;
TRUNCATE TABLE layer_import_relations;
TRUNCATE TABLE lineage_edges;
TRUNCATE TABLE metadata_collect_tasks;
TRUNCATE TABLE metadata_snapshots;
TRUNCATE TABLE metric_history;
TRUNCATE TABLE metrics;
TRUNCATE TABLE notifications;
TRUNCATE TABLE quality_issues;
TRUNCATE TABLE webhook_configs;
SET FOREIGN_KEY_CHECKS = 1;
-- 保留表运行时统计归零（命中计数复原为出厂初始态）
UPDATE validation_rules SET hit_count = 0;
UPDATE data_standards SET hit_count = 0;
SQL
ok "运行时数据已清空"

# ---------------------------------------------------------------------------
# 重置后状态总览
# ---------------------------------------------------------------------------
log "重置后状态："
meta_query "
SELECT 'assets',            COUNT(*) FROM assets
UNION ALL SELECT 'columns',           COUNT(*) FROM asset_columns
UNION ALL SELECT 'edges',             COUNT(*) FROM lineage_edges
UNION ALL SELECT 'changes',           COUNT(*) FROM change_events
UNION ALL SELECT 'issues',            COUNT(*) FROM quality_issues
UNION ALL SELECT 'notifications',     COUNT(*) FROM notifications
UNION ALL SELECT 'metrics',           COUNT(*) FROM metrics
UNION ALL SELECT 'contracts',         COUNT(*) FROM contracts
UNION ALL SELECT 'datasources',       COUNT(*) FROM data_sources
UNION ALL SELECT 'collect-tasks',     COUNT(*) FROM metadata_collect_tasks
UNION ALL SELECT 'run-logs',          COUNT(*) FROM collector_run_logs
UNION ALL SELECT 'models',            COUNT(*) FROM data_models
UNION ALL SELECT 'audit-logs',        COUNT(*) FROM audit_logs
UNION ALL SELECT 'rules (keep)',      COUNT(*) FROM validation_rules
UNION ALL SELECT 'standards (keep)',  COUNT(*) FROM data_standards
UNION ALL SELECT 'glossary (keep)',   COUNT(*) FROM glossary_terms
UNION ALL SELECT 'codes (keep)',      COUNT(*) FROM reference_codes
UNION ALL SELECT 'users (keep)',      COUNT(*) FROM users" \
  | awk -F'\t' '{printf "  %-18s %s\n", $1, $2}'

ok "datalineage 已重置为干净初始化的生产环境"
ok "演示库（dl_demo / dw_warehouse / dw_app）未受影响"
ok "提示：重装演示态执行 bash scripts/switch-demo.sh multisource|full|baseline"
