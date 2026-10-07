package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.DataModelVersionEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DataModelVersionMapper extends BaseMapper<DataModelVersionEntity> {

    @Select("SELECT * FROM data_model_versions WHERE model_id = #{modelId} ORDER BY version_no DESC")
    @ResultMap("mybatis-plus_DataModelVersionEntity")
    List<DataModelVersionEntity> findByModelId(@Param("modelId") String modelId);
}
