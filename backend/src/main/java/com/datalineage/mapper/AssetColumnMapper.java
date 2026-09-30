package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.AssetColumnEntity;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AssetColumnMapper extends BaseMapper<AssetColumnEntity> {
    
    @Select("SELECT * FROM asset_columns WHERE asset_id = #{assetId}")
    List<AssetColumnEntity> findByAssetId(@Param("assetId") String assetId);
    
    @Select("SELECT * FROM asset_columns WHERE is_pii = true")
    List<AssetColumnEntity> findPiiColumns();
    
    @Select("SELECT * FROM asset_columns WHERE sensitivity = #{sensitivity}")
    List<AssetColumnEntity> findBySensitivity(@Param("sensitivity") String sensitivity);

    @Delete("DELETE FROM asset_columns WHERE asset_id = #{assetId}")
    int deleteByAssetId(@Param("assetId") String assetId);
}
