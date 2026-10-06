package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("users")
public class UserEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String username;
    private String passwordHash;
    private String displayName;
    private String roleCode;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
