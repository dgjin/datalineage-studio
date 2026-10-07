package com.datalineage.parser;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PowerDesigner Physical Data Model (.pdm, XML) parser.
 *
 * <p>Real .pdm files use namespaced elements such as {@code <o:Table>},
 * {@code <o:Column>}, {@code <o:Reference>}, {@code <o:ReferenceJoin>}; only
 * local names are inspected so namespace/version differences are tolerated.
 * Column physical names come from {@code <a:Code>} (falling back to
 * {@code <a:Name>}), types from {@code <a:DataType>} (e.g. "VARCHAR2(64)"),
 * nullability from {@code <a:Column.Mandatory>}, primary keys from
 * {@code <c:PrimaryKey>}/{@code <c:Keys>}, and foreign keys from
 * {@code <o:Reference>} (Parent/ChildTable + ReferenceJoin column pairs).
 * Uses StAX streaming (constant memory) with DTD/external entities disabled.</p>
 */
@Slf4j
@Component
public class PowerDesignerPdmParser implements ModelParser {

    /** "VARCHAR2(64)" / "NUMBER(10,2)" -> base type + first length token. */
    private static final Pattern TYPE_PATTERN =
            Pattern.compile("^([A-Za-z0-9_ ]+)\\s*(?:\\((\\d+)(?:\\s*,\\s*\\d+)?\\))?");

    @Override
    public String format() {
        return "PD_PDM";
    }

    @Override
    public boolean supports(String fileName, String content) {
        if (fileName != null && fileName.toLowerCase().endsWith(".pdm")) {
            return true;
        }
        return content != null
                && content.contains("<o:RootObject")
                && (content.contains("PhysicalDataModel") || content.contains("<o:Table"));
    }

    @Override
    public List<ModelTable> parse(String content) {
        List<ModelTable> tables = new ArrayList<>();
        if (content == null || content.trim().isEmpty()) {
            return tables;
        }

        XMLInputFactory factory = XMLInputFactory.newInstance();
        // Disable DTD / external entities for security (XXE prevention)
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);

        // Document context
        ModelTable currentTable = null;
        String currentTableId = null;
        ModelColumn currentColumn = null;
        String currentColumnId = null;
        boolean inTables = false;
        boolean inColumns = false;
        boolean inKeys = false;
        boolean inIndexes = false;
        boolean inKeyColumns = false;

        // Key / primary-key state (Key ids are globally unique in a .pdm)
        String currentKeyId = null;
        List<String> currentKeyColumnRefs = null;
        final Map<String, List<String>> keyColumnDefs = new HashMap<>();
        String primaryKeyRef = null;
        boolean inTablePrimaryKey = false;

        // Cross-element resolvers
        final Map<String, String> tableIdByName = new HashMap<>();      // table id -> table name
        final Map<String, ModelTable> tableByName = new HashMap<>();    // table name -> table
        final Map<String, String[]> columnOwner = new HashMap<>();      // column id -> [tableId, columnName]
        final Map<String, ModelColumn> columnById = new HashMap<>();    // column id -> column object

        // Reference parsing state
        boolean inReferences = false;
        RefBuilder currentRef = null;
        String refSide = null;           // "parent" | "child" while inside ParentTable/ChildTable
        String[] joinCols = null;        // current ReferenceJoin column refs
        int joinSide = 0;                // 1 = Object1, 2 = Object2

        StringBuilder text = new StringBuilder();

        try {
            XMLStreamReader reader = factory.createXMLStreamReader(new StringReader(content));
            while (reader.hasNext()) {
                int event = reader.next();
                switch (event) {
                    case XMLStreamConstants.START_ELEMENT: {
                        String local = reader.getLocalName();
                        String ref = reader.getAttributeValue(null, "Ref");
                        String id = reader.getAttributeValue(null, "Id");
                        switch (local) {
                            case "Tables":
                                if (!inReferences) inTables = true;
                                break;
                            case "Keys":
                                if (currentTable != null) inKeys = true;
                                break;
                            case "Indexes":
                                if (currentTable != null) inIndexes = true;
                                break;
                            case "Columns":
                                // Inside a Key this is the key-column collection; inside a
                                // table body it is the ordinary column collection.
                                if (inKeys) {
                                    inKeyColumns = true;
                                } else if (currentTable != null && !inIndexes && !inColumns) {
                                    inColumns = true;
                                }
                                break;
                            case "Key.Columns":
                                if (inKeys) inKeyColumns = true;
                                break;
                            case "Table":
                                if (ref != null) {
                                    // <o:Table Ref=".."/> placeholder inside a Reference
                                    if (currentRef != null) {
                                        if ("child".equals(refSide)) currentRef.childTableId = ref;
                                        else if ("parent".equals(refSide)) currentRef.parentTableId = ref;
                                    }
                                } else if (inTables) {
                                    currentTable = new ModelTable();
                                    currentTable.setColumns(new ArrayList<>());
                                    currentTable.setRelations(new ArrayList<>());
                                    currentTableId = id;
                                }
                                break;
                            case "Column":
                                if (ref != null) {
                                    // Column reference: key columns or foreign-key join columns
                                    if (inKeyColumns && currentKeyColumnRefs != null) {
                                        currentKeyColumnRefs.add(ref);
                                    } else if (joinCols != null) {
                                        if (joinSide == 1) joinCols[0] = ref;
                                        else if (joinSide == 2) joinCols[1] = ref;
                                    }
                                } else if (inColumns && currentTable != null) {
                                    currentColumn = new ModelColumn();
                                    currentColumnId = id;
                                }
                                break;
                            case "Key":
                                if (inKeys && ref == null) {
                                    currentKeyId = id;
                                    currentKeyColumnRefs = new ArrayList<>();
                                } else if (ref != null && inTablePrimaryKey) {
                                    primaryKeyRef = ref;
                                }
                                break;
                            case "PrimaryKey":
                                // Table-level c:PrimaryKey collection (column-level a:PrimaryKey is text-handled)
                                if (currentColumn == null) inTablePrimaryKey = true;
                                break;
                            case "References":
                                inReferences = true;
                                break;
                            case "Reference":
                                if (inReferences) currentRef = new RefBuilder();
                                break;
                            case "ParentTable":
                                // Real .pdm form: self-closing <o:ParentTable Ref="o10"/>
                                if (ref != null && currentRef != null) {
                                    currentRef.parentTableId = ref;
                                }
                                refSide = "parent";
                                break;
                            case "ChildTable":
                                if (ref != null && currentRef != null) {
                                    currentRef.childTableId = ref;
                                }
                                refSide = "child";
                                break;
                            case "ReferenceJoin":
                                if (currentRef != null) joinCols = new String[2];
                                break;
                            case "Object1":
                                if (joinCols != null) joinSide = 1;
                                break;
                            case "Object2":
                                if (joinCols != null) joinSide = 2;
                                break;
                            default:
                                break;
                        }
                        break;
                    }

                    case XMLStreamConstants.CHARACTERS:
                        text.append(reader.getText());
                        break;

                    case XMLStreamConstants.END_ELEMENT: {
                        String local = reader.getLocalName();
                        String value = text.toString().trim();
                        text.setLength(0);

                        if (currentColumn != null) {
                            applyColumnField(currentColumn, local, value);
                        } else if (currentTable != null && !inReferences && !inKeys && !inIndexes && !inTablePrimaryKey) {
                            // Guard: Key/Index Name+Code elements must not overwrite the table name
                            applyTableField(currentTable, local, value);
                        }

                        switch (local) {
                            case "Columns":
                                if (inColumns) inColumns = false;
                                if (inKeyColumns) inKeyColumns = false;
                                break;
                            case "Key.Columns":
                                if (inKeyColumns) inKeyColumns = false;
                                break;
                            case "Keys":
                                if (inKeys) inKeys = false;
                                break;
                            case "Indexes":
                                if (inIndexes) inIndexes = false;
                                break;
                            case "PrimaryKey":
                                if (inTablePrimaryKey) inTablePrimaryKey = false;
                                break;
                            case "Key":
                                if (currentKeyId != null) {
                                    keyColumnDefs.put(currentKeyId, currentKeyColumnRefs);
                                    currentKeyId = null;
                                    currentKeyColumnRefs = null;
                                }
                                break;
                            case "Column":
                                if (currentColumn != null) {
                                    if (currentColumn.getName() != null && !currentColumn.getName().isEmpty()) {
                                        currentTable.getColumns().add(currentColumn);
                                        columnOwner.put(currentColumnId,
                                                new String[]{currentTableId, currentColumn.getName()});
                                        columnById.put(currentColumnId, currentColumn);
                                    }
                                    currentColumn = null;
                                    currentColumnId = null;
                                }
                                break;
                            case "Table":
                                if (currentTable != null) {
                                    // Mark primary-key columns (keys are parsed before the table closes)
                                    if (primaryKeyRef != null) {
                                        List<String> pkCols = keyColumnDefs.get(primaryKeyRef);
                                        if (pkCols != null) {
                                            for (String colRef : pkCols) {
                                                ModelColumn col = columnById.get(colRef);
                                                if (col != null) col.setIsPrimary(true);
                                            }
                                        }
                                        primaryKeyRef = null;
                                    }
                                    if (currentTable.getTableName() != null && !currentTable.getTableName().isEmpty()) {
                                        tables.add(currentTable);
                                        tableByName.put(currentTable.getTableName(), currentTable);
                                        if (currentTableId != null) {
                                            tableIdByName.put(currentTableId, currentTable.getTableName());
                                        }
                                    }
                                    currentTable = null;
                                    currentTableId = null;
                                }
                                if (refSide != null) refSide = null;
                                break;
                            case "ReferenceJoin":
                                if (currentRef != null && joinCols != null
                                        && (joinCols[0] != null || joinCols[1] != null)) {
                                    currentRef.joinPairs.add(joinCols);
                                }
                                joinCols = null;
                                joinSide = 0;
                                break;
                            case "Object1":
                            case "Object2":
                                joinSide = 0;
                                break;
                            case "ParentTable":
                            case "ChildTable":
                                refSide = null;
                                break;
                            case "Reference":
                                if (currentRef != null) {
                                    attachRelations(currentRef, tableByName, tableIdByName, columnOwner);
                                    currentRef = null;
                                }
                                break;
                            case "References":
                                if (inReferences) inReferences = false;
                                break;
                            case "Tables":
                                inTables = false;
                                break;
                            default:
                                break;
                        }
                        break;
                    }

                    default:
                        break;
                }
            }
            reader.close();
        } catch (Exception e) {
            log.warn("PowerDesigner PDM parse failed, returning partial result ({} tables): {}",
                    tables.size(), e.getMessage());
        }
        return tables;
    }

    /**
     * Attach one foreign-key relation onto its child table, normalized to the
     * DB-FK direction: from = child (FK holder), to = parent (referenced).
     */
    private void attachRelations(RefBuilder ref, Map<String, ModelTable> tableByName,
                                 Map<String, String> tableIdByName,
                                 Map<String, String[]> columnOwner) {
        if (ref.joinPairs.isEmpty() || ref.childTableId == null || ref.parentTableId == null) {
            return;
        }
        String childName = tableIdByName.get(ref.childTableId);
        String parentName = tableIdByName.get(ref.parentTableId);
        if (childName == null || parentName == null) {
            return;
        }
        ModelTable childTable = tableByName.get(childName);
        if (childTable == null || childTable.getRelations() == null) {
            return;
        }

        for (String[] pair : ref.joinPairs) {
            String[] o1 = pair[0] != null ? columnOwner.get(pair[0]) : null;
            String[] o2 = pair[1] != null ? columnOwner.get(pair[1]) : null;
            if (o1 == null && o2 == null) continue;

            String fromCol;
            String toCol;
            if (o1 != null && ref.childTableId.equals(o1[0])) {
                fromCol = o1[1];
                toCol = o2 != null ? o2[1] : null;
            } else if (o2 != null && ref.childTableId.equals(o2[0])) {
                fromCol = o2[1];
                toCol = o1 != null ? o1[1] : null;
            } else if (o1 != null && o2 != null) {
                // Ownership mismatch: PowerDesigner convention is Object1 = parent key column,
                // Object2 = child FK column
                fromCol = o2[1];
                toCol = o1[1];
            } else {
                continue;
            }

            Map<String, String> relation = new HashMap<>();
            relation.put("fromTable", childName);
            relation.put("fromCol", fromCol);
            relation.put("toTable", parentName);
            relation.put("toCol", toCol);
            childTable.getRelations().add(relation);
        }
    }

    private void applyTableField(ModelTable table, String element, String value) {
        if (value.isEmpty()) return;
        switch (element) {
            case "Code":
                table.setTableName(value);
                break;
            case "Name":
                if (table.getTableName() == null) table.setTableName(value);
                break;
            case "Comment":
                table.setTableComment(value);
                break;
            default:
                break;
        }
    }

    private void applyColumnField(ModelColumn column, String element, String value) {
        if (value.isEmpty()) return;
        switch (element) {
            case "Code":
                column.setName(value);
                break;
            case "Name":
                if (column.getName() == null) column.setName(value);
                break;
            case "DataType":
                applyDataType(column, value);
                break;
            case "Column.Mandatory":
                column.setNullable(!"1".equals(value));
                break;
            case "PrimaryKey":
                column.setIsPrimary("1".equals(value));
                break;
            case "Comment":
                column.setComment(value);
                break;
            default:
                break;
        }
    }

    /** "VARCHAR2(64)" -> type=VARCHAR2 length=64; "NUMBER(10,2)" -> type=NUMBER length=10. */
    private void applyDataType(ModelColumn column, String dataType) {
        Matcher m = TYPE_PATTERN.matcher(dataType.trim());
        if (m.find()) {
            column.setType(m.group(1).trim());
            if (m.group(2) != null) {
                try {
                    column.setLength(Integer.parseInt(m.group(2)));
                } catch (NumberFormatException ignored) {
                    // keep null length
                }
            }
        } else {
            column.setType(dataType);
        }
    }

    /** Mutable foreign-key accumulator resolved when the Reference element ends. */
    private static class RefBuilder {
        String parentTableId;
        String childTableId;
        final List<String[]> joinPairs = new ArrayList<>();
    }
}
