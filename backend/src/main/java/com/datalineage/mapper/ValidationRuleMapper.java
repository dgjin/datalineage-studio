package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.ValidationRuleEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ValidationRuleMapper extends BaseMapper<ValidationRuleEntity> {

    @Select("SELECT * FROM validation_rules WHERE enabled = TRUE")
    List<ValidationRuleEntity> findEnabledRules();

    @Select("SELECT * FROM validation_rules WHERE category = #{category}")
    List<ValidationRuleEntity> findByCategory(@Param("category") String category);
}
