package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.LineageEdgeEntity;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface LineageEdgeMapper extends BaseMapper<LineageEdgeEntity> {
    
    @Select("SELECT * FROM lineage_edges WHERE (from_asset_id = #{assetId} OR to_asset_id = #{assetId}) AND valid_to IS NULL")
    List<LineageEdgeEntity> findByAssetId(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM lineage_edges WHERE from_asset_id = #{assetId} AND valid_to IS NULL")
    List<LineageEdgeEntity> findDownstreamEdges(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM lineage_edges WHERE to_asset_id = #{assetId} AND valid_to IS NULL")
    List<LineageEdgeEntity> findUpstreamEdges(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM lineage_edges WHERE valid_from <= #{time} AND (valid_to IS NULL OR valid_to > #{time})")
    List<LineageEdgeEntity> findValidEdgesAtTime(@Param("time") String time);

    /**
     * Recompute is_critical_path for every edge. Edges that cross warehouse layers
     * (ODS->DWD, DWD->DWS, DWS->ADS trunk pipelines) are marked as critical paths;
     * same-layer edges are not. Critical edges drive M3 critical impact-path rendering.
     */
    @Update("UPDATE lineage_edges e "
            + "JOIN assets fa ON e.from_asset_id = fa.id "
            + "JOIN assets ta ON e.to_asset_id = ta.id "
            + "SET e.is_critical_path = (fa.layer <> ta.layer)")
    void refreshCriticalPathFlags();

    /**
     * Retire (soft-invalidate) auto-discovered edges whose endpoints fall under any of
     * the given schemas. Unlike a physical delete, retired rows are kept so bi-temporal
     * time-travel queries still see the historical graph; edges reproduced by the current
     * run are revived in place. Manual and contract-driven edges are never touched.
     */
    @Update("<script>"
            + "UPDATE lineage_edges SET valid_to = NOW() WHERE valid_to IS NULL "
            + "AND source IN ('JDBC_FK','VIEW_DEP','PARSER') AND ("
            + "<foreach collection='schemas' item='s' separator=' OR '>"
            + "from_asset_id LIKE CONCAT('asset:', #{s}, '.%') OR to_asset_id LIKE CONCAT('asset:', #{s}, '.%')"
            + "</foreach>)"
            + "</script>")
    int retireAutoDiscoveredBySchemas(@Param("schemas") List<String> schemas);

    /**
     * Latest historical edge for the same (from,to,kind,from_column,to_column) tuple,
     * including retired rows — used to revive an edge instead of inserting a duplicate.
     * The &lt;=&gt; comparator is NULL-safe for table-level edges without columns.
     */
    @Select("SELECT * FROM lineage_edges WHERE from_asset_id = #{fromAssetId} AND to_asset_id = #{toAssetId} "
            + "AND kind = #{kind} AND (from_column <=> #{fromColumn}) AND (to_column <=> #{toColumn}) "
            + "ORDER BY valid_from DESC LIMIT 1")
    LineageEdgeEntity findLatestByFiveTuple(@Param("fromAssetId") String fromAssetId,
                                            @Param("toAssetId") String toAssetId,
                                            @Param("kind") String kind,
                                            @Param("fromColumn") String fromColumn,
                                            @Param("toColumn") String toColumn);

    /**
     * Revive a retired edge: clear valid_to, refresh valid_from/last_seen_at and restore
     * confidence to the freshly re-discovered value.
     */
    @Update("UPDATE lineage_edges SET valid_to = NULL, valid_from = NOW(), last_seen_at = NOW(), "
            + "confidence = #{confidence} WHERE id = #{id}")
    int reviveEdge(@Param("id") String id, @Param("confidence") Integer confidence);

    /**
     * Confidence decay + expiry for auto-discovered edges not reproduced within the
     * retention window: retire the edge and decay confidence by 20 (floor 20).
     */
    @Update("UPDATE lineage_edges SET valid_to = NOW(), "
            + "confidence = GREATEST(COALESCE(confidence, 100) - 20, 20) "
            + "WHERE valid_to IS NULL AND source IN ('JDBC_FK','VIEW_DEP','PARSER') "
            + "AND last_seen_at IS NOT NULL AND last_seen_at < DATE_SUB(NOW(), INTERVAL #{days} DAY)")
    int expireStaleAutoEdges(@Param("days") int days);

    /**
     * Remove cross-source edges produced by a layer import relation. The edge set is
     * scoped by (source kind + endpoints inside the declared from/to source-layer
     * boxes), so manual, contract and single-source edges are never touched.
     */
    @Delete("DELETE FROM lineage_edges WHERE source = #{source} "
            + "AND from_asset_id IN (SELECT id FROM assets WHERE data_source_id = #{fromDs} AND layer = #{fromLayer}) "
            + "AND to_asset_id IN (SELECT id FROM assets WHERE data_source_id = #{toDs} AND layer = #{toLayer})")
    int deleteRelationEdges(@Param("source") String source,
                            @Param("fromDs") String fromDs, @Param("fromLayer") String fromLayer,
                            @Param("toDs") String toDs, @Param("toLayer") String toLayer);
}
