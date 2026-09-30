package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.GlossaryTermEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface GlossaryTermMapper extends BaseMapper<GlossaryTermEntity> {
}
