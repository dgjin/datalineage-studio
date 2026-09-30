import { 
  Asset, 
  LineageEdge, 
  MetricDefinition, 
  ChangeEvent, 
  ContractFile, 
  ValidationRule, 
  QualityIssue, 
  CollectorAdapter, 
  NotificationItem 
} from '../types/lineage';

export const INITIAL_ASSETS: Asset[] = [
  // ODS Layer
  {
    id: 'asset:ods_crm_customer',
    code: 'ODS-CRM-CUST-001',
    name: 'ods_crm_customer',
    displayTitle: 'CRM 客户源数据表',
    type: 'TABLE',
    layer: 'ODS',
    space: 'crm',
    owner: '张伟 (CRM架构师)',
    ownerEmail: 'zhangwei@company.com',
    department: '客户运营与CRM研发部',
    status: 'STALE', // flagged due to recent column deprecation
    description: '从业务 CRM 主库直接抽取录入的全量客户基础档案，含敏感脱敏字段与通信联络标识。',
    confidence: 100,
    sourceType: 'CONTRACT',
    downstreamCount: 4,
    upstreamCount: 1,
    createdAt: '2025-10-12 09:30',
    updatedAt: '2026-09-28 14:22',
    isManaged: true,
    tags: ['主数据', '核心实体', '客户360', '监管送报'],
    contractRef: 'contracts/crm/customer.yaml',
    storageFormat: 'PostgreSQL / ORC',
    columns: [
      { id: 'c1', name: 'cust_id', type: 'BIGINT', nullable: false, comment: '统一客户唯一标识符', isPrimary: true, isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'c2', name: 'cust_name', type: 'VARCHAR(128)', nullable: false, comment: '客户真实姓名/企业名称', isPii: true, sensitivity: '秘密', transformType: 'DIRECT' },
      { id: 'c3', name: 'phone', type: 'VARCHAR(20)', nullable: true, comment: '手机号（明文待弃用）', isPii: true, sensitivity: '机密', transformType: 'DIRECT' },
      { id: 'c4', name: 'phone_hash', type: 'VARCHAR(64)', nullable: false, comment: '手机号 SHA256 哈希加盐值', isPii: false, sensitivity: '内部', transformType: 'DIRECT' },
      { id: 'c5', name: 'cert_type', type: 'VARCHAR(8)', nullable: false, comment: '证件类型代码(01-身份证 02-护照)', isPii: false, sensitivity: '内部', transformType: 'DIRECT' },
      { id: 'c6', name: 'cert_no_enc', type: 'VARCHAR(128)', nullable: false, comment: '加密身份证件号码', isPii: true, sensitivity: '机密', transformType: 'DIRECT' },
      { id: 'c7', name: 'cust_status', type: 'VARCHAR(16)', nullable: false, comment: '状态：ACTIVE/FROZEN/CLOSED', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'c8', name: 'created_time', type: 'TIMESTAMP', nullable: false, comment: '注册创建时间戳', isPii: false, sensitivity: '公开', transformType: 'DIRECT' }
    ]
  },
  {
    id: 'asset:ods_trade_order',
    code: 'ODS-TRD-ORD-002',
    name: 'ods_trade_order',
    displayTitle: '交易中台实时流水表',
    type: 'TABLE',
    layer: 'ODS',
    space: 'trade',
    owner: '李博 (交易研发组)',
    ownerEmail: 'libo@company.com',
    department: '交易系统与清结算部',
    status: 'ACTIVE',
    description: '交易结算引擎 CDC 接入的每一笔订单实时变更明细。',
    confidence: 100,
    sourceType: 'OPENLINEAGE',
    downstreamCount: 3,
    upstreamCount: 0,
    createdAt: '2025-11-01 10:00',
    updatedAt: '2026-09-29 11:30',
    isManaged: true,
    tags: ['高频交易', '结算', '核心主链路'],
    contractRef: 'contracts/trade/order.yaml',
    storageFormat: 'Kafka / Iceberg',
    columns: [
      { id: 'to1', name: 'order_id', type: 'VARCHAR(64)', nullable: false, comment: '全局唯一订单编号', isPrimary: true, isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'to2', name: 'cust_id', type: 'BIGINT', nullable: false, comment: '下单客户标识', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'to3', name: 'order_amt', type: 'DECIMAL(18,2)', nullable: false, comment: '订单交易金额(元)', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'to4', name: 'pay_status', type: 'VARCHAR(16)', nullable: false, comment: '支付状态: SUCCESS/FAIL/REFUND', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'to5', name: 'order_time', type: 'TIMESTAMP', nullable: false, comment: '订单创建时间', isPii: false, sensitivity: '公开', transformType: 'DIRECT' }
    ]
  },

  // DWD Layer
  {
    id: 'asset:dwd_customer_info',
    code: 'DWD-CRM-CUST-101',
    name: 'dwd_customer_info',
    displayTitle: '客户域标准化明细表',
    type: 'TABLE',
    layer: 'DWD',
    space: 'crm',
    owner: '陈敏 (数据数仓组)',
    ownerEmail: 'chenmin@company.com',
    department: '大数据平台部',
    status: 'PENDING_CHANGE',
    description: '完成证件清洗、手机号哈希归一化、黑名单风控标记过滤后的全生命周期客户明细宽表。',
    confidence: 98,
    sourceType: 'CONTRACT',
    downstreamCount: 3,
    upstreamCount: 1,
    createdAt: '2025-11-15 14:00',
    updatedAt: '2026-09-28 17:00',
    isManaged: true,
    tags: ['DWD明细', '客户主数据', '合规清洗'],
    contractRef: 'contracts/crm/dwd_customer.yaml',
    storageFormat: 'Hive / Parquet',
    columns: [
      { id: 'dc1', name: 'cust_id', type: 'BIGINT', nullable: false, comment: '统一客户ID', isPrimary: true, isPii: false, sensitivity: '公开', sourceExpr: 'ods_crm_customer.cust_id', transformType: 'DIRECT' },
      { id: 'dc2', name: 'cust_name', type: 'VARCHAR(128)', nullable: false, comment: '客户真实名称', isPii: true, sensitivity: '秘密', sourceExpr: 'TRIM(ods_crm_customer.cust_name)', transformType: 'DIRECT' },
      { id: 'dc3', name: 'masked_phone', type: 'VARCHAR(16)', nullable: true, comment: '脱敏手机号(前三后四)', isPii: false, sensitivity: '内部', sourceExpr: 'CONCAT(LEFT(phone,3), "****", RIGHT(phone,4))', transformType: 'DERIVED' },
      { id: 'dc4', name: 'phone_hash', type: 'VARCHAR(64)', nullable: false, comment: '手机号哈希值', isPii: false, sensitivity: '内部', sourceExpr: 'ods_crm_customer.phone_hash', transformType: 'DIRECT' },
      { id: 'dc5', name: 'is_risk_flagged', type: 'SMALLINT', nullable: false, comment: '是否涉嫌反洗钱预警(0-否 1-是)', isPii: false, sensitivity: '内部', sourceExpr: 'CASE WHEN cust_status="FROZEN" THEN 1 ELSE 0 END', transformType: 'UDF' },
      { id: 'dc6', name: 'register_date', type: 'DATE', nullable: false, comment: '注册日期', isPii: false, sensitivity: '公开', sourceExpr: 'DATE(created_time)', transformType: 'DIRECT' }
    ]
  },
  {
    id: 'asset:dwd_order_detail',
    code: 'DWD-TRD-ORD-102',
    name: 'dwd_order_detail',
    displayTitle: '交易订单规范化事实表',
    type: 'TABLE',
    layer: 'DWD',
    space: 'trade',
    owner: '李博 (交易研发组)',
    ownerEmail: 'libo@company.com',
    department: '大数据平台部',
    status: 'ACTIVE',
    description: '剔除测试单、刷单异常流水后的纯净交易事实，用于所有下游指标汇总。',
    confidence: 100,
    sourceType: 'OPENLINEAGE',
    downstreamCount: 2,
    upstreamCount: 1,
    createdAt: '2025-11-20 16:30',
    updatedAt: '2026-09-29 08:00',
    isManaged: true,
    tags: ['交易事实', '收入确认'],
    contractRef: 'contracts/trade/dwd_order.yaml',
    storageFormat: 'StarRocks',
    columns: [
      { id: 'do1', name: 'order_id', type: 'VARCHAR(64)', nullable: false, comment: '订单号', isPrimary: true, isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'do2', name: 'cust_id', type: 'BIGINT', nullable: false, comment: '客户ID', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'do3', name: 'order_amt', type: 'DECIMAL(18,2)', nullable: false, comment: '实付有效金额', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'do4', name: 'order_time', type: 'TIMESTAMP', nullable: false, comment: '下单时间', isPii: false, sensitivity: '公开', transformType: 'DIRECT' }
    ]
  },

  // DWS Layer
  {
    id: 'asset:dws_customer_metrics_di',
    code: 'DWS-CRM-AGG-201',
    name: 'dws_customer_metrics_di',
    displayTitle: '客户日汇总聚合轻度汇总表',
    type: 'TABLE',
    layer: 'DWS',
    space: 'crm',
    owner: '陈敏 (数据数仓组)',
    ownerEmail: 'chenmin@company.com',
    department: '大数据平台部',
    status: 'ACTIVE',
    description: '按客户维度按天汇聚交易频次、累积资产净值、最近一次活跃度与生命周期评分。',
    confidence: 96,
    sourceType: 'CONTRACT',
    downstreamCount: 3,
    upstreamCount: 2,
    createdAt: '2025-12-01 11:00',
    updatedAt: '2026-09-29 06:15',
    isManaged: true,
    tags: ['聚合事实', '画像基石', '每日计算'],
    contractRef: 'contracts/crm/dws_customer_metrics.yaml',
    storageFormat: 'StarRocks',
    columns: [
      { id: 'dws1', name: 'dt', type: 'DATE', nullable: false, comment: '统计分区日期', isPrimary: true, isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'dws2', name: 'cust_id', type: 'BIGINT', nullable: false, comment: '客户ID', isPrimary: true, isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'dws3', name: 'total_trade_amt_30d', type: 'DECIMAL(18,2)', nullable: false, comment: '近30天累计交易金额', isPii: false, sensitivity: '公开', transformType: 'AGG' },
      { id: 'dws4', name: 'trade_count_30d', type: 'INT', nullable: false, comment: '近30天交易笔数', isPii: false, sensitivity: '公开', transformType: 'AGG' },
      { id: 'dws5', name: 'is_active_customer', type: 'SMALLINT', nullable: false, comment: '是否当期有效活跃客户', isPii: false, sensitivity: '公开', transformType: 'DERIVED' }
    ]
  },

  // ADS Layer
  {
    id: 'asset:ads_vip_customer_portrait',
    code: 'ADS-CRM-VIP-301',
    name: 'ads_vip_customer_portrait',
    displayTitle: '高净值VIP客户画像应用集市',
    type: 'TABLE',
    layer: 'ADS',
    space: 'crm',
    owner: '周宏 (营销分析组)',
    ownerEmail: 'zhouhong@company.com',
    department: '财富管理与零售业务部',
    status: 'ACTIVE',
    description: '直连前台销售工作台、理财经理移动端和智能客服决策引擎的极速宽表。',
    confidence: 99,
    sourceType: 'CONTRACT',
    downstreamCount: 3,
    upstreamCount: 1,
    createdAt: '2026-01-10 15:30',
    updatedAt: '2026-09-29 07:00',
    isManaged: true,
    tags: ['集市层', 'VIP标签', '前端毫秒响应'],
    contractRef: 'contracts/crm/ads_vip_portrait.yaml',
    storageFormat: 'ClickHouse / Redis',
    columns: [
      { id: 'ads1', name: 'cust_id', type: 'BIGINT', nullable: false, comment: '客户ID', isPrimary: true, isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'ads2', name: 'vip_level', type: 'VARCHAR(16)', nullable: false, comment: '客户评级(VIP1-VIP5)', isPii: false, sensitivity: '公开', transformType: 'DERIVED' },
      { id: 'ads3', name: 'recent_trade_amt', type: 'DECIMAL(18,2)', nullable: false, comment: '近30天贡献值', isPii: false, sensitivity: '公开', transformType: 'DIRECT' },
      { id: 'ads4', name: 'churn_risk_score', type: 'FLOAT', nullable: false, comment: 'AI预测流失风险概率(0-1)', isPii: false, sensitivity: '内部', transformType: 'UDF' }
    ]
  },

  // APP / BI / API Layer
  {
    id: 'asset:metric:active_customer_cnt',
    code: 'MET-CRM-ACT-001',
    name: 'metric:active_customer_cnt',
    displayTitle: '当期有效活跃客户数',
    type: 'METRIC',
    layer: 'APP',
    space: 'crm',
    owner: '林峰 (指标主管)',
    ownerEmail: 'linfeng@company.com',
    department: '数据治理与指标委员会',
    status: 'STALE',
    description: '统计期内产生过至少一笔有效订单或登录互动且未注销的独立实名客户总数。',
    confidence: 100,
    sourceType: 'CONTRACT',
    downstreamCount: 2,
    upstreamCount: 2,
    createdAt: '2026-01-15 10:00',
    updatedAt: '2026-09-28 15:30',
    isManaged: true,
    tags: ['北极星指标', 'CEO看板', '监管报送'],
    storageFormat: '指标引擎计算'
  },
  {
    id: 'asset:metric:vip_retention_rate',
    code: 'MET-CRM-VIP-002',
    name: 'metric:vip_retention_rate',
    displayTitle: 'VIP高净值客户月度留存率',
    type: 'METRIC',
    layer: 'APP',
    space: 'crm',
    owner: '林峰 (指标主管)',
    ownerEmail: 'linfeng@company.com',
    department: '数据治理与指标委员会',
    status: 'ACTIVE',
    description: '上月评级为 VIP 且本月仍然保持 VIP 评级标准的客户占比，反映客户粘性。',
    confidence: 95,
    sourceType: 'CONTRACT',
    downstreamCount: 2,
    upstreamCount: 1,
    createdAt: '2026-02-01 11:20',
    updatedAt: '2026-09-25 14:00',
    isManaged: true,
    tags: ['业务核心指标', '季度考核'],
    storageFormat: '指标引擎计算'
  },
  {
    id: 'asset:report:crm_risk_overview',
    code: 'RPT-CRM-RISK-01',
    name: 'report:crm_risk_overview',
    displayTitle: '合规风控与反洗钱监管大屏',
    type: 'REPORT',
    layer: 'APP',
    space: 'risk',
    owner: '赵严 (风控总监)',
    ownerEmail: 'zhaoyan@company.com',
    department: '合规风控部',
    status: 'ACTIVE',
    description: '向管理层与监管审计机构定期报送的反洗钱风险、冻结账户态势大屏。',
    confidence: 100,
    sourceType: 'OPENLINEAGE',
    downstreamCount: 0,
    upstreamCount: 2,
    createdAt: '2026-02-15 14:00',
    updatedAt: '2026-09-29 09:00',
    isManaged: true,
    tags: ['监管审计', '人行直报', '法务保全']
  },
  {
    id: 'asset:api:vip_customer_query',
    code: 'API-CRM-VIP-QUERY',
    name: 'api:vip_customer_query',
    displayTitle: 'VIP 客户实时权益 OpenAPI',
    type: 'API',
    layer: 'APP',
    space: 'crm',
    owner: '张伟 (CRM架构师)',
    ownerEmail: 'zhangwei@company.com',
    department: '中台开放平台部',
    status: 'ACTIVE',
    description: '对外合作银行与联名渠道查询 VIP 身份及当前额度特权的外部 REST API。',
    confidence: 100,
    sourceType: 'CONTRACT',
    downstreamCount: 0,
    upstreamCount: 1,
    createdAt: '2026-03-01 10:00',
    updatedAt: '2026-09-27 16:45',
    isManaged: true,
    tags: ['核心接口', 'SLA 99.99%', '外联渠道']
  },

  // Unmanaged dark-change orphan asset
  {
    id: 'asset:crm_temp_test_dump',
    code: 'UNREG-CRM-TMP-999',
    name: 'crm_temp_test_dump',
    displayTitle: '开发临时调试表 (未纳管暗改)',
    type: 'TABLE',
    layer: 'ODS',
    space: 'crm',
    owner: '未知 (探针检出)',
    department: '未分配',
    status: 'UNMANAGED',
    description: '生产数据库中探针定时对账检出的孤儿表，无契约注册记录，直接暴露在生产只读从库。',
    confidence: 45,
    sourceType: 'CDC_PROBE',
    downstreamCount: 0,
    upstreamCount: 0,
    createdAt: '2026-09-27 03:14',
    updatedAt: '2026-09-27 03:14',
    isManaged: false,
    tags: ['暗改高危', '孤儿资产', '无Owner']
  }
];

export const INITIAL_EDGES: LineageEdge[] = [
  // Table-level edges
  {
    id: 'edge:ods_to_dwd_cust',
    from: 'asset:ods_crm_customer',
    to: 'asset:dwd_customer_info',
    kind: 'TABLE',
    source: 'CONTRACT',
    confidence: 100,
    validFrom: '2025-11-15T00:00:00Z',
    isCriticalPath: true
  },
  {
    id: 'edge:ods_to_dwd_order',
    from: 'asset:ods_trade_order',
    to: 'asset:dwd_order_detail',
    kind: 'TABLE',
    source: 'OPENLINEAGE',
    confidence: 100,
    validFrom: '2025-11-20T00:00:00Z'
  },
  {
    id: 'edge:dwd_cust_to_dws',
    from: 'asset:dwd_customer_info',
    to: 'asset:dws_customer_metrics_di',
    kind: 'TABLE',
    source: 'CONTRACT',
    confidence: 96,
    validFrom: '2025-12-01T00:00:00Z',
    isCriticalPath: true
  },
  {
    id: 'edge:dwd_order_to_dws',
    from: 'asset:dwd_order_detail',
    to: 'asset:dws_customer_metrics_di',
    kind: 'TABLE',
    source: 'CONTRACT',
    confidence: 98,
    validFrom: '2025-12-01T00:00:00Z'
  },
  {
    id: 'edge:dws_to_ads_vip',
    from: 'asset:dws_customer_metrics_di',
    to: 'asset:ads_vip_customer_portrait',
    kind: 'TABLE',
    source: 'CONTRACT',
    confidence: 99,
    validFrom: '2026-01-10T00:00:00Z',
    isCriticalPath: true
  },
  {
    id: 'edge:dwd_cust_to_risk_rpt',
    from: 'asset:dwd_customer_info',
    to: 'asset:report:crm_risk_overview',
    kind: 'TABLE',
    source: 'OPENLINEAGE',
    confidence: 100,
    validFrom: '2026-02-15T00:00:00Z'
  },
  {
    id: 'edge:dws_to_metric_active',
    from: 'asset:dws_customer_metrics_di',
    to: 'asset:metric:active_customer_cnt',
    kind: 'METRIC_REF',
    source: 'CONTRACT',
    confidence: 100,
    validFrom: '2026-01-15T00:00:00Z',
    isCriticalPath: true
  },
  {
    id: 'edge:ads_to_metric_vip_retention',
    from: 'asset:ads_vip_customer_portrait',
    to: 'asset:metric:vip_retention_rate',
    kind: 'METRIC_REF',
    source: 'CONTRACT',
    confidence: 95,
    validFrom: '2026-02-01T00:00:00Z'
  },
  {
    id: 'edge:ads_to_api',
    from: 'asset:ads_vip_customer_portrait',
    to: 'asset:api:vip_customer_query',
    kind: 'TABLE',
    source: 'CONTRACT',
    confidence: 100,
    validFrom: '2026-03-01T00:00:00Z',
    isCriticalPath: true
  },

  // Column-level granular edges
  {
    id: 'edge:col:c1_to_dc1',
    from: 'asset:ods_crm_customer',
    to: 'asset:dwd_customer_info',
    fromCol: 'cust_id',
    toCol: 'cust_id',
    kind: 'COLUMN',
    source: 'CONTRACT',
    confidence: 100,
    transformExpr: 'ods_crm_customer.cust_id',
    validFrom: '2025-11-15T00:00:00Z'
  },
  {
    id: 'edge:col:c3_to_dc3',
    from: 'asset:ods_crm_customer',
    to: 'asset:dwd_customer_info',
    fromCol: 'phone',
    toCol: 'masked_phone',
    kind: 'COLUMN',
    source: 'CONTRACT',
    confidence: 100,
    transformExpr: 'CONCAT(LEFT(phone,3), "****", RIGHT(phone,4))',
    isCriticalPath: true,
    validFrom: '2025-11-15T00:00:00Z'
  },
  {
    id: 'edge:col:c4_to_dc4',
    from: 'asset:ods_crm_customer',
    to: 'asset:dwd_customer_info',
    fromCol: 'phone_hash',
    toCol: 'phone_hash',
    kind: 'COLUMN',
    source: 'CONTRACT',
    confidence: 100,
    transformExpr: 'ods_crm_customer.phone_hash',
    validFrom: '2025-11-15T00:00:00Z'
  },
  {
    id: 'edge:col:dc1_to_dws2',
    from: 'asset:dwd_customer_info',
    to: 'asset:dws_customer_metrics_di',
    fromCol: 'cust_id',
    toCol: 'cust_id',
    kind: 'COLUMN',
    source: 'CONTRACT',
    confidence: 99,
    transformExpr: 'dwd_customer_info.cust_id',
    validFrom: '2025-12-01T00:00:00Z'
  },
  {
    id: 'edge:col:do3_to_dws3',
    from: 'asset:dwd_order_detail',
    to: 'asset:dws_customer_metrics_di',
    fromCol: 'order_amt',
    toCol: 'total_trade_amt_30d',
    kind: 'COLUMN',
    source: 'CONTRACT',
    confidence: 100,
    transformExpr: 'SUM(order_amt)',
    validFrom: '2025-12-01T00:00:00Z'
  }
];

export const INITIAL_METRICS: MetricDefinition[] = [
  {
    code: 'MET-CRM-ACT-001',
    name: '当期有效活跃客户数',
    type: 'COMPOSITE',
    caliberSummary: '统计自然月内完成至少1笔成功交易且未被合规冻结状态的独立实名客户总数。',
    entity: '客户 (CUSTOMER)',
    measureExpr: 'COUNT(DISTINCT cust_id)',
    filterConditions: [
      'cust_status != "FROZEN"',
      'total_trade_amt_30d > 0',
      'is_risk_flagged == 0'
    ],
    dimensions: ['机构层级', '获客渠道', '注册年限'],
    unit: '人 (户)',
    calcType: 'PERIOD',
    frequency: 'MONTHLY',
    caliberSystem: 'INTERNAL',
    owner: '林峰 (指标主管)',
    status: 'PUBLISHED',
    version: 'v2.1',
    upstreamMetrics: ['MET-TRD-ORD-010'],
    referencedColumns: [
      { assetId: 'asset:dws_customer_metrics_di', assetName: 'dws_customer_metrics_di', columnName: 'is_active_customer', confidence: 100 },
      { assetId: 'asset:dwd_customer_info', assetName: 'dwd_customer_info', columnName: 'is_risk_flagged', confidence: 98 },
      { assetId: 'asset:ods_crm_customer', assetName: 'ods_crm_customer', columnName: 'phone', confidence: 85 }
    ],
    downstreamReports: ['经营分析月报', '零售业务高管驾驶舱', '客户全景CRM看板'],
    lastModified: '2026-09-28 15:30',
    historyDiff: [
      {
        version: 'v2.1',
        date: '2026-09-28',
        diff: '将过滤条件由“trade_count_30d > 0”调整为“total_trade_amt_30d > 0”，剔除0元赠品试用单。',
        breakingHistoryData: true
      },
      {
        version: 'v2.0',
        date: '2026-06-01',
        diff: '引入合规风控黑名单过滤逻辑 is_risk_flagged == 0。',
        breakingHistoryData: false
      }
    ]
  },
  {
    code: 'MET-CRM-VIP-002',
    name: 'VIP高净值客户月度留存率',
    type: 'COMPOSITE',
    caliberSummary: 'T期保持VIP评级的客户数量 / T-1期VIP存量客户总数 * 100%',
    entity: '高价值客户 (VIP_CUSTOMER)',
    measureExpr: 'SUM(is_retained_vip) / COUNT(prior_month_vip_total)',
    filterConditions: ['vip_level IN ("VIP3", "VIP4", "VIP5")'],
    dimensions: ['财富中心分支', '理财经理服务组'],
    unit: '%',
    calcType: 'POINT_IN_TIME',
    frequency: 'MONTHLY',
    caliberSystem: 'AMC_EAST',
    owner: '周宏 (营销分析组)',
    status: 'PUBLISHED',
    version: 'v1.4',
    referencedColumns: [
      { assetId: 'asset:ads_vip_customer_portrait', assetName: 'ads_vip_customer_portrait', columnName: 'vip_level', confidence: 99 },
      { assetId: 'asset:ads_vip_customer_portrait', assetName: 'ads_vip_customer_portrait', columnName: 'recent_trade_amt', confidence: 95 }
    ],
    downstreamReports: ['财富客户经营分析', '理财经理KPI考核表'],
    lastModified: '2026-09-25 14:00'
  },
  {
    code: 'MET-TRD-VOL-003',
    name: '近30天累计有效成交规模',
    type: 'ATOMIC',
    caliberSummary: '成功结算的订单总金额，剔除退款退单及测试交易。',
    entity: '交易单 (TRADE_ORDER)',
    measureExpr: 'SUM(order_amt)',
    filterConditions: ['pay_status == "SUCCESS"'],
    dimensions: ['支付方式', '商户分类', '币种'],
    unit: '万元 (CNY)',
    calcType: 'PERIOD',
    frequency: 'DAILY',
    caliberSystem: 'PBOC',
    owner: '李博 (交易研发组)',
    status: 'PUBLISHED',
    version: 'v1.0',
    referencedColumns: [
      { assetId: 'asset:dwd_order_detail', assetName: 'dwd_order_detail', columnName: 'order_amt', confidence: 100 }
    ],
    downstreamReports: ['财务结算月结单', '实时交易监控大屏'],
    lastModified: '2026-09-20 09:15'
  }
];

export const INITIAL_CHANGES: ChangeEvent[] = [
  {
    id: 'chg:20260928-01',
    assetId: 'asset:ods_crm_customer',
    assetName: 'ods_crm_customer',
    changeType: 'DROP_COLUMN',
    details: {
      column: 'phone',
      oldValue: 'VARCHAR(20)',
      newValue: 'NULL (DELETED)',
      rawDiff: '- column: phone\n- type: VARCHAR(20)\n+ # 废弃明文手机号，要求下游迁移至 phone_hash 及 masked_phone'
    },
    detectedBy: 'CI_CONTRACT',
    isBreaking: true,
    isManaged: true,
    status: 'ACK_PENDING',
    actor: '张伟 (CRM架构师)',
    traceId: 'tr-ci-94821a',
    mrUrl: 'https://git.company.com/crm/contracts/pull/128',
    timestamp: '2026-09-28 14:22',
    impactVerdict: 'BLOCKER',
    impactSummary: '此变更拟直接删除 phone 明文列，波及下游 1 个DWD表、1 个核心指标、1 个对外API及监管大屏，建议阻断！',
    affectedCount: {
      metrics: 1,
      reports: 1,
      apis: 1,
      tables: 2
    }
  },
  {
    id: 'chg:20260927-02',
    assetId: 'asset:crm_temp_test_dump',
    assetName: 'crm_temp_test_dump',
    changeType: 'DROP_TABLE',
    details: {
      rawDiff: '+ CREATE TABLE crm_temp_test_dump (id int, secret_note text); [未申报直接执行于生产库]'
    },
    detectedBy: 'PROBE',
    isBreaking: true,
    isManaged: false, // 暗改！
    status: 'DETECTED',
    actor: '未知 (生产从库直接执行)',
    traceId: 'tr-probe-88124b',
    timestamp: '2026-09-27 03:14',
    impactVerdict: 'HIGH',
    impactSummary: '检测到生产库未纳管暗改！DBA或开发绕过契约直接DDL建表，存在数据外泄合规漏洞！',
    affectedCount: {
      metrics: 0,
      reports: 0,
      apis: 0,
      tables: 1
    }
  },
  {
    id: 'chg:20260925-03',
    assetId: 'asset:dwd_order_detail',
    assetName: 'dwd_order_detail',
    changeType: 'ADD_NULLABLE_COLUMN',
    details: {
      column: 'coupon_deduct_amt',
      oldValue: 'NULL',
      newValue: 'DECIMAL(18,2) NULL',
      rawDiff: '+ column: coupon_deduct_amt\n+ type: DECIMAL(18,2)\n+ nullable: true\n+ comment: 营销券扣减金额'
    },
    detectedBy: 'CI_CONTRACT',
    isBreaking: false,
    isManaged: true,
    status: 'RESOLVED',
    actor: '陈敏 (数据数仓组)',
    traceId: 'tr-ci-92144c',
    mrUrl: 'https://git.company.com/crm/contracts/pull/124',
    timestamp: '2026-09-25 10:05',
    impactVerdict: 'SAFE',
    impactSummary: '新增可空列且无历史字段破坏，向下完全兼容，无需审批自动放行。',
    affectedCount: {
      metrics: 0,
      reports: 0,
      apis: 0,
      tables: 0
    }
  }
];

export const INITIAL_RULES: ValidationRule[] = [
  {
    id: 'rule:VR-001',
    code: 'VR-001',
    name: '资产编码格式合规性检查',
    category: 'FORMAT',
    scope: 'ALL_ASSETS',
    severity: 'P0',
    enabled: true,
    expression: `rule "asset.code.format" {
  target:  assets(type in [TABLE, VIEW, METRIC])
  when:    asset.code != null
  assert:  code matches /^[A-Z]{3,4}-[A-Z0-9]+-[A-Z0-9]+-\\d{3,}$/
  severity: P0
  message: "资产编码须符合 <层级/类型>-<数据域>-<分类>-<序号> 规范"
  fixHint: "请在对应 Git 契约文件补齐合规编码（一经分配终身唯一）"
}`,
    description: '强制所有表、视图、指标符合企业唯一命名编码标准，杜绝同名异义与无序注册。',
    fixHint: '检查契约中的 code 属性是否符合命名规约',
    hitCount: 1,
    dryRunHits: [
      { assetId: 'asset:crm_temp_test_dump', assetName: 'crm_temp_test_dump', sampleValue: 'UNREG-CRM-TMP-999', reason: '临时表未按正规编号规约注册，格式异常' }
    ]
  },
  {
    id: 'rule:VR-005',
    code: 'VR-005',
    name: '名称-类型语义一致性检查 (率/比->比例型)',
    category: 'SEMANTIC',
    scope: 'METRIC',
    severity: 'P0',
    enabled: true,
    expression: `rule "metric.name.type.semantic" {
  target:  assets(type == METRIC)
  when:    name matches /.*(率|比|比例|占比)$/
  assert:  unit == "%" || unit == "比例"
  severity: P0
  message: "指标名称含'率/比/占比'时，计量单位必须为 % 或 比例型数值"
  fixHint: "请更正指标口径定义中的 unit 属性"
}`,
    description: '防止指标名称叫“留存率”但单位误填为“人”或金额类型，杜绝汇总报表计算口径错误。',
    fixHint: '在指标卡编辑页校正单位为 %',
    hitCount: 0
  },
  {
    id: 'rule:VR-006',
    code: 'VR-006',
    name: '技术属性成套性校验 (库/表/字段三位一体)',
    category: 'COMPLETENESS',
    scope: 'TABLE',
    severity: 'P1',
    enabled: true,
    expression: `rule "table.tech.attributes.complete" {
  target:  assets(type == TABLE)
  assert:  storageFormat != null && owner != null && contractRef != null
  severity: P1
  message: "生产库表必须具备明确的存储引擎类型、唯一负责人及 Git 契约映射"
  fixHint: "通过补录契约补全 owner 及 contractRef 属性"
}`,
    description: '保障每一个进入数仓的物理表均有负责人与版本受控契约，拒绝无人认领的僵尸资产。',
    fixHint: '在契约补丁中填入明确的 Owner 与研发组',
    hitCount: 1,
    dryRunHits: [
      { assetId: 'asset:crm_temp_test_dump', assetName: 'crm_temp_test_dump', sampleValue: 'storageFormat: null', reason: '缺失 Owner 及 Git 契约文件映射' }
    ]
  },
  {
    id: 'rule:VR-010',
    code: 'VR-010',
    name: '指标依赖 DAG 无环路检测 (Cycle Detection)',
    category: 'DAG_INTEGRITY',
    scope: 'METRIC',
    severity: 'P0',
    enabled: true,
    expression: `rule "metric.dag.acyclic" {
  target:  metrics(type == COMPOSITE)
  assert:  hasNoCircularDependency(upstreamMetrics)
  severity: P0
  message: "检测到复合指标存在环形循环引用，会导致计算死循环"
  fixHint: "检查指标依赖树，切断逆向引用闭环"
}`,
    description: '采用拓扑排序校验指标间引用关系，彻底杜绝 A->B->A 的无限递归计算灾难。',
    fixHint: '梳理指标口径定义，解除环形依赖',
    hitCount: 0
  },
  {
    id: 'rule:VR-013',
    code: 'VR-013',
    name: '契约与物理表结构一致性对账 (Contract vs Reality)',
    category: 'CROSS_SYSTEM',
    scope: 'TABLE',
    severity: 'P0',
    enabled: true,
    expression: `rule "contract.schema.reconcile" {
  target:  assets(isManaged == true)
  assert:  diff(contract.columns, information_schema.columns).isEmpty()
  severity: P0
  message: "生产数据库实际字段与契约声明不符，存在生产暗改飘移"
  fixHint: "在变更中心查看 Diff，并一键反向生成契约补丁"
}`,
    description: 'T2 周期对账生产 information_schema 与 Git 契约快照，捕获绕过契约的暗中 DDL。',
    fixHint: '通过“补录契约”将生产变更反向提交为 Git MR',
    hitCount: 1,
    dryRunHits: [
      { assetId: 'asset:ods_crm_customer', assetName: 'ods_crm_customer', sampleValue: 'Diff: phone missing', reason: '生产从库与契约声明存在版本不一致' }
    ]
  }
];

export const INITIAL_ISSUES: QualityIssue[] = [
  {
    id: 'issue:ISS-2026-031',
    code: 'ISS-2026-031',
    title: 'CRM 客户明细表 phone 字段被删除引发下游断链告警',
    description: '由于契约 MR !128 拟弃用 phone 字段，但指标 MET-CRM-ACT-001 仍有引用，导致 CI 阶段卡点阻止。',
    issueType: 'BREAKING_CHANGE_BLOCK',
    ownerDept: '客户运营与CRM研发部',
    status: 'IN_PROGRESS',
    priority: 'P0',
    affectedAssetId: 'asset:ods_crm_customer',
    affectedAssetName: 'ods_crm_customer',
    createdBy: 'CI 卡点机器人',
    createdAt: '2026-09-28 14:25',
    dueDate: '2026-10-02'
  },
  {
    id: 'issue:ISS-2026-028',
    code: 'ISS-2026-028',
    title: '生产发现未纳管暗改表 crm_temp_test_dump 涉嫌存储明文客户信息',
    description: '探针巡检捕获到非受控数据库对象，需在 24 小时内完成合规归档或物理 DROP 清理。',
    issueType: 'UNMANAGED_DARK_CHANGE',
    ownerDept: '合规风控部 / DBA值班',
    status: 'OPEN',
    priority: 'P0',
    affectedAssetId: 'asset:crm_temp_test_dump',
    affectedAssetName: 'crm_temp_test_dump',
    createdBy: 'CDC 探针巡检系统',
    createdAt: '2026-09-27 03:20',
    dueDate: '2026-09-30'
  }
];

export const INITIAL_COLLECTORS: CollectorAdapter[] = [
  {
    id: 'col:openlineage-kafka',
    name: 'OpenLineage Spark/Flink 运行时总线',
    type: 'OPENLINEAGE',
    mode: 'PUSH',
    status: 'RUNNING',
    capabilities: ['TABLE_LINEAGE', 'COLUMN_LINEAGE', 'RUNTIME_METRICS'],
    lastRunTime: '10秒前 (实时流)',
    totalAssetsDiscovered: 482,
    changesCaptured24h: 34,
    avgLatency: '1.2s',
    healthScore: 99
  },
  {
    id: 'col:jdbc-crm-prod',
    name: 'CRM 生产库 JDBC Schema 定期探针',
    type: 'JDBC_SCHEMA',
    mode: 'PULL',
    status: 'RUNNING',
    capabilities: ['SCHEMA_SNAPSHOT', 'DDL_DRIFT_DETECT'],
    lastRunTime: '2026-09-29 18:00',
    totalAssetsDiscovered: 126,
    changesCaptured24h: 3,
    avgLatency: '450ms',
    healthScore: 100
  },
  {
    id: 'col:debezium-cdc',
    name: 'Debezium CDC DDL 实时捕获器',
    type: 'CDC_DEBEZIUM',
    mode: 'PUSH',
    status: 'RUNNING',
    capabilities: ['DDL_EVENT', 'DARK_CHANGE_ALERTS'],
    lastRunTime: '实时侦听中',
    totalAssetsDiscovered: 89,
    changesCaptured24h: 1,
    avgLatency: '120ms',
    healthScore: 97
  },
  {
    id: 'col:dbt-manifest',
    name: 'dbt Core 模型契约解析器',
    type: 'DBT_MANIFEST',
    mode: 'SCAN',
    status: 'STANDBY',
    capabilities: ['COLUMN_LINEAGE', 'TEST_RESULTS'],
    lastRunTime: '2026-09-29 06:00',
    totalAssetsDiscovered: 310,
    changesCaptured24h: 0,
    avgLatency: '12s',
    healthScore: 100
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif:1',
    severity: 'CRITICAL',
    title: '【CI 阻断预警】ods_crm_customer.phone 拟被删除',
    body: '变更发起人 张伟 (MR !128) 提交了破坏性改动，影响你负责的 1 个指标 (有效客户数) 与 1 个报表。请进行影响确认或申请阶段性豁免。',
    refType: 'IMPACT_ACK',
    refId: 'chg:20260928-01',
    read: false,
    timestamp: '2026-09-28 14:22',
    actions: [
      { label: '确认受影响 (Ack)', action: 'ack', variant: 'primary' },
      { label: '查看影响报告', action: 'view_report', variant: 'secondary' },
      { label: '申请阶段性豁免', action: 'exempt', variant: 'danger' }
    ]
  },
  {
    id: 'notif:2',
    severity: 'HIGH',
    title: '【高危暗改告警】检出生产未纳管表 crm_temp_test_dump',
    body: '探针发现未知人员直接向生产从库 DDL 建表，绕过了 Git 契约。请执行“补录契约”或协调 DBA 执行清理。',
    refType: 'DARK_CHANGE',
    refId: 'chg:20260927-02',
    read: false,
    timestamp: '2026-09-27 03:20',
    actions: [
      { label: '一键生成契约补丁', action: 'generate_patch', variant: 'primary' },
      { label: '查看对账 Diff', action: 'view_diff', variant: 'secondary' }
    ]
  }
];

export const SAMPLE_CONTRACT_YAML = `# ==============================================================
# 数据契约声明 (Data Contract Specification v2.0)
# 域：crm | 实体：ods_crm_customer | 状态：ACTIVE
# ==============================================================
schemaVersion: 2.0
dataset: ods_crm_customer
domain: crm
owner: zhangwei@company.com
team: crm_dev_group
storageEngine: postgresql
updateFrequency: realtime_cdc

columns:
  - name: cust_id
    type: BIGINT
    primaryKey: true
    nullable: false
    description: 统一客户唯一标识符
    sensitivity: PUBLIC
    
  - name: cust_name
    type: VARCHAR(128)
    nullable: false
    description: 客户姓名
    pii: true
    sensitivity: CONFIDENTIAL
    
  - name: phone
    type: VARCHAR(20)
    nullable: true
    description: 手机号 (已废弃，建议迁移至 phone_hash)
    status: DEPRECATED
    pii: true
    sensitivity: HIGHLY_SENSITIVE
    
  - name: phone_hash
    type: VARCHAR(64)
    nullable: false
    description: 手机号加盐 SHA256 哈希值
    sensitivity: INTERNAL
    
  - name: cert_type
    type: VARCHAR(8)
    nullable: false
    description: 证件类型代码 (01-身份证 02-护照)
    
  - name: cert_no_enc
    type: VARCHAR(128)
    nullable: false
    description: 密文身份证号
    pii: true
    sensitivity: HIGHLY_SENSITIVE
    
  - name: cust_status
    type: VARCHAR(16)
    nullable: false
    description: 状态：ACTIVE/FROZEN/CLOSED
    
  - name: created_time
    type: TIMESTAMP
    nullable: false
    description: 注册时间戳

qualityConstraints:
  - rule: unique(cust_id)
  - rule: not_null(cust_status)
  - rule: format(phone_hash, "^[a-f0-9]{64}$")
`;
