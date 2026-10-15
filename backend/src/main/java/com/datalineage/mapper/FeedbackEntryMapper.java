package com.datalineage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datalineage.entity.FeedbackEntryEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface FeedbackEntryMapper extends BaseMapper<FeedbackEntryEntity> {

    /** 管理面板统计卡：按状态分组计数 */
    @Select("SELECT status, COUNT(*) AS cnt FROM feedback_entries GROUP BY status")
    List<Map<String, Object>> countByStatus();

    /** 管理面板统计卡：按类型分组计数 */
    @Select("SELECT kind, COUNT(*) AS cnt FROM feedback_entries GROUP BY kind")
    List<Map<String, Object>> countByKind();

    /** 管理面板统计卡：基线优先级分布（仅已纳入基线条目） */
    @Select("SELECT priority, COUNT(*) AS cnt FROM feedback_entries "
            + "WHERE status = 'BASELINED' GROUP BY priority")
    List<Map<String, Object>> countByPriority();
}
