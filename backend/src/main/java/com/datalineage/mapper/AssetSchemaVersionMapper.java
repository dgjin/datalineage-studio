package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.AssetSchemaVersionEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AssetSchemaVersionMapper extends BaseMapper<AssetSchemaVersionEntity> {

    @Select("SELECT * FROM asset_schema_versions WHERE asset_id = #{assetId} ORDER BY version DESC LIMIT 1")
    AssetSchemaVersionEntity findLatest(@Param("assetId") String assetId);
}
