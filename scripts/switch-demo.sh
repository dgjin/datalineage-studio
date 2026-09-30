#!/usr/bin/env bash
# ============================================================================
# switch-demo.sh — DataLineage Studio 演示数据一键切换
#
#   baseline : 干净基线（20 资产 · 五层血缘 · 无治理侧数据，健康分低位）
#   full     : 完整功能测试数据（标准中枢/契约/指标/规则/质量/变更/审批/通知
#              + legacy 遗留对象触发命名违规自动发现闭环）
#   status   : 查看当前数据集状态
#
# 用法:
#   bash scripts/switch-demo.sh full
#   bash scripts/switch-demo.sh baseline
#   bash scripts/switch-demo.sh status
#
# 前置条件:
#   - MySQL 容器 dl-mysql-test 运行中（localhost:3307）
#   - 后端服务运行中（localhost:8080/api/v1）
#
# 数据来源:
#   - scripts/demo-dataset.sql   业务库五层基线（20 对象 + 样本数据，幂等重建）
#   - scripts/demo-full-data.sql 治理侧完整功能数据（幂等清理 + 装载）
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-dl-mysql-test}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root123}"
BACKEND="${BACKEND:-http://localhost:8080/api/v1}"

METRIC_CODES="'order_amount','order_count','avg_order_value','total_sales','customer_count','customer_value_total','category_sales_qty','dashboard_kpi_value'"

CMD="${1:-status}"

log() { printf '\033[1;36m[switch]\033[0m %s\n' "$*"; }
ok()  { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[FATAL]\033[0m %s\n' "$*" >&2; exit 1; }

mysql_exec() { docker exec -i -e MYSQL_PWD="$MYSQL_PASS" "$MYSQL_CONTAINER" mysql -u"$MYSQL_USER" --default-character-set=utf8mb4 "$@"; }
meta_query() { mysql_exec -N -B datalineage -e "$1"; }

# ---------------------------------------------------------------------------
# 前置检查
# ---------------------------------------------------------------------------
check_prereq() {
  docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER" 2>/dev/null | grep -q true \
    || die "MySQL 容器 $MYSQL_CONTAINER 未运行"
  curl -sf -m 5 "$BACKEND/dashboard/overview" >/dev/null \
    || die "后端未就绪：${BACKEND}（先启动 backend 再执行切换）"
  ok "前置检查通过（容器 + 后端在线）"
}

# ---------------------------------------------------------------------------
# 基础动作
# ---------------------------------------------------------------------------
rebuild_business_db() {
  log "重建 dl_demo 业务库（五层 20 对象 + 样本数据）..."
  mysql_exec < "$ROOT_DIR/scripts/demo-dataset.sql" || die "demo-dataset.sql 执行失败"
  ok "业务库重建完成"
}

create_legacy_object() {
  log "创建遗留对象 dl_demo.legacy_report_tmp（演示命名违规自动发现）..."
  mysql_exec -e "CREATE TABLE IF NOT EXISTS dl_demo.legacy_report_tmp (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '快照ID',
    report_name VARCHAR(64) DEFAULT NULL COMMENT '报表名称',
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='历史遗留报表快照表（未按分层前缀命名）';"
  ok "遗留对象就绪"
}

trigger_collect() {
  local tid resp
  tid=$(meta_query "SELECT id FROM metadata_collect_tasks ORDER BY created_at ASC LIMIT 1")
  [ -n "$tid" ] || die "未找到采集任务（metadata_collect_tasks 为空）"
  log "触发元数据采集（任务 ${tid}）..."
  resp=$(curl -sf -m 180 -X POST "$BACKEND/collect-tasks/$tid/run") || die "采集触发失败"
  echo "$resp" | grep -q '"code":200' || die "采集返回异常：$resp"
  ok "采集完成（资产/血缘已刷新）"
}

run_naming_check() {
  log "执行命名规范校验（标准中枢闭环：违规自动生成质量问题）..."
  local resp
  resp=$(curl -sf -m 60 -X POST "$BACKEND/standards/naming-check") || die "命名校验 API 调用失败"
  echo "  $(echo "$resp" | head -c 400)"
}

# ---------------------------------------------------------------------------
# full：完整功能测试数据集
# ---------------------------------------------------------------------------
do_full() {
  check_prereq
  # 1) 业务库：五层基线 + legacy 遗留对象
  rebuild_business_db
  create_legacy_object
  # 2) 采集：21 资产（20 基线 + 1 遗留对象）
  trigger_collect
  # 3) 治理侧功能数据（标准/词根/编码/契约/指标/规则/质量/变更/审批/通知）
  log "加载完整功能测试数据（demo-full-data.sql）..."
  mysql_exec < "$ROOT_DIR/scripts/demo-full-data.sql" || die "demo-full-data.sql 执行失败"
  ok "功能数据加载完成"
  # 4) 重置 legacy 命名校验产物后重新执行校验（保证命中计数从演示标准重新累计）
  mysql_exec datalineage -e "DELETE FROM quality_issues WHERE affected_asset_name = 'legacy_report_tmp';"
  run_naming_check
  printf '\n'
  do_status
}

# ---------------------------------------------------------------------------
# baseline：干净基线
# ---------------------------------------------------------------------------
do_baseline() {
  check_prereq
  # 1) 丢弃遗留演示对象
  log "移除遗留演示对象 legacy_report_tmp ..."
  mysql_exec -e "DROP TABLE IF EXISTS dl_demo.legacy_report_tmp;"
  # 2) 重建业务库（回到五层基线）
  rebuild_business_db
  # 3) 清理治理侧功能数据（与 demo-full-data.sql 清理段保持一致）
  log "清理治理侧功能数据..."
  mysql_exec datalineage <<'SQL'
DELETE FROM approval_records WHERE id LIKE 'apr-demo%' OR change_id LIKE 'chg-demo%';
DELETE FROM change_events WHERE id LIKE 'chg-demo%';
DELETE FROM notifications WHERE id LIKE 'ntf-demo%';
DELETE FROM quality_issues WHERE id LIKE 'qis-demo%' OR code LIKE 'QI-DEMO%' OR code LIKE 'QI-NAMING-%' OR affected_asset_name = 'legacy_report_tmp';
DELETE FROM validation_rules WHERE id LIKE 'vr-demo%';
SQL
  mysql_exec datalineage -e "
DELETE FROM metric_history WHERE metric_code IN ($METRIC_CODES);
DELETE FROM metrics WHERE code IN ($METRIC_CODES);
DELETE FROM contracts WHERE id LIKE 'ct-demo%';
DELETE FROM data_standards WHERE id LIKE 'std-demo%';
DELETE FROM glossary_terms WHERE id LIKE 'glo-demo%';
DELETE FROM reference_codes WHERE id LIKE 'rc-demo%';
UPDATE assets SET contract_ref = NULL WHERE contract_ref LIKE 'contracts/%';
DELETE FROM lineage_edges WHERE from_asset_id LIKE 'asset:dl_demo.legacy%' OR to_asset_id LIKE 'asset:dl_demo.legacy%';
DELETE FROM asset_columns WHERE asset_id LIKE 'asset:dl_demo.legacy%';
DELETE FROM assets WHERE id LIKE 'asset:dl_demo.legacy%';"
  ok "治理侧数据清理完成"
  # 4) 采集刷新（资产/血缘回到 20 基线）
  trigger_collect
  printf '\n'
  do_status
}

# ---------------------------------------------------------------------------
# status：状态总览
# ---------------------------------------------------------------------------
do_status() {
  log "当前数据集状态："
  meta_query "
SELECT 'assets',        COUNT(*) FROM assets
UNION ALL SELECT 'standards',     COUNT(*) FROM data_standards     WHERE id LIKE 'std-demo%'
UNION ALL SELECT 'glossary',      COUNT(*) FROM glossary_terms     WHERE id LIKE 'glo-demo%'
UNION ALL SELECT 'codes',         COUNT(*) FROM reference_codes    WHERE id LIKE 'rc-demo%'
UNION ALL SELECT 'contracts',     COUNT(*) FROM contracts          WHERE id LIKE 'ct-demo%'
UNION ALL SELECT 'metrics',       COUNT(*) FROM metrics            WHERE code IN ($METRIC_CODES)
UNION ALL SELECT 'rules',         COUNT(*) FROM validation_rules   WHERE id LIKE 'vr-demo%'
UNION ALL SELECT 'issues',        COUNT(*) FROM quality_issues
UNION ALL SELECT 'changes',       COUNT(*) FROM change_events      WHERE id LIKE 'chg-demo%'
UNION ALL SELECT 'approvals',     COUNT(*) FROM approval_records   WHERE id LIKE 'apr-demo%'
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications      WHERE id LIKE 'ntf-demo%'" \
  | awk -F'\t' '{printf "  %-14s %s\n", $1, $2}'

  local std_n legacy_n mode
  std_n=$(meta_query "SELECT COUNT(*) FROM data_standards WHERE id LIKE 'std-demo%'")
  legacy_n=$(meta_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='dl_demo' AND table_name='legacy_report_tmp'")
  if [ "${std_n:-0}" -gt 0 ] && [ "${legacy_n:-0}" -gt 0 ]; then
    mode="full（完整功能测试数据）"
  elif [ "${std_n:-0}" -eq 0 ] && [ "${legacy_n:-0}" -eq 0 ]; then
    mode="baseline（干净基线）"
  else
    mode="mixed（混合态：建议重新执行 full 或 baseline）"
  fi
  ok "当前模式：$mode"

  local health
  health=$(curl -sf -m 5 "$BACKEND/dashboard/overview" | grep -o '"avgScore":[0-9.]*' | head -1 || true)
  [ -n "$health" ] && ok "治理健康分：${health#*:}"
}

case "$CMD" in
  full)     do_full ;;
  baseline) do_baseline ;;
  status)   do_status ;;
  *)        die "未知参数：${CMD}（可选：full | baseline | status）" ;;
esac
