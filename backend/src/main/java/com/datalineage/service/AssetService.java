package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.AssetColumnMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssetService {

    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;

    public List<AssetEntity> listAssets(String space, String layer, String type, String status) {
        QueryWrapper<AssetEntity> wrapper = new QueryWrapper<>();
        if (space != null && !space.isEmpty() && !"all".equals(space)) {
            wrapper.eq("space", space);
        }
        if (layer != null && !layer.isEmpty()) {
            wrapper.eq("layer", layer);
        }
        if (type != null && !type.isEmpty()) {
            wrapper.eq("type", type);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("updated_at");
        return assetMapper.selectList(wrapper);
    }

    public AssetEntity getAssetById(String id) {
        return assetMapper.selectById(id);
    }

    public AssetEntity getAssetWithColumns(String id) {
        AssetEntity asset = assetMapper.selectById(id);
        if (asset != null) {
            List<AssetColumnEntity> columns = assetColumnMapper.selectList(
                new QueryWrapper<AssetColumnEntity>().eq("asset_id", id)
            );
            // Note: In a real implementation, you would convert this to DTO
        }
        return asset;
    }

    @Transactional
    public AssetEntity createAsset(AssetEntity asset) {
        if (asset.getId() == null || asset.getId().isEmpty()) {
            asset.setId("asset:" + UUID.randomUUID().toString().substring(0, 8));
        }
        assetMapper.insert(asset);
        return asset;
    }

    @Transactional
    public AssetEntity updateAsset(String id, AssetEntity asset) {
        asset.setId(id);
        assetMapper.updateById(asset);
        return assetMapper.selectById(id);
    }

    @Transactional
    public void deleteAsset(String id) {
        assetColumnMapper.delete(new QueryWrapper<AssetColumnEntity>().eq("asset_id", id));
        assetMapper.deleteById(id);
    }

    public List<AssetEntity> searchAssets(String keyword) {
        return assetMapper.searchByKeyword(keyword);
    }

    public List<AssetColumnEntity> getAssetColumns(String id) {
        return assetColumnMapper.selectList(
            new QueryWrapper<AssetColumnEntity>().eq("asset_id", id).orderByAsc("name")
        );
    }
}
