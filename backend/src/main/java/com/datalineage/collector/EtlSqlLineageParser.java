package com.datalineage.collector;

import com.alibaba.druid.DbType;
import com.alibaba.druid.sql.SQLUtils;
import com.alibaba.druid.sql.ast.SQLExpr;
import com.alibaba.druid.sql.ast.SQLStatement;
import com.alibaba.druid.sql.ast.expr.SQLAggregateExpr;
import com.alibaba.druid.sql.ast.expr.SQLAllColumnExpr;
import com.alibaba.druid.sql.ast.expr.SQLIdentifierExpr;
import com.alibaba.druid.sql.ast.expr.SQLPropertyExpr;
import com.alibaba.druid.sql.ast.statement.SQLExprTableSource;
import com.alibaba.druid.sql.ast.statement.SQLInsertStatement;
import com.alibaba.druid.sql.ast.statement.SQLSelectItem;
import com.alibaba.druid.sql.ast.statement.SQLSelectQuery;
import com.alibaba.druid.sql.ast.statement.SQLSelectQueryBlock;
import com.alibaba.druid.sql.ast.statement.SQLTableSource;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Parses ETL statements of the form {@code INSERT INTO target [(cols)] SELECT ... FROM sources}
 * into TABLE / COLUMN lineage, powering the ETL_SQL channel of layer import relations.
 *
 * Scope and degradation rules (prefer missing edges over wrong ones):
 *  - TABLE edges: every plain-table FROM/JOIN source -> target, always produced;
 *  - COLUMN edges: positional mapping when the INSERT column list item count matches the
 *    SELECT list item count; direct column refs get 95 (qualified) / 90 (bare) confidence,
 *    aggregates 90, other expressions 85 with the expression recorded as transform;
 *  - INSERT without a column list, wildcard projection, count mismatch, UNION or
 *    subquery sources degrade to TABLE edges only.
 *
 * Statement-level notes: multiple statements separated by ";" are parsed individually;
 * INSERT ... VALUES statements are ignored (no lineage source).
 */
@Slf4j
@Component
public class EtlSqlLineageParser {

    @Data
    public static class TableRef {
        private String schema;
        private String table;
    }

    /** One INSERT..SELECT statement resolved to lineage. */
    @Data
    public static class InsertLineage {
        private String targetSchema;
        private String targetTable;
        private List<TableRef> sources = new ArrayList<>();
        private List<SqlColumnLineageParser.ColumnMapping> columns = new ArrayList<>();
    }

    /** Parse all INSERT..SELECT statements in the text; unparsable statements are skipped. */
    public List<InsertLineage> parse(String sqlText) {
        List<InsertLineage> result = new ArrayList<>();
        if (sqlText == null || sqlText.trim().isEmpty()) {
            return result;
        }
        try {
            List<SQLStatement> statements = SQLUtils.parseStatements(sqlText, DbType.mysql);
            for (SQLStatement stmt : statements) {
                if (stmt instanceof SQLInsertStatement insert) {
                    InsertLineage lineage = parseInsert(insert);
                    if (lineage != null) {
                        result.add(lineage);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("ETL SQL parse failed: {}", e.getMessage());
        }
        return result;
    }

    private InsertLineage parseInsert(SQLInsertStatement insert) {
        // Target table: schema-qualified when written as db.table, otherwise schema stays null
        // (the caller substitutes the target data source's database name).
        SQLExprTableSource exprTable = insert.getTableSource();
        if (exprTable == null) {
            return null;
        }
        String[] target = resolveQualifiedName(exprTable.getExpr());
        if (target == null || target[1] == null) {
            return null;
        }

        // INSERT ... VALUES carries no lineage source
        if (insert.getQuery() == null) {
            return null;
        }
        SQLSelectQuery query = insert.getQuery().getQuery();
        if (!(query instanceof SQLSelectQueryBlock block)) {
            return null; // UNION / INTERSECT - degrade by skipping
        }

        Map<String, String[]> sources = new LinkedHashMap<>(); // lowercase alias/table -> [schema, table]
        Set<String> knownNames = new LinkedHashSet<>();
        boolean unresolvable = SqlColumnLineageParser.collectSources(block.getFrom(), null, sources, knownNames);
        if (sources.isEmpty()) {
            return null;
        }

        InsertLineage lineage = new InsertLineage();
        lineage.setTargetSchema(target[0]);
        lineage.setTargetTable(target[1]);

        // TABLE edges: de-duplicated source tables -> target
        Set<String> seen = new LinkedHashSet<>();
        for (String[] src : sources.values()) {
            String key = src[0] + "." + src[1];
            if (seen.add(key)) {
                TableRef ref = new TableRef();
                ref.setSchema(src[0]);
                ref.setTable(src[1]);
                lineage.getSources().add(ref);
            }
        }

        if (unresolvable) {
            return lineage; // subquery source: TABLE edges only
        }

        // COLUMN edges: positional mapping between the INSERT column list and the SELECT list
        List<String> targetColumns = new ArrayList<>();
        for (SQLExpr col : insert.getColumns()) {
            targetColumns.add(SqlColumnLineageParser.strip(String.valueOf(col)));
        }
        List<SQLSelectItem> selectList = block.getSelectList();
        if (targetColumns.isEmpty() || targetColumns.size() != selectList.size()) {
            return lineage; // cannot align reliably - TABLE edges only
        }

        for (int i = 0; i < selectList.size(); i++) {
            SQLExpr expr = selectList.get(i).getExpr();
            if (expr instanceof SQLAllColumnExpr) {
                continue;
            }
            if (expr instanceof SQLPropertyExpr p && "*".equals(SqlColumnLineageParser.strip(String.valueOf(p.getName())))) {
                continue;
            }
            Map<String, String[]> refs = SqlColumnLineageParser.collectColumnRefs(expr, knownNames);
            if (refs.isEmpty()) {
                continue;
            }
            boolean direct = refs.size() == 1
                    && (expr instanceof SQLPropertyExpr || expr instanceof SQLIdentifierExpr);
            boolean aggregate = expr instanceof SQLAggregateExpr;
            boolean bareSingle = direct && expr instanceof SQLIdentifierExpr;
            int confidence = direct ? (bareSingle ? 90 : 95) : (aggregate ? 90 : 85);

            for (String[] ref : refs.values()) {
                String[] src = resolveSource(ref[0], sources);
                if (src == null) {
                    continue; // ambiguous across multiple sources
                }
                SqlColumnLineageParser.ColumnMapping mapping = new SqlColumnLineageParser.ColumnMapping();
                mapping.setTargetColumn(targetColumns.get(i));
                mapping.setSourceSchema(src[0]);
                mapping.setSourceTable(src[1]);
                mapping.setSourceColumn(ref[1]);
                mapping.setConfidence(confidence);
                mapping.setTransformExpr(direct ? null : SqlColumnLineageParser.trimExpr(expr));
                lineage.getColumns().add(mapping);
            }
        }
        return lineage;
    }

    /** Resolve an expr like `db`.`tbl` / tbl to [schema|null, table]. */
    private String[] resolveQualifiedName(SQLExpr expr) {
        if (expr instanceof SQLPropertyExpr p) {
            String table = SqlColumnLineageParser.strip(String.valueOf(p.getName()));
            String schema = null;
            if (p.getOwner() != null && !(p.getOwner() instanceof SQLPropertyExpr)) {
                schema = SqlColumnLineageParser.strip(String.valueOf(p.getOwner()));
            }
            return new String[]{schema, table};
        }
        if (expr instanceof SQLIdentifierExpr i) {
            return new String[]{null, SqlColumnLineageParser.strip(i.getName())};
        }
        return null;
    }

    /** Resolve the owning qualifier to a registered source; single-source FROM may omit it. */
    private String[] resolveSource(String owner, Map<String, String[]> sources) {
        if (owner != null && !owner.isEmpty()) {
            return sources.get(owner.toLowerCase());
        }
        if (sources.size() == 1) {
            return sources.values().iterator().next();
        }
        return null; // ambiguous across multiple sources
    }
}
