package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.CollectorRunLogEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CollectorRunLogMapper extends BaseMapper<CollectorRunLogEntity> {

    @Select("SELECT * FROM collector_run_logs WHERE task_id = #{taskId} ORDER BY start_time DESC LIMIT #{limit}")
    @ResultMap("mybatis-plus_CollectorRunLogEntity")
    List<CollectorRunLogEntity> findByTaskId(@Param("taskId") String taskId, @Param("limit") int limit);

    @Select("SELECT * FROM collector_run_logs WHERE data_source_id = #{dataSourceId} ORDER BY start_time DESC LIMIT #{limit}")
    @ResultMap("mybatis-plus_CollectorRunLogEntity")
    List<CollectorRunLogEntity> findByDataSourceId(@Param("dataSourceId") String dataSourceId, @Param("limit") int limit);
}
