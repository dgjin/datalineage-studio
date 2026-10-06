package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.AssetEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AssetMapper extends BaseMapper<AssetEntity> {
    
    @Select("SELECT * FROM assets WHERE space = #{space} AND layer = #{layer}")
    @ResultMap("mybatis-plus_AssetEntity")
    List<AssetEntity> findBySpaceAndLayer(@Param("space") String space, @Param("layer") String layer);
    
    @Select("SELECT * FROM assets WHERE name LIKE CONCAT('%', #{keyword}, '%') OR display_title LIKE CONCAT('%', #{keyword}, '%')")
    @ResultMap("mybatis-plus_AssetEntity")
    List<AssetEntity> searchByKeyword(@Param("keyword") String keyword);
    
    @Select("SELECT * FROM assets WHERE is_managed = #{isManaged}")
    @ResultMap("mybatis-plus_AssetEntity")
    List<AssetEntity> findByManagedStatus(@Param("isManaged") Boolean isManaged);

    /** Batch-update downstream_count for all assets from lineage_edges. */
    @org.apache.ibatis.annotations.Update("UPDATE assets a SET a.downstream_count = "
            + "(SELECT COUNT(*) FROM lineage_edges e WHERE e.from_asset_id = a.id)")
    void updateDownstreamCounts();

    /** Batch-update upstream_count for all assets from lineage_edges. */
    @org.apache.ibatis.annotations.Update("UPDATE assets a SET a.upstream_count = "
            + "(SELECT COUNT(*) FROM lineage_edges e WHERE e.to_asset_id = a.id)")
    void updateUpstreamCounts();
}
