package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.CollectorAdapterEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CollectorAdapterMapper extends BaseMapper<CollectorAdapterEntity> {

    @Select("SELECT * FROM collector_adapters WHERE status = #{status}")
    @ResultMap("mybatis-plus_CollectorAdapterEntity")
    List<CollectorAdapterEntity> findByStatus(@Param("status") String status);

    @Select("SELECT * FROM collector_adapters WHERE type = #{type}")
    @ResultMap("mybatis-plus_CollectorAdapterEntity")
    List<CollectorAdapterEntity> findByType(@Param("type") String type);
}
