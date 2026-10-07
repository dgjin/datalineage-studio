package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.exception.BusinessException;
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
        if (asset.getName() == null || asset.getName().isBlank()) {
            throw new BusinessException("资产名称（name）不能为空");
        }
        if (asset.getType() == null || asset.getType().isBlank()) {
            throw new BusinessException("资产类型（type）不能为空");
        }
        if (asset.getLayer() == null || asset.getLayer().isBlank()) {
            throw new BusinessException("资产层级（layer）不能为空");
        }
        if (asset.getId() == null || asset.getId().isEmpty()) {
            asset.setId("asset:" + UUID.randomUUID().toString().substring(0, 8));
        }
        // NOT NULL columns without DB defaults: fill safe fallbacks so API/manual
        // registration cannot fail on missing provenance metadata.
        if (asset.getCode() == null || asset.getCode().isBlank()) {
            asset.setCode(generateAssetCode(asset));
        }
        if (asset.getSourceType() == null || asset.getSourceType().isBlank()) {
            asset.setSourceType("MANUAL");
        }
        assetMapper.insert(asset);
        return asset;
    }

    /** Fallback code in collector style (e.g. ODS-ODSORDERS-4F2A), UNIQUE-safe. */
    private String generateAssetCode(AssetEntity asset) {
        String layer = asset.getLayer() == null || asset.getLayer().isEmpty() ? "ASSET" : asset.getLayer();
        String cleanName = asset.getName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        if (cleanName.isEmpty()) {
            cleanName = "ITEM";
        }
        String base = layer + "-" + cleanName.substring(0, Math.min(cleanName.length(), 10));
        String seed = asset.getName() + ":" + asset.getId();
        String code = base + "-" + hashSuffix(seed);
        int attempt = 0;
        while (assetMapper.selectCount(new QueryWrapper<AssetEntity>().eq("code", code)) > 0 && attempt < 5) {
            attempt++;
            code = base + "-" + hashSuffix(seed + ":" + attempt);
        }
        return code;
    }

    private static String hashSuffix(String seed) {
        String hash = Integer.toHexString(seed.hashCode()).toUpperCase();
        return hash.substring(Math.max(0, hash.length() - 4));
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
