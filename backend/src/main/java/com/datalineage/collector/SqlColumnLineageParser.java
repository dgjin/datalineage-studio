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
import com.alibaba.druid.sql.ast.statement.SQLJoinTableSource;
import com.alibaba.druid.sql.ast.statement.SQLSelectItem;
import com.alibaba.druid.sql.ast.statement.SQLSelectQuery;
import com.alibaba.druid.sql.ast.statement.SQLSelectQueryBlock;
import com.alibaba.druid.sql.ast.statement.SQLSelectStatement;
import com.alibaba.druid.sql.ast.statement.SQLTableSource;
import com.alibaba.druid.sql.visitor.SQLASTVisitorAdapter;
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
 * Extracts column-level lineage from view definition SQL using the Druid SQL parser
 * (already on the classpath via druid-spring-boot-starter - no new dependency).
 *
 * Phase-1 scope and degradation rules:
 *  - handles single-level SELECT statements with JOINs, aggregates and scalar expressions;
 *  - supports both qualified ("o"."id") and bare ("id", single-source FROM) column references;
 *  - wildcard projections ("*" / "t.*") are skipped - they cannot be resolved reliably;
 *  - if any FROM source is not a plain table (subquery, derived table, UNION ...) the whole
 *    view is skipped, preferring missing edges over wrong ones.
 *
 * Confidence: direct single-column mapping 95 (qualified) / 90 (bare), SQLAggregateExpr
 * over a single column 90, any other expression 85. Callers may route low-confidence
 * edges to manual review.
 */
@Slf4j
@Component
public class SqlColumnLineageParser {

    /** SQL words that can surface as bare identifiers inside expressions but are not columns. */
    private static final Set<String> SQL_KEYWORDS = Set.of(
            "case", "when", "then", "else", "end", "and", "or", "not", "is", "null",
            "true", "false", "in", "like", "between", "as", "on", "distinct", "interval",
            "current_date", "current_time", "current_timestamp", "localtime", "localtimestamp");

    @Data
    public static class ColumnMapping {
        private String targetColumn;
        private String sourceSchema;
        private String sourceTable;
        private String sourceColumn;
        private int confidence;
        private String transformExpr;
    }

    /**
     * @param viewSql       view definition SQL (e.g. MySQL information_schema.VIEWS.VIEW_DEFINITION)
     * @param defaultSchema schema assumed for unqualified source tables
     * @return one mapping per (source column -> target column) pair
     */
    public List<ColumnMapping> parseView(String viewSql, String defaultSchema) {
        List<ColumnMapping> result = new ArrayList<>();
        if (viewSql == null || viewSql.trim().isEmpty()) {
            return result;
        }
        try {
            SQLStatement stmt = SQLUtils.parseSingleStatement(viewSql, DbType.mysql);
            if (!(stmt instanceof SQLSelectStatement selectStmt)) {
                return result;
            }
            SQLSelectQuery query = selectStmt.getSelect().getQuery();
            if (!(query instanceof SQLSelectQueryBlock block)) {
                return result; // UNION / INTERSECT etc. - degrade by skipping
            }

            Map<String, String[]> sources = new LinkedHashMap<>(); // lowercase alias/table -> [schema, table]
            Set<String> knownNames = new LinkedHashSet<>();        // aliases + table + schema names
            boolean unresolvable = collectSources(block.getFrom(), defaultSchema, sources, knownNames);
            if (sources.isEmpty() || unresolvable) {
                return result;
            }

            for (SQLSelectItem item : block.getSelectList()) {
                SQLExpr expr = item.getExpr();
                if (expr instanceof SQLAllColumnExpr) {
                    continue;
                }
                if (expr instanceof SQLPropertyExpr p && "*".equals(strip(String.valueOf(p.getName())))) {
                    continue;
                }

                String target = item.getAlias() != null ? strip(item.getAlias()) : inferName(expr);
                if (target == null || target.isEmpty()) {
                    continue;
                }

                // Collect column references: {owner or null, column}, de-duplicated by owner.column
                Map<String, String[]> refs = new LinkedHashMap<>();
                expr.accept(new SQLASTVisitorAdapter() {
                    @Override
                    public boolean visit(SQLPropertyExpr x) {
                        String name = strip(String.valueOf(x.getName()));
                        if (name == null || name.isEmpty()
                                || "*".equals(name) || knownNames.contains(name.toLowerCase())) {
                            return true;
                        }
                        refs.putIfAbsent(ownerName(x) + "." + name, new String[]{ownerName(x), name});
                        return true;
                    }

                    @Override
                    public boolean visit(SQLIdentifierExpr x) {
                        String name = strip(x.getName());
                        if (name == null || name.isEmpty()
                                || knownNames.contains(name.toLowerCase())
                                || SQL_KEYWORDS.contains(name.toLowerCase())) {
                            return true;
                        }
                        refs.putIfAbsent("." + name, new String[]{null, name});
                        return true;
                    }
                });
                if (refs.isEmpty()) {
                    continue; // literal-only projection (e.g. constant), no lineage
                }

                boolean direct = refs.size() == 1
                        && (expr instanceof SQLPropertyExpr || expr instanceof SQLIdentifierExpr);
                boolean aggregate = expr instanceof SQLAggregateExpr;
                boolean bareSingle = direct && expr instanceof SQLIdentifierExpr;
                int confidence = direct ? (bareSingle ? 90 : 95) : (aggregate ? 90 : 85);

                for (String[] ref : refs.values()) {
                    String[] src = resolveSource(ref[0], sources);
                    if (src == null) {
                        continue;
                    }
                    ColumnMapping mapping = new ColumnMapping();
                    mapping.setTargetColumn(target);
                    mapping.setSourceSchema(src[0]);
                    mapping.setSourceTable(src[1]);
                    mapping.setSourceColumn(ref[1]);
                    mapping.setConfidence(confidence);
                    mapping.setTransformExpr(direct ? null : trimExpr(expr));
                    result.add(mapping);
                }
            }
        } catch (Exception e) {
            log.debug("Column lineage parse failed (schema={}): {}", defaultSchema, e.getMessage());
        }
        return result;
    }

    /**
     * Walk the FROM tree and register [schema, table] per alias.
     *
     * @return true when a source cannot be resolved as a plain table (subquery etc.)
     */
    private boolean collectSources(SQLTableSource source, String defaultSchema,
                                   Map<String, String[]> sources, Set<String> knownNames) {
        if (source == null) {
            return false;
        }
        if (source instanceof SQLExprTableSource tableSource) {
            SQLExpr expr = tableSource.getExpr();
            String schema = defaultSchema;
            String table = null;
            if (expr instanceof SQLPropertyExpr p) {
                table = strip(String.valueOf(p.getName()));
                if (p.getOwner() != null && !(p.getOwner() instanceof SQLPropertyExpr)) {
                    schema = strip(String.valueOf(p.getOwner()));
                }
            } else if (expr instanceof SQLIdentifierExpr i) {
                table = strip(String.valueOf(i.getName()));
            }
            if (table == null || table.isEmpty()) {
                return false;
            }
            String alias = tableSource.getAlias() != null ? strip(tableSource.getAlias()) : table;
            sources.put(alias.toLowerCase(), new String[]{schema, table});
            knownNames.add(alias.toLowerCase());
            knownNames.add(table.toLowerCase());
            knownNames.add(schema.toLowerCase());
            if (!alias.equalsIgnoreCase(table)) {
                sources.putIfAbsent(table.toLowerCase(), new String[]{schema, table});
            }
            return false;
        }
        if (source instanceof SQLJoinTableSource join) {
            boolean leftBad = collectSources(join.getLeft(), defaultSchema, sources, knownNames);
            boolean rightBad = collectSources(join.getRight(), defaultSchema, sources, knownNames);
            return leftBad || rightBad;
        }
        return true; // subquery / derived table - cannot attribute columns reliably
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

    private String ownerName(SQLPropertyExpr ref) {
        SQLExpr owner = ref.getOwner();
        if (owner == null) {
            return null;
        }
        if (owner instanceof SQLIdentifierExpr i) {
            return strip(i.getName());
        }
        if (owner instanceof SQLPropertyExpr p) {
            return strip(String.valueOf(p.getName()));
        }
        return strip(String.valueOf(owner));
    }

    private String inferName(SQLExpr expr) {
        if (expr instanceof SQLPropertyExpr p) {
            return strip(String.valueOf(p.getName()));
        }
        if (expr instanceof SQLIdentifierExpr i) {
            return strip(i.getName());
        }
        return null;
    }

    private String trimExpr(SQLExpr expr) {
        String text = strip(String.valueOf(expr));
        text = text.replaceAll("\\s+", " ").trim();
        return text.length() > 300 ? text.substring(0, 300) : text;
    }

    private static String strip(String s) {
        if (s == null) {
            return null;
        }
        return s.replace("`", "").trim();
    }
}
