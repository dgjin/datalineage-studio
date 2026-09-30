/**
 * Lineage Graph Image & Diagram Export Utilities
 * Supports High-Quality SVG, 2x Hi-Res PNG, and Mermaid Markdown Diagram DSL
 */

import { Asset, LineageEdge, LayerType } from '../types/lineage';

export interface ExportOptions {
  theme: 'dark' | 'light';
  includeLegend: boolean;
  includeTitle: boolean;
  spaceName: string;
  watermark?: string;
}

export function generateLineageSvg(
  assets: Asset[],
  edges: LineageEdge[],
  options: ExportOptions
): string {
  const { theme, includeLegend, includeTitle, spaceName, watermark = 'DataLineage Studio' } = options;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#020617' : '#ffffff';
  const headerBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const textSubtle = isDark ? '#64748b' : '#94a3b8';
  const colBg = isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(241, 245, 249, 0.6)';
  const colBorder = isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(203, 213, 225, 0.8)';
  const nodeBg = isDark ? '#0f172a' : '#ffffff';
  const nodeBorder = isDark ? '#1e293b' : '#e2e8f0';
  const nodeText = isDark ? '#ffffff' : '#0f172a';
  const gridDotColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';

  const layers: LayerType[] = ['ODS', 'DWD', 'DWS', 'ADS', 'APP'];
  const colWidth = 240;
  const colGap = 80;
  const startX = 60;
  const startY = includeTitle ? 140 : 80;
  const nodeWidth = 210;
  const nodeHeight = 105;
  const nodeGap = 35;

  // Group assets by layer
  const assetsByLayer: Record<LayerType, Asset[]> = {
    ODS: [],
    DWD: [],
    DWS: [],
    ADS: [],
    APP: []
  };

  assets.forEach(asset => {
    if (assetsByLayer[asset.layer]) {
      assetsByLayer[asset.layer].push(asset);
    }
  });

  // Calculate coordinates for each node
  const nodeCoords = new Map<string, { x: number; y: number; width: number; height: number; asset: Asset }>();
  let maxNodesInColumn = 1;

  layers.forEach((layer, colIndex) => {
    const layerAssets = assetsByLayer[layer];
    if (layerAssets.length > maxNodesInColumn) {
      maxNodesInColumn = layerAssets.length;
    }
    const x = startX + colIndex * (colWidth + colGap) + (colWidth - nodeWidth) / 2;

    layerAssets.forEach((asset, rowIndex) => {
      const y = startY + 40 + rowIndex * (nodeHeight + nodeGap);
      nodeCoords.set(asset.id, { x, y, width: nodeWidth, height: nodeHeight, asset });
    });
  });

  const totalWidth = startX * 2 + layers.length * colWidth + (layers.length - 1) * colGap;
  const swimlaneHeight = Math.max(500, 60 + maxNodesInColumn * (nodeHeight + nodeGap));
  const legendHeight = includeLegend ? 90 : 0;
  const totalHeight = startY + swimlaneHeight + legendHeight + 40;

  // Generate SVG elements
  const svgElements: string[] = [];

  // 1. Defs: Markers, Filters, Fonts
  svgElements.push(`
    <defs>
      <!-- Arrow Markers -->
      <marker id="arrow-indigo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#6366f1" />
      </marker>
      <marker id="arrow-rose" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
      </marker>
      <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
      </marker>
      
      <!-- Glow Filters -->
      <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      
      <!-- Background Grid Pattern -->
      <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.5" fill="${gridDotColor}" />
      </pattern>
    </defs>
  `);

  // 2. Background
  svgElements.push(`<rect width="${totalWidth}" height="${totalHeight}" fill="${bgColor}" />`);
  svgElements.push(`<rect width="${totalWidth}" height="${totalHeight}" fill="url(#grid-dots)" />`);

  // 3. Header & Title Banner
  if (includeTitle) {
    const formattedDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    svgElements.push(`
      <g id="header-banner">
        <rect x="0" y="0" width="${totalWidth}" height="100" fill="${headerBg}" />
        <line x1="0" y1="100" x2="${totalWidth}" y2="100" stroke="${colBorder}" stroke-width="1" />
        
        <circle cx="50" cy="48" r="18" fill="#4f46e5" fill-opacity="0.2" />
        <circle cx="50" cy="48" r="8" fill="#6366f1" />
        
        <text x="80" y="44" fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700">DataLineage Studio ｜ 数据血缘全域拓扑图谱</text>
        <text x="80" y="68" fill="${textMuted}" font-family="system-ui, -apple-system, sans-serif" font-size="12">
          空间域: [${spaceName.toUpperCase()}]  •  导出时点: ${formattedDate}  •  状态: 契约与运行时已对账
        </text>
        
        <rect x="${totalWidth - 190}" y="32" width="140" height="32" rx="8" fill="${isDark ? '#1e1b4b' : '#e0e7ff'}" stroke="#6366f1" stroke-width="1" />
        <text x="${totalWidth - 120}" y="52" fill="#6366f1" text-anchor="middle" font-family="monospace" font-size="11" font-weight="600">PRODUCTION ARCH</text>
      </g>
    `);
  }

  // 4. Swimlane Columns
  layers.forEach((layer, colIndex) => {
    const x = startX + colIndex * (colWidth + colGap);
    const count = assetsByLayer[layer].length;

    // Swimlane background container
    svgElements.push(`
      <g id="swimlane-${layer}">
        <rect x="${x}" y="${startY}" width="${colWidth}" height="${swimlaneHeight}" rx="12" fill="${colBg}" stroke="${colBorder}" stroke-width="1" />
        
        <!-- Header -->
        <rect x="${x}" y="${startY}" width="${colWidth}" height="36" rx="12" fill="${isDark ? '#1e293b' : '#e2e8f0'}" fill-opacity="0.7" />
        <circle cx="${x + 20}" cy="${startY + 18}" r="4" fill="#6366f1" />
        <text x="${x + 32}" y="${startY + 23}" fill="${textColor}" font-family="monospace" font-size="13" font-weight="700">${layer} 层</text>
        <text x="${x + colWidth - 16}" y="${startY + 22}" fill="${textMuted}" text-anchor="end" font-family="monospace" font-size="11">${count} 资产</text>
      </g>
    `);
  });

  // 5. Edges / Connections (Smooth Cubic Bezier Curves)
  const edgesGroup: string[] = [];
  edges.forEach((edge) => {
    const fromCoord = nodeCoords.get(edge.from);
    const toCoord = nodeCoords.get(edge.to);
    if (!fromCoord || !toCoord) return;

    // From right edge of source to left edge of target
    const x1 = fromCoord.x + fromCoord.width;
    const y1 = fromCoord.y + fromCoord.height / 2;
    const x2 = toCoord.x;
    const y2 = toCoord.y + toCoord.height / 2;

    const dx = Math.max(40, (x2 - x1) * 0.5);
    const cx1 = x1 + dx;
    const cy1 = y1;
    const cx2 = x2 - dx;
    const cy2 = y2;

    const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

    if (edge.isCriticalPath) {
      // Glow background line
      edgesGroup.push(`
        <path d="${pathData}" fill="none" stroke="#f43f5e" stroke-width="6" stroke-opacity="0.3" filter="url(#glow-rose)" />
        <path d="${pathData}" fill="none" stroke="#f43f5e" stroke-width="2.5" marker-end="url(#arrow-rose)" />
      `);
    } else if (edge.confidence < 90 || edge.source === 'PARSER') {
      edgesGroup.push(`
        <path d="${pathData}" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="5,4" marker-end="url(#arrow-amber)" />
      `);
    } else {
      edgesGroup.push(`
        <path d="${pathData}" fill="none" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow-indigo)" />
      `);
    }
  });

  svgElements.push(`<g id="edges-layer">${edgesGroup.join('')}</g>`);

  // 6. Node Cards
  const nodesGroup: string[] = [];
  nodeCoords.forEach(({ x, y, width, height, asset }) => {
    const isUnmanaged = !asset.isManaged;
    const isStale = asset.status === 'STALE';
    const isPending = asset.status === 'PENDING_CHANGE';

    let strokeColor = nodeBorder;
    let badgeColor = isDark ? '#334155' : '#e2e8f0';
    let badgeText = textMuted;
    let statusDot = '#10b981';

    if (isUnmanaged) {
      strokeColor = '#f43f5e';
      badgeColor = isDark ? 'rgba(244, 63, 94, 0.2)' : '#ffe4e6';
      badgeText = '#f43f5e';
      statusDot = '#f43f5e';
    } else if (isStale) {
      strokeColor = '#f59e0b';
      badgeColor = isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7';
      badgeText = '#d97706';
      statusDot = '#f59e0b';
    } else if (isPending) {
      strokeColor = '#eab308';
      statusDot = '#eab308';
    }

    // Escape text for SVG safety
    const safeName = asset.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeTitle = asset.displayTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeOwner = asset.owner.split(' ')[0].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    nodesGroup.push(`
      <g id="node-${asset.id}">
        <!-- Node Card Shadow & Background -->
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${nodeBg}" stroke="${strokeColor}" stroke-width="${isUnmanaged || isStale ? 2 : 1}" />
        
        <!-- Status Dot & Title -->
        <circle cx="${x + 14}" cy="${y + 18}" r="4" fill="${statusDot}" />
        <text x="${x + 25}" y="${y + 22}" fill="${nodeText}" font-family="monospace" font-size="12" font-weight="700">${safeName.length > 20 ? safeName.substring(0, 18) + '...' : safeName}</text>
        
        <!-- Subtitle / Display Name -->
        <text x="${x + 14}" y="${y + 40}" fill="${textMuted}" font-family="system-ui, -apple-system, sans-serif" font-size="10">${safeTitle.length > 22 ? safeTitle.substring(0, 20) + '...' : safeTitle}</text>
        
        <!-- Mid Meta Row (Owner & Confidence) -->
        <rect x="${x + 10}" y="${y + 50}" width="${width - 20}" height="22" rx="4" fill="${isDark ? '#020617' : '#f8fafc'}" />
        <text x="${x + 16}" y="${y + 65}" fill="${textSubtle}" font-family="system-ui, -apple-system, sans-serif" font-size="9">Owner: ${safeOwner}</text>
        <text x="${x + width - 16}" y="${y + 65}" fill="#10b981" text-anchor="end" font-family="monospace" font-size="9" font-weight="600">${asset.confidence}%</text>
        
        <!-- Bottom Row (Status Badge & Downstream count) -->
        <rect x="${x + 10}" y="${y + 78}" width="65" height="16" rx="3" fill="${badgeColor}" />
        <text x="${x + 42}" y="${y + 90}" fill="${badgeText}" text-anchor="middle" font-family="monospace" font-size="8" font-weight="600">${asset.status}</text>
        <text x="${x + width - 12}" y="${y + 90}" fill="${isDark ? '#818cf8' : '#4f46e5'}" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="9">${asset.downstreamCount} 消费依赖</text>
      </g>
    `);
  });

  svgElements.push(`<g id="nodes-layer">${nodesGroup.join('')}</g>`);

  // 7. Legend & Watermark Footer
  if (includeLegend) {
    const legendY = startY + swimlaneHeight + 20;
    svgElements.push(`
      <g id="legend-footer">
        <rect x="${startX}" y="${legendY}" width="${totalWidth - startX * 2}" height="64" rx="10" fill="${headerBg}" stroke="${colBorder}" stroke-width="1" />
        
        <text x="${startX + 20}" y="${legendY + 36}" fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">图谱图例 (Legend):</text>
        
        <!-- Solid Line -->
        <line x1="${startX + 160}" y1="${legendY + 32}" x2="${startX + 195}" y2="${legendY + 32}" stroke="#6366f1" stroke-width="2" />
        <text x="${startX + 205}" y="${legendY + 36}" fill="${textMuted}" font-family="system-ui, -apple-system, sans-serif" font-size="11">声明/运行时强血缘 (≥90%)</text>
        
        <!-- Dashed Line -->
        <line x1="${startX + 370}" y1="${legendY + 32}" x2="${startX + 405}" y2="${legendY + 32}" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="4,4" />
        <text x="${startX + 415}" y="${legendY + 36}" fill="${textMuted}" font-family="system-ui, -apple-system, sans-serif" font-size="11">推断解析/弱置信 (&lt;90%)</text>
        
        <!-- Crimson Glow Line -->
        <line x1="${startX + 580}" y1="${legendY + 32}" x2="${startX + 615}" y2="${legendY + 32}" stroke="#f43f5e" stroke-width="3" />
        <text x="${startX + 625}" y="${legendY + 36}" fill="#f43f5e" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">高亮破坏性变更关键路径</text>
        
        <!-- Watermark / Generator badge -->
        <text x="${totalWidth - startX - 20}" y="${legendY + 36}" fill="${textSubtle}" text-anchor="end" font-family="monospace" font-size="10">Generated by ${watermark}</text>
      </g>
    `);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
${svgElements.join('\n')}
</svg>`;
}

/**
 * Triggers instant browser download of the SVG file
 */
export function exportAsSvg(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Renders SVG to Canvas at 2x Retina resolution and triggers PNG download
 */
export function exportAsPng(
  svgContent: string,
  filename: string,
  scale: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context not available'));
            return;
          }

          // Scale for crisp high-density export
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((pngBlob) => {
            if (!pngBlob) {
              reject(new Error('PNG conversion failed'));
              return;
            }
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
            URL.revokeObjectURL(url);
            resolve();
          }, 'image/png');
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG for PNG conversion'));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates Mermaid.js flow diagram code for Markdown architecture documentation
 */
export function generateMermaidDsl(assets: Asset[], edges: LineageEdge[]): string {
  const lines: string[] = ['flowchart LR'];

  // Subgraph by layer
  const layers: LayerType[] = ['ODS', 'DWD', 'DWS', 'ADS', 'APP'];
  layers.forEach(layer => {
    const layerAssets = assets.filter(a => a.layer === layer);
    if (layerAssets.length > 0) {
      lines.push(`  subgraph ${layer}["${layer} 层"]`);
      layerAssets.forEach(a => {
        const idSafe = a.id.replace(/[^a-zA-Z0-9_]/g, '_');
        const shape = a.type === 'METRIC' ? `{"${a.name}"}` : a.type === 'REPORT' ? `[["${a.name}"]]` : `["${a.name}"]`;
        lines.push(`    ${idSafe}${shape}`);
      });
      lines.push('  end');
    }
  });

  // Connections
  edges.forEach(edge => {
    const fromSafe = edge.from.replace(/[^a-zA-Z0-9_]/g, '_');
    const toSafe = edge.to.replace(/[^a-zA-Z0-9_]/g, '_');
    if (edge.isCriticalPath) {
      lines.push(`  ${fromSafe} == "破坏性影响" ==> ${toSafe}`);
    } else if (edge.confidence < 90) {
      lines.push(`  ${fromSafe} -. "${edge.confidence}%" .-> ${toSafe}`);
    } else {
      lines.push(`  ${fromSafe} --> ${toSafe}`);
    }
  });

  return lines.join('\n');
}
