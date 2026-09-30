package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.ContractEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ContractMapper extends BaseMapper<ContractEntity> {

    @Select("SELECT * FROM contracts WHERE domain = #{domain}")
    List<ContractEntity> findByDomain(@Param("domain") String domain);

    @Select("SELECT * FROM contracts WHERE path = #{path}")
    ContractEntity findByPath(@Param("path") String path);
}
