package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.NotificationEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface NotificationMapper extends BaseMapper<NotificationEntity> {

    @Select("SELECT * FROM notifications WHERE `read` = FALSE ORDER BY timestamp DESC")
    @ResultMap("mybatis-plus_NotificationEntity")
    List<NotificationEntity> findUnread();

    @Select("SELECT COUNT(*) FROM notifications WHERE `read` = FALSE")
    Long countUnread();

    @Update("UPDATE notifications SET `read` = TRUE WHERE id = #{id}")
    int markAsRead(@Param("id") String id);

    @Update("UPDATE notifications SET `read` = TRUE")
    int markAllAsRead();
}
