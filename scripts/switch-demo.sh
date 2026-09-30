#!/usr/bin/env bash
# ============================================================================
# switch-demo.sh — DataLineage Studio 演示数据一键切换
#
#   baseline    : 干净基线（20 资产 · 五层血缘 · 无治理侧数据，健康分低位）
#   full        : 完整功能测试数据（标准中枢/契约/指标/规则/质量/变更/审批/通知
#                 + legacy 遗留对象触发命名违规自动发现闭环）
#   multisource : 多数据源分层导入演示（ODS/DWD/DWS/ADS/APP 分属 3 个数据源，
#                 声明层间关系并构建跨源血缘：同名匹配 + ETL SQL 解析两种通道）
#   status      : 查看当前数据集状态
#
# 用法:
#   bash scripts/switch-demo.sh multisource
#   bash scripts/switch-demo.sh full
#   bash scripts/switch-demo.sh baseline
#   bash scripts/switch-demo.sh status
#
# 前置条件:
#   - MySQL 容器 dl-mysql-test 运行中（localhost:3307）
#   - 后端服务运行中（localhost:8080/api/v1）
#
# 数据来源:
#   - scripts/demo-dataset.sql     业务库五层基线（20 对象 + 样本数据，幂等重建）
#   - scripts/demo-full-data.sql   治理侧完整功能数据（幂等清理 + 装载）
#   - scripts/demo-multisource.sql 数仓层 + 应用层两库（DWD/DWS/ADS/APP 共 8 表）
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-dl-mysql-test}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root123}"
BACKEND="${BACKEND:-http://localhost:8080/api/v1}"

METRIC_CODES="'order_amount','order_count','avg_order_value','total_sales','customer_count','customer_value_total','category_sales_qty','dashboard_kpi_value'"

# 多数据源分层导入演示：数据源名称常量（按名称做幂等定位）
MS_DS_WAREHOUSE_NAME="数仓层MySQL（DWD+DWS）"
MS_DS_APP_NAME="应用层MySQL（ADS+APP）"

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

trigger_collect_by() {
  local tid="$1" resp
  [ -n "$tid" ] || die "采集任务为空"
  log "触发元数据采集（任务 ${tid}）..."
  resp=$(curl -sf -m 180 -X POST "$BACKEND/collect-tasks/$tid/run") || die "采集触发失败"
  echo "$resp" | grep -q '"code":200' || die "采集返回异常：$resp"
  ok "采集完成（资产/血缘已刷新）"
}

trigger_collect() {
  local tid
  tid=$(meta_query "SELECT id FROM metadata_collect_tasks ORDER BY created_at ASC LIMIT 1")
  [ -n "$tid" ] || die "未找到采集任务（metadata_collect_tasks 为空）"
  trigger_collect_by "$tid"
}

run_naming_check() {
  log "执行命名规范校验（标准中枢闭环：违规自动生成质量问题）..."
  local resp
  resp=$(curl -sf -m 60 -X POST "$BACKEND/standards/naming-check") || die "命名校验 API 调用失败"
  echo "  $(echo "$resp" | head -c 400)"
}

# ---------------------------------------------------------------------------
# multisource：多数据源分层导入演示（辅助函数）
# ---------------------------------------------------------------------------

# 幂等获取/创建数据源，输出数据源 id（日志走 stderr，避免污染 stdout）
ensure_datasource() {
  local name="$1" db="$2" id resp
  id=$(meta_query "SELECT id FROM data_sources WHERE name = '${name}' LIMIT 1")
  if [ -z "$id" ]; then
    resp=$(curl -sf -X POST "$BACKEND/datasources" -H 'Content-Type: application/json' -d "{
      \"name\": \"${name}\",
      \"type\": \"MYSQL\",
      \"host\": \"localhost\",
      \"port\": 3307,
      \"databaseName\": \"${db}\",
      \"username\": \"root\",
      \"passwordEncrypted\": \"root123\",
      \"status\": \"ACTIVE\"}") || die "数据源创建失败：${name}"
    id=$(echo "$resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log "创建数据源：${name}（${id}）" >&2
  else
    log "复用数据源：${name}（${id}）" >&2
  fi
  printf '%s' "$id"
}

# 幂等获取/创建采集任务，输出任务 id
ensure_task() {
  local dsid="$1" tname="$2" schema="$3" dlayer="$4" dspace="$5" tid resp
  tid=$(meta_query "SELECT id FROM metadata_collect_tasks WHERE data_source_id = '${dsid}' LIMIT 1")
  if [ -z "$tid" ]; then
    resp=$(curl -sf -X POST "$BACKEND/collect-tasks" -H 'Content-Type: application/json' -d "{
      \"dataSourceId\": \"${dsid}\",
      \"taskName\": \"${tname}\",
      \"collectScope\": \"SCHEMA_ONLY\",
      \"targetSchemas\": [\"${schema}\"],
      \"defaultLayer\": \"${dlayer}\",
      \"defaultSpace\": \"${dspace}\",
      \"autoRegisterAsset\": true,
      \"autoDiscoverLineage\": true}") || die "采集任务创建失败：${tname}"
    tid=$(echo "$resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log "创建采集任务：${tname}（${tid}）" >&2
  else
    log "复用采集任务：${tname}（${tid}）" >&2
  fi
  printf '%s' "$tid"
}

# 创建层间关系，输出关系 id
create_relation() {
  local resp rid
  resp=$(curl -sf -X POST "$BACKEND/layer-imports" -H 'Content-Type: application/json' -d "$1") \
    || die "层间关系创建失败：$1"
  rid=$(echo "$resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$rid" ] || die "层间关系创建响应异常：$resp"
  printf '%s' "$rid"
}

# 删除全部 MS- 前缀的演示关系（服务端级联删除其血缘边）
remove_ms_relations() {
  local ids rid
  ids=$(curl -sf "$BACKEND/layer-imports" | grep -o '"id":"[^"]*","name":"MS-[^"]*"' | cut -d'"' -f4 || true)
  for rid in $ids; do
    curl -sf -X DELETE "$BACKEND/layer-imports/$rid" >/dev/null || die "关系删除失败：$rid"
  done
}

# 4 条层间关系定义（同名匹配 + ETL 解析两通道），按行输出 JSON
ms_relation_payloads() {
  local ds1="$1" ds2="$2" ds3="$3"
  printf '%s\n' "{\"name\":\"MS-ODS→DWD（同名匹配）\",\"fromLayer\":\"ODS\",\"fromDataSourceId\":\"${ds1}\",\"toLayer\":\"DWD\",\"toDataSourceId\":\"${ds2}\",\"matchMode\":\"OBJECT_NAME\"}"
  printf '%s\n' "{\"name\":\"MS-DWD→DWS（ETL解析）\",\"fromLayer\":\"DWD\",\"fromDataSourceId\":\"${ds2}\",\"toLayer\":\"DWS\",\"toDataSourceId\":\"${ds2}\",\"matchMode\":\"ETL_SQL\",\"etlSql\":\"INSERT INTO dws_order_daily (stat_date, order_count, total_amount) SELECT DATE(created_at), COUNT(*), SUM(total_amount) FROM dwd_orders GROUP BY DATE(created_at); INSERT INTO dws_customer_summary (customer_id, order_total, last_order_at) SELECT customer_id, SUM(total_amount), MAX(created_at) FROM dwd_orders GROUP BY customer_id\"}"
  printf '%s\n' "{\"name\":\"MS-DWS→ADS（ETL解析）\",\"fromLayer\":\"DWS\",\"fromDataSourceId\":\"${ds2}\",\"toLayer\":\"ADS\",\"toDataSourceId\":\"${ds3}\",\"matchMode\":\"ETL_SQL\",\"etlSql\":\"INSERT INTO ads_sales_dashboard (report_date, total_sales, order_volume) SELECT stat_date, total_amount, order_count FROM dws_order_daily; INSERT INTO ads_customer_360 (customer_id, total_orders) SELECT customer_id, order_total FROM dws_customer_summary\"}"
  printf '%s\n' "{\"name\":\"MS-ADS→APP（同名匹配）\",\"fromLayer\":\"ADS\",\"fromDataSourceId\":\"${ds3}\",\"toLayer\":\"APP\",\"toDataSourceId\":\"${ds3}\",\"matchMode\":\"OBJECT_NAME\"}"
}

# ---------------------------------------------------------------------------
# full：完整功能测试数据集
# ---------------------------------------------------------------------------
do_full() {
  check_prereq
  # 0) 清理多源分层导入演示残留（保证模式间互斥的确定状态）
  clear_multisource
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
# multisource：多数据源分层导入演示
#   dl_demo(本地测试MySQL)=ODS · dw_warehouse(数仓层MySQL)=DWD+DWS · dw_app(应用层MySQL)=ADS+APP
# ---------------------------------------------------------------------------
do_multisource() {
  check_prereq
  # 0) 治理侧归零（保证从 full 切入时无 legacy 对象与治理数据残留）
  reset_governance
  # 1) 重建数仓层 / 应用层演示库（8 对象）
  log "重建演示库 dw_warehouse + dw_app（DWD/DWS/ADS/APP 共 8 对象）..."
  mysql_exec < "$ROOT_DIR/scripts/demo-multisource.sql" || die "demo-multisource.sql 执行失败"
  ok "演示库重建完成"

  # 2) 数据源：ODS 用主数据源，另建数仓层/应用层两个数据源（幂等）
  local ds1 ds2 ds3
  ds1=$(meta_query "SELECT id FROM data_sources WHERE name NOT LIKE '数仓层MySQL%' AND name NOT LIKE '应用层MySQL%' ORDER BY created_at ASC LIMIT 1")
  [ -n "$ds1" ] || die "未找到主数据源（data_sources 为空）"
  log "ODS 数据源：${ds1}"
  ds2=$(ensure_datasource "$MS_DS_WAREHOUSE_NAME" "dw_warehouse")
  ds3=$(ensure_datasource "$MS_DS_APP_NAME" "dw_app")

  # 3) 采集任务：三层各建一个（幂等）并触发采集（ODS 侧确保基线资产存在）
  local tid1 tid2 tid3
  tid1=$(ensure_task "$ds1" "ODS 贴源层采集（dl_demo）" "dl_demo" "ODS" "demo")
  tid2=$(ensure_task "$ds2" "数仓层采集（dw_warehouse）" "dw_warehouse" "DWD" "warehouse")
  tid3=$(ensure_task "$ds3" "应用层采集（dw_app）" "dw_app" "ADS" "app")
  trigger_collect_by "$tid1"
  trigger_collect_by "$tid2"
  trigger_collect_by "$tid3"

  # 4) 层间关系：清理旧演示关系后创建 4 条（同名匹配 ×2 + ETL 解析 ×2）
  log "重建层间导入关系（MS- 前缀，4 条）..."
  remove_ms_relations
  local payload rid rel_ids=""
  while IFS= read -r payload; do
    rid=$(create_relation "$payload")
    rel_ids="$rel_ids $rid"
    ok "关系已创建：$(echo "$payload" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)"
  done < <(ms_relation_payloads "$ds1" "$ds2" "$ds3")

  # 5) 构建跨源血缘边（幂等重建）
  log "构建跨源血缘边..."
  for rid in $rel_ids; do
    curl -sf -m 60 -X POST "$BACKEND/layer-imports/$rid/build" >/dev/null || die "构建失败：$rid"
  done
  ok "跨源血缘构建完成（M2 图中青绿色连线）"
  printf '\n'
  do_status
}

# ---------------------------------------------------------------------------
# 模式互斥辅助：治理侧归零 / 多源演示清理（支持三模式任意顺序切换）
# ---------------------------------------------------------------------------

# 治理侧归零：丢弃 legacy 对象 + 重建业务库 + 清理 full 治理数据
reset_governance() {
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
}

# 清理多源分层导入演示：关系/跨源边/数据源/任务/资产 + 两演示库
clear_multisource() {
  log "清理多源分层导入演示数据..."
  remove_ms_relations
  mysql_exec datalineage <<'SQL'
DELETE FROM lineage_edges WHERE source IN ('CROSS_SOURCE','ETL_PARSER');
DELETE FROM lineage_edges WHERE from_asset_id IN (
  SELECT id FROM assets WHERE data_source_id IN (
    SELECT id FROM data_sources WHERE name LIKE '数仓层MySQL%' OR name LIKE '应用层MySQL%'));
DELETE FROM lineage_edges WHERE to_asset_id IN (
  SELECT id FROM assets WHERE data_source_id IN (
    SELECT id FROM data_sources WHERE name LIKE '数仓层MySQL%' OR name LIKE '应用层MySQL%'));
DELETE FROM asset_columns WHERE asset_id IN (
  SELECT id FROM assets WHERE data_source_id IN (
    SELECT id FROM data_sources WHERE name LIKE '数仓层MySQL%' OR name LIKE '应用层MySQL%'));
DELETE FROM quality_issues WHERE affected_asset_name IN
  ('dwd_orders','dwd_customers','dws_order_daily','dws_customer_summary',
   'ads_sales_dashboard','ads_customer_360','app_sales_dashboard','app_customer_360');
DELETE FROM assets WHERE data_source_id IN (
  SELECT id FROM data_sources WHERE name LIKE '数仓层MySQL%' OR name LIKE '应用层MySQL%');
DELETE FROM metadata_collect_tasks WHERE data_source_id IN (
  SELECT id FROM data_sources WHERE name LIKE '数仓层MySQL%' OR name LIKE '应用层MySQL%');
DELETE FROM data_sources WHERE name LIKE '数仓层MySQL%' OR name LIKE '应用层MySQL%';
DELETE FROM layer_import_relations;
DROP DATABASE IF EXISTS dw_warehouse;
DROP DATABASE IF EXISTS dw_app;
SQL
  ok "多源演示数据清理完成"
}

# ---------------------------------------------------------------------------
# baseline：干净基线
# ---------------------------------------------------------------------------
do_baseline() {
  check_prereq
  reset_governance
  clear_multisource
  # 采集刷新（资产/血缘回到 20 基线）
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
UNION ALL SELECT 'cross-edges',   COUNT(*) FROM lineage_edges      WHERE source IN ('CROSS_SOURCE','ETL_PARSER')
UNION ALL SELECT 'import-rels',   COUNT(*) FROM layer_import_relations
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

  local std_n legacy_n cross_n rel_n mode
  std_n=$(meta_query "SELECT COUNT(*) FROM data_standards WHERE id LIKE 'std-demo%'")
  legacy_n=$(meta_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='dl_demo' AND table_name='legacy_report_tmp'")
  cross_n=$(meta_query "SELECT COUNT(*) FROM lineage_edges WHERE source IN ('CROSS_SOURCE','ETL_PARSER')")
  rel_n=$(meta_query "SELECT COUNT(*) FROM layer_import_relations")
  if [ "${rel_n:-0}" -gt 0 ]; then
    mode="multisource（多数据源分层导入：${rel_n} 条关系 · ${cross_n} 条跨源边）"
  elif [ "${std_n:-0}" -gt 0 ] && [ "${legacy_n:-0}" -gt 0 ]; then
    mode="full（完整功能测试数据）"
  elif [ "${std_n:-0}" -eq 0 ] && [ "${legacy_n:-0}" -eq 0 ] && [ "${cross_n:-0}" -eq 0 ]; then
    mode="baseline（干净基线）"
  else
    mode="mixed（混合态：建议重新执行 full / multisource / baseline）"
  fi
  ok "当前模式：$mode"

  local health
  health=$(curl -sf -m 5 "$BACKEND/dashboard/overview" | grep -o '"avgScore":[0-9.]*' | head -1 || true)
  [ -n "$health" ] && ok "治理健康分：${health#*:}"
}

case "$CMD" in
  full)        do_full ;;
  multisource) do_multisource ;;
  baseline)    do_baseline ;;
  status)      do_status ;;
  *)           die "未知参数：${CMD}（可选：full | multisource | baseline | status）" ;;
esac
