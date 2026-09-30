# DataLineage Studio Backend

Universal Data Lineage and Governance Platform Backend API

## 技术栈

- **Java 17**
- **Spring Boot 3.2** - Web framework
- **MyBatis Plus 3.5** - ORM
- **MySQL 8.0** - Database
- **Flyway** - Database migration
- **Druid** - Connection pool
- **Jasypt** - Password encryption
- **Swagger/OpenAPI** - API documentation

## 快速开始

### 前置要求

- JDK 17+
- Maven 3.6+
- MySQL 8.0+ (或使用 Docker)

### 方式一：本地开发

1. **启动 MySQL**
   ```bash
   # 使用 Docker
   docker run -d --name mysql \
     -e MYSQL_ROOT_PASSWORD=root123 \
     -e MYSQL_DATABASE=datalineage \
     -p 3306:3306 \
     mysql:8.0
   ```

2. **启动后端**
   ```bash
   cd backend
   ./start.sh
   ```

3. **验证**
   - API: http://localhost:8080/api/v1
   - Swagger UI: http://localhost:8080/api/v1/swagger-ui.html

### 方式二：Docker Compose（推荐）

```bash
# 启动所有服务（MySQL + Backend + Frontend）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止
docker-compose down
```

## API 文档

启动后访问 Swagger UI：
- http://localhost:8080/api/v1/swagger-ui.html

### 核心 API

| 模块 | 端点 | 说明 |
|------|------|------|
| 资产 | `GET /api/v1/assets` | 资产列表 |
| 资产 | `POST /api/v1/assets` | 创建资产 |
| 血缘 | `GET /api/v1/lineage/edges` | 血缘边列表 |
| 血缘 | `GET /api/v1/lineage/path` | 最短路径 |
| 数据源 | `GET /api/v1/datasources` | 数据源列表 |
| 数据源 | `POST /api/v1/datasources/{id}/test` | 测试连接 |
| 指标 | `GET /api/v1/metrics` | 指标列表 |
| 变更 | `GET /api/v1/changes` | 变更事件 |

## 数据源管理

### 支持的数据源类型

- MySQL
- PostgreSQL
- Oracle
- SQL Server
- Hive
- ClickHouse
- Kafka (规划中)

### 添加数据源

```bash
curl -X POST http://localhost:8080/api/v1/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CRM Production DB",
    "type": "MYSQL",
    "host": "localhost",
    "port": 3306,
    "databaseName": "crm_prod",
    "username": "readonly",
    "password": "secret",
    "sslEnabled": false
  }'
```

### 测试连接

```bash
curl -X POST http://localhost:8080/api/v1/datasources/{id}/test
```

## 元数据采集

### 创建采集任务

```bash
curl -X POST http://localhost:8080/api/v1/collect-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "dataSourceId": "ds-xxx",
    "taskName": "CRM Schema Daily Sync",
    "collectScope": "SCHEMA_ONLY",
    "targetSchemas": ["crm_prod"],
    "autoRegisterAsset": true,
    "defaultLayer": "ODS",
    "defaultSpace": "crm",
    "scheduleCron": "0 0 2 * * ?"
  }'
```

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SPRING_DATASOURCE_URL` | MySQL 连接串 | `jdbc:mysql://localhost:3306/datalineage` |
| `SPRING_DATASOURCE_USERNAME` | 数据库用户名 | `root` |
| `SPRING_DATASOURCE_PASSWORD` | 数据库密码 | `root123` |
| `ENCRYPT_KEY` | 加密密钥 | `datalineage-default-key` |

### 应用配置

编辑 `src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://your-host:3306/datalineage
    username: your-user
    password: your-password
```

## 开发

### 项目结构

```
backend/
├── src/main/java/com/datalineage/
│   ├── DataLineageApplication.java    # 启动类
│   ├── config/                        # 配置
│   ├── controller/                    # REST API
│   ├── service/                       # 业务逻辑
│   ├── collector/                     # 采集引擎
│   ├── entity/                        # 实体
│   ├── mapper/                        # MyBatis Mapper
│   ├── dto/                           # 数据传输对象
│   └── exception/                     # 异常处理
└── src/main/resources/
    ├── application.yml                # 主配置
    ├── mapper/                        # MyBatis XML
    └── db/migration/                  # Flyway 迁移
```

### 编译

```bash
mvn clean compile
```

### 运行测试

```bash
mvn test
```

### 打包

```bash
mvn clean package
```

## 许可证

Apache 2.0
