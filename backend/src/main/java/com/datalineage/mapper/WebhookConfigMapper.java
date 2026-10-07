package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.WebhookConfigEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WebhookConfigMapper extends BaseMapper<WebhookConfigEntity> {
}
