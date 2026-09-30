package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.MetricHistoryEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MetricHistoryMapper extends BaseMapper<MetricHistoryEntity> {

    @Select("SELECT * FROM metric_history WHERE metric_code = #{metricCode} ORDER BY created_at DESC")
    List<MetricHistoryEntity> findByMetricCode(@Param("metricCode") String metricCode);
}
