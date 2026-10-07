package com.datalineage.collector;

import com.datalineage.parser.ModelColumn;
import com.datalineage.parser.ModelParser;
import com.datalineage.parser.ModelTable;
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

/**
 * ERMaster .erm (XML) parser.
 *
 * <p>Parses the design-time ER diagram exported by ERMaster into an in-memory
 * model of tables / columns / relations. Uses StAX streaming so large models
 * (hundreds of tables) parse in constant memory. Unknown elements are skipped
 * for forward compatibility across ERMaster versions.</p>
 *
 * <p>Typical .erm structure:</p>
 * <pre>{@code
 * <diagram>
 *   <contents>
 *     <table>
 *       <name>ods_crm_customer</name>
 *       <physical_name>ods_crm_customer</physical_name>
 *       <columns>
 *         <normal_column>
 *           <physical_name>cust_id</physical_name>
 *           <type>varchar</type>
 *           <length>64</length>
 *           <not_null>true</not_null>
 *           <primary_key>true</primary_key>
 *           <description>客户ID</description>
 *         </normal_column>
 *       </columns>
 *     </table>
 *   </contents>
 * </diagram>
 * }</pre>
 */
@Slf4j
@Component
public class ErMasterXmlParser implements ModelParser {

    @Override
    public String format() {
        return "ERMASTER_XML";
    }

    @Override
    public boolean supports(String fileName, String content) {
        if (fileName != null) {
            String lower = fileName.toLowerCase();
            if (lower.endsWith(".erm")) return true;
        }
        return content != null && (content.contains("<diagram") || content.contains("normal_column"));
    }

    /**
     * Parse raw .erm XML content into a list of model tables.
     * Tolerant of unknown elements and minor schema variations across versions.
     */
    @Override
    public List<ModelTable> parse(String xmlContent) {
        List<ModelTable> tables = new ArrayList<>();
        if (xmlContent == null || xmlContent.trim().isEmpty()) {
            return tables;
        }

        XMLInputFactory factory = XMLInputFactory.newInstance();
        // Disable DTD / external entities for security (XXE prevention)
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);

        try {
            XMLStreamReader reader = factory.createXMLStreamReader(new StringReader(xmlContent));
            ModelTable currentTable = null;
            ModelColumn currentColumn = null;
            StringBuilder text = new StringBuilder();

            while (reader.hasNext()) {
                int event = reader.next();
                switch (event) {
                    case XMLStreamConstants.START_ELEMENT:
                        String localName = reader.getLocalName();
                        if ("table".equals(localName)) {
                            currentTable = new ModelTable();
                            currentTable.setColumns(new ArrayList<>());
                            currentTable.setRelations(new ArrayList<>());
                        } else if ("normal_column".equals(localName) || "column".equals(localName)) {
                            currentColumn = new ModelColumn();
                        }
                        break;

                    case XMLStreamConstants.CHARACTERS:
                        text.append(reader.getText());
                        break;

                    case XMLStreamConstants.END_ELEMENT:
                        String endName = reader.getLocalName();
                        String value = text.toString().trim();
                        text.setLength(0);

                        if (currentColumn != null) {
                            applyColumnField(currentColumn, endName, value);
                            if ("normal_column".equals(endName) || "column".equals(endName)) {
                                if (currentTable != null) {
                                    currentTable.getColumns().add(currentColumn);
                                }
                                currentColumn = null;
                            }
                        } else if (currentTable != null) {
                            applyTableField(currentTable, endName, value);
                            if ("table".equals(endName)) {
                                if (currentTable.getTableName() != null && !currentTable.getTableName().isEmpty()) {
                                    tables.add(currentTable);
                                }
                                currentTable = null;
                            }
                        }
                        break;

                    default:
                        break;
                }
            }
            reader.close();
        } catch (Exception e) {
            log.warn("ERMaster XML parse failed, returning partial result ({} tables): {}", tables.size(), e.getMessage());
        }
        return tables;
    }

    private void applyTableField(ModelTable table, String element, String value) {
        if (value.isEmpty()) return;
        switch (element) {
            case "name":
            case "physical_name":
                // Prefer physical_name (actual DB name); fall back to logical name
                if (table.getTableName() == null || "physical_name".equals(element)) {
                    table.setTableName(value);
                }
                break;
            case "logical_name":
                if (table.getTableName() == null) {
                    table.setTableName(value);
                }
                break;
            case "description":
            case "comment":
                table.setTableComment(value);
                break;
            default:
                break;
        }
    }

    private void applyColumnField(ModelColumn column, String element, String value) {
        if (value.isEmpty()) return;
        switch (element) {
            case "name":
            case "physical_name":
                if (column.getName() == null || "physical_name".equals(element)) {
                    column.setName(value);
                }
                break;
            case "logical_name":
                if (column.getName() == null) {
                    column.setName(value);
                }
                break;
            case "type":
                column.setType(value);
                break;
            case "length":
                try {
                    column.setLength(Integer.parseInt(value));
                } catch (NumberFormatException ignored) {
                    // keep null length
                }
                break;
            case "not_null":
                column.setNullable(!"true".equalsIgnoreCase(value));
                break;
            case "primary_key":
                column.setIsPrimary("true".equalsIgnoreCase(value));
                break;
            case "description":
            case "comment":
                column.setComment(value);
                break;
            default:
                break;
        }
    }
}
