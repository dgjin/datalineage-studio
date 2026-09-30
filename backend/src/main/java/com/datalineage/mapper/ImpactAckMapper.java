package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.ImpactAckEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ImpactAckMapper extends BaseMapper<ImpactAckEntity> {

    @Select("SELECT * FROM impact_acks WHERE change_id = #{changeId}")
    List<ImpactAckEntity> findByChangeId(@Param("changeId") String changeId);

    @Select("SELECT * FROM impact_acks WHERE ack_status = #{ackStatus}")
    List<ImpactAckEntity> findByAckStatus(@Param("ackStatus") String ackStatus);
}
