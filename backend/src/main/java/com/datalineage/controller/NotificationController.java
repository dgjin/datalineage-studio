package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.NotificationEntity;
import com.datalineage.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Tag(name = "通知中心", description = "通知管理与已读标记")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "获取通知列表")
    public ApiResponse<List<NotificationEntity>> listNotifications(
            @RequestParam(required = false) Boolean read) {
        return ApiResponse.success(notificationService.listNotifications(read));
    }

    @GetMapping("/unread")
    @Operation(summary = "获取未读通知")
    public ApiResponse<List<NotificationEntity>> getUnread() {
        return ApiResponse.success(notificationService.getUnread());
    }

    @GetMapping("/unread/count")
    @Operation(summary = "获取未读通知数量")
    public ApiResponse<Map<String, Object>> countUnread() {
        Map<String, Object> result = new HashMap<>();
        result.put("count", notificationService.countUnread());
        return ApiResponse.success(result);
    }

    @PostMapping
    @Operation(summary = "创建通知")
    public ApiResponse<NotificationEntity> createNotification(@RequestBody NotificationEntity notification) {
        NotificationEntity created = notificationService.createNotification(
                notification.getSeverity(), notification.getTitle(), notification.getBody(),
                notification.getRefType(), notification.getRefId());
        return ApiResponse.success(created, "Notification created");
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "标记通知已读")
    public ApiResponse<Void> markAsRead(@PathVariable String id) {
        notificationService.markAsRead(id);
        return ApiResponse.success(null, "Notification marked as read");
    }

    @PutMapping("/read-all")
    @Operation(summary = "全部标记已读")
    public ApiResponse<Map<String, Object>> markAllAsRead() {
        int updated = notificationService.markAllAsRead();
        Map<String, Object> result = new HashMap<>();
        result.put("updated", updated);
        return ApiResponse.success(result, "All notifications marked as read");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除通知")
    public ApiResponse<Void> deleteNotification(@PathVariable String id) {
        notificationService.deleteNotification(id);
        return ApiResponse.success(null, "Notification deleted successfully");
    }
}
