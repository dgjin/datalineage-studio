package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.DataModelEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface DataModelMapper extends BaseMapper<DataModelEntity> {
}
