package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("reference_codes")
public class ReferenceCodeEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String codeSet;
    private String setName;
    private String codeValue;
    private String meaning;
    private Integer sortOrder;
    private String description;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
