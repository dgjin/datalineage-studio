package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.LineageEdgeEntity;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface LineageEdgeMapper extends BaseMapper<LineageEdgeEntity> {
    
    @Select("SELECT * FROM lineage_edges WHERE from_asset_id = #{assetId} OR to_asset_id = #{assetId}")
    List<LineageEdgeEntity> findByAssetId(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM lineage_edges WHERE from_asset_id = #{assetId}")
    List<LineageEdgeEntity> findDownstreamEdges(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM lineage_edges WHERE to_asset_id = #{assetId}")
    List<LineageEdgeEntity> findUpstreamEdges(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM lineage_edges WHERE valid_from <= #{time} AND (valid_to IS NULL OR valid_to > #{time})")
    List<LineageEdgeEntity> findValidEdgesAtTime(@Param("time") String time);

    /**
     * Remove auto-discovered edges (FK / view dependency / parsed column lineage) whose
     * endpoints fall under any of the given schemas. Manual and contract-driven edges are never touched.
     */
    @Delete("<script>"
            + "DELETE FROM lineage_edges WHERE source IN ('JDBC_FK','VIEW_DEP','PARSER') AND ("
            + "<foreach collection='schemas' item='s' separator=' OR '>"
            + "from_asset_id LIKE CONCAT('asset:', #{s}, '.%') OR to_asset_id LIKE CONCAT('asset:', #{s}, '.%')"
            + "</foreach>)"
            + "</script>")
    int deleteAutoDiscoveredBySchemas(@Param("schemas") List<String> schemas);
}
