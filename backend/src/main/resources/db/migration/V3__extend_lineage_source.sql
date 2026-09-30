-- Extend lineage_edges.source enum with auto-discovery sources:
--   JDBC_FK  : foreign key relationship discovered via JDBC metadata
--   VIEW_DEP : view -> base table dependency from information_schema.VIEW_TABLE_USAGE
-- Note: change_events enums already cover the collector values used
-- (DROP_COLUMN / ADD_*_COLUMN / CHANGE_DATA_TYPE, detected_by='PROBE').
ALTER TABLE lineage_edges
    MODIFY COLUMN source ENUM('CONTRACT','OPENLINEAGE','PARSER','PROBE','JDBC_FK','VIEW_DEP') NOT NULL;
