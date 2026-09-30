package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.MetricEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MetricMapper extends BaseMapper<MetricEntity> {

    @Select("SELECT * FROM metrics WHERE status = #{status}")
    @ResultMap("mybatis-plus_MetricEntity")
    List<MetricEntity> findByStatus(@Param("status") String status);

    @Select("SELECT * FROM metrics WHERE name LIKE CONCAT('%', #{keyword}, '%') OR code LIKE CONCAT('%', #{keyword}, '%')")
    @ResultMap("mybatis-plus_MetricEntity")
    List<MetricEntity> searchByKeyword(@Param("keyword") String keyword);

    @Select("SELECT * FROM metrics WHERE JSON_CONTAINS(referenced_columns, JSON_OBJECT('assetId', #{assetId}))")
    @ResultMap("mybatis-plus_MetricEntity")
    List<MetricEntity> findByReferencedAsset(@Param("assetId") String assetId);
}
