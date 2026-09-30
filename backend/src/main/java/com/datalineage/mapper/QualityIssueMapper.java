package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.QualityIssueEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface QualityIssueMapper extends BaseMapper<QualityIssueEntity> {

    @Select("SELECT * FROM quality_issues WHERE status = #{status}")
    List<QualityIssueEntity> findByStatus(@Param("status") String status);

    @Select("SELECT * FROM quality_issues WHERE priority = #{priority} ORDER BY due_date ASC")
    List<QualityIssueEntity> findByPriority(@Param("priority") String priority);
}
