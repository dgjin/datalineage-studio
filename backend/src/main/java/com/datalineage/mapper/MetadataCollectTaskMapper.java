package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.MetadataCollectTaskEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MetadataCollectTaskMapper extends BaseMapper<MetadataCollectTaskEntity> {
    
    @Select("SELECT * FROM metadata_collect_tasks WHERE data_source_id = #{dataSourceId}")
    @ResultMap("mybatis-plus_MetadataCollectTaskEntity")
    List<MetadataCollectTaskEntity> findByDataSourceId(@Param("dataSourceId") String dataSourceId);
    
    @Select("SELECT * FROM metadata_collect_tasks WHERE status = #{status}")
    @ResultMap("mybatis-plus_MetadataCollectTaskEntity")
    List<MetadataCollectTaskEntity> findByStatus(@Param("status") String status);
    
    @Select("SELECT * FROM metadata_collect_tasks WHERE schedule_cron IS NOT NULL AND status = 'PENDING'")
    @ResultMap("mybatis-plus_MetadataCollectTaskEntity")
    List<MetadataCollectTaskEntity> findScheduledTasks();
}
