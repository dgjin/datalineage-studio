package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.AuditLogEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLogEntity> {
}
