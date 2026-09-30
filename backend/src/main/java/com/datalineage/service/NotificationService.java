package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.NotificationEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.NotificationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Notification management service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper notificationMapper;

    public List<NotificationEntity> listNotifications(Boolean read) {
        QueryWrapper<NotificationEntity> wrapper = new QueryWrapper<>();
        if (read != null) {
            wrapper.eq("`read`", read);
        }
        wrapper.orderByDesc("timestamp");
        return notificationMapper.selectList(wrapper);
    }

    public NotificationEntity getNotification(String id) {
        NotificationEntity notification = notificationMapper.selectById(id);
        if (notification == null) {
            throw new BusinessException("Notification not found: " + id);
        }
        return notification;
    }

    @Transactional
    public NotificationEntity createNotification(String severity, String title, String body,
                                                  String refType, String refId) {
        NotificationEntity notification = new NotificationEntity();
        notification.setSeverity(severity == null ? "INFO" : severity);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setRefType(refType);
        notification.setRefId(refId);
        notification.setRead(false);
        notification.setTimestamp(LocalDateTime.now());
        notificationMapper.insert(notification);
        return notification;
    }

    @Transactional
    public void markAsRead(String id) {
        getNotification(id);
        notificationMapper.markAsRead(id);
    }

    @Transactional
    public int markAllAsRead() {
        return notificationMapper.markAllAsRead();
    }

    public List<NotificationEntity> getUnread() {
        return notificationMapper.findUnread();
    }

    public Long countUnread() {
        return notificationMapper.countUnread();
    }

    @Transactional
    public void deleteNotification(String id) {
        getNotification(id);
        notificationMapper.deleteById(id);
    }
}
