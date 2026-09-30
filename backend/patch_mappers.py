#!/usr/bin/env python3
"""Batch-patch MyBatis mappers: add @ResultMap for custom @Select queries
so MyBatis Plus autoResultMap (JacksonTypeHandler for JSON columns) applies."""
import re
import pathlib

mapping = {
    'AssetMapper.java': 'AssetEntity',
    'ChangeEventMapper.java': 'ChangeEventEntity',
    'CollectorAdapterMapper.java': 'CollectorAdapterEntity',
    'CollectorRunLogMapper.java': 'CollectorRunLogEntity',
    'MetadataCollectTaskMapper.java': 'MetadataCollectTaskEntity',
    'NotificationMapper.java': 'NotificationEntity',
}

base = pathlib.Path('src/main/java/com/datalineage/mapper')

for fn, entity in mapping.items():
    p = base / fn
    src = p.read_text()
    if 'import org.apache.ibatis.annotations.ResultMap;' not in src:
        src = src.replace(
            'import org.apache.ibatis.annotations.Select;',
            'import org.apache.ibatis.annotations.ResultMap;\nimport org.apache.ibatis.annotations.Select;'
        )
    lines = src.split('\n')
    out = []
    i = 0
    while i < len(lines):
        out.append(lines[i])
        if lines[i].strip().startswith('@Select('):
            j = i + 1
            while j < len(lines) and lines[j].strip() == '':
                out.append(lines[j])
                j += 1
            decl = lines[j].strip() if j < len(lines) else ''
            if decl.startswith('List<') or re.match(r'^\w+Entity\s', decl):
                indent = re.match(r'\s*', lines[j]).group(0)
                out.append(f'{indent}@ResultMap("mybatis-plus_{entity}")')
            i = j
            continue
        i += 1
    patched = '\n'.join(out)
    p.write_text(patched)
    print(f'patched {fn}: {patched.count("@ResultMap")} result maps')
