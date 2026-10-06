package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.DataModelTableEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DataModelTableMapper extends BaseMapper<DataModelTableEntity> {

    @Select("SELECT * FROM data_model_tables WHERE model_id = #{modelId}")
    @ResultMap("mybatis-plus_DataModelTableEntity")
    List<DataModelTableEntity> findByModelId(@Param("modelId") String modelId);
}
