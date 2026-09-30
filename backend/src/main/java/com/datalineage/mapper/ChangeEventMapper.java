package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.ChangeEventEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ChangeEventMapper extends BaseMapper<ChangeEventEntity> {

    @Select("SELECT * FROM change_events WHERE asset_id = #{assetId} ORDER BY timestamp DESC")
    @ResultMap("mybatis-plus_ChangeEventEntity")
    List<ChangeEventEntity> findByAssetId(@Param("assetId") String assetId);

    @Select("SELECT * FROM change_events WHERE status = #{status} ORDER BY timestamp DESC")
    @ResultMap("mybatis-plus_ChangeEventEntity")
    List<ChangeEventEntity> findByStatus(@Param("status") String status);

    @Select("SELECT * FROM change_events WHERE is_breaking = TRUE ORDER BY timestamp DESC")
    @ResultMap("mybatis-plus_ChangeEventEntity")
    List<ChangeEventEntity> findBreakingChanges();

    @Select("SELECT * FROM change_events WHERE is_managed = FALSE ORDER BY timestamp DESC")
    @ResultMap("mybatis-plus_ChangeEventEntity")
    List<ChangeEventEntity> findUnmanagedChanges();
}
