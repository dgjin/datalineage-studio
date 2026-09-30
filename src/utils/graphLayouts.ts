/**
 * Graph Layout Algorithms for Universal Data Lineage
 * Supports:
 * 1. HIERARCHICAL: Standard 5-layer Data Warehouse swimlanes (ODS -> DWD -> DWS -> ADS -> APP)
 * 2. FORCE_DIRECTED: Spring-embedded physics simulation with organic clustering
 * 3. RADIAL: Concentric polar orbit layout centered on focused asset (Hop 0, 1, 2, 3+)
 */

import { Asset, LineageEdge } from '../types/lineage';

export type LayoutAlgorithm = 'HIERARCHICAL' | 'FORCE_DIRECTED' | 'RADIAL';

export interface LayoutNodePosition {
  id: string;
  x: number;
  y: number;
  asset: Asset;
  hop?: number;
  isCenter?: boolean;
  angle?: number;
  cluster?: string;
}

export interface ForceDirectedLayoutResult {
  type: 'FORCE_DIRECTED';
  nodes: Map<string, LayoutNodePosition>;
  width: number;
  height: number;
}

export interface RadialLayoutResult {
  type: 'RADIAL';
  nodes: Map<string, LayoutNodePosition>;
  centerX: number;
  centerY: number;
  rings: { hop: number; radius: number; label: string }[];
  width: number;
  height: number;
}

/**
 * 2. Force-Directed Physics Layout Calculation
 * Uses iterative Coulomb-Hooke spring-electrical model with domain-based gravitational pull
 */
export function calculateForceDirectedLayout(
  assets: Asset[],
  edges: LineageEdge[],
  canvasWidth = 1600,
  canvasHeight = 960
): ForceDirectedLayoutResult {
  const nodeMap = new Map<string, LayoutNodePosition>();
  const total = assets.length;
  if (total === 0) return { type: 'FORCE_DIRECTED', nodes: nodeMap, width: canvasWidth, height: canvasHeight };

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  // Layer column initial seeding for faster and aesthetic convergence
  const layerXMap: Record<string, number> = {
    ODS: cx - 480,
    DWD: cx - 240,
    DWS: cx,
    ADS: cx + 240,
    APP: cx + 480
  };

  // 1. Initial Seeding: Layer-guided circle dispersion
  assets.forEach((asset, idx) => {
    const baseX = layerXMap[asset.layer] ?? cx;
    const jitterAngle = (idx / total) * Math.PI * 2;
    const jitterR = 80 + (idx % 4) * 40;

    nodeMap.set(asset.id, {
      id: asset.id,
      x: baseX + Math.cos(jitterAngle) * jitterR,
      y: cy + (idx - total / 2) * 65 + Math.sin(jitterAngle) * 30,
      asset,
      cluster: asset.layer
    });
  });

  // 2. Physics Simulation Parameters
  const iterations = 85;
  const k = Math.sqrt((canvasWidth * canvasHeight) / (total + 8)); // Optimal spring length
  const repulsionStrength = k * k * 0.95;
  const springStrength = 0.08;
  const centerGravity = 0.035;
  let temperature = canvasWidth / 8; // Simulated annealing cooling
  const coolingFactor = 0.95;

  const nodeArray = Array.from(nodeMap.values());

  // Connected pairs for fast spring attraction
  const edgeList: { fromId: string; toId: string; weight: number }[] = [];
  edges.forEach(e => {
    if (nodeMap.has(e.from) && nodeMap.has(e.to)) {
      edgeList.push({
        fromId: e.from,
        toId: e.to,
        weight: e.isCriticalPath ? 1.5 : e.confidence >= 90 ? 1.2 : 0.8
      });
    }
  });

  // Iterative Relaxation Loop
  for (let iter = 0; iter < iterations; iter++) {
    const dispMap = new Map<string, { dx: number; dy: number }>();
    nodeArray.forEach(n => dispMap.set(n.id, { dx: 0, dy: 0 }));

    // A. Repulsion (all node pairs repel each other)
    for (let i = 0; i < nodeArray.length; i++) {
      const u = nodeArray[i];
      const dispU = dispMap.get(u.id)!;

      for (let j = i + 1; j < nodeArray.length; j++) {
        const v = nodeArray[j];
        const dispV = dispMap.get(v.id)!;

        let deltaX = u.x - v.x;
        let deltaY = u.y - v.y;
        let dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (dist < 1) {
          deltaX = Math.random() - 0.5;
          deltaY = Math.random() - 0.5;
          dist = 1;
        }

        const repForce = repulsionStrength / dist;
        const fx = (deltaX / dist) * repForce;
        const fy = (deltaY / dist) * repForce;

        dispU.dx += fx;
        dispU.dy += fy;
        dispV.dx -= fx;
        dispV.dy -= fy;
      }
    }

    // B. Attraction (connected nodes attract along edges)
    for (const edge of edgeList) {
      const u = nodeMap.get(edge.fromId)!;
      const v = nodeMap.get(edge.toId)!;
      const dispU = dispMap.get(edge.fromId)!;
      const dispV = dispMap.get(edge.toId)!;

      const deltaX = v.x - u.x;
      const deltaY = v.y - u.y;
      const dist = Math.max(1, Math.sqrt(deltaX * deltaX + deltaY * deltaY));

      const attrForce = (dist * dist) / k * springStrength * edge.weight;
      const fx = (deltaX / dist) * attrForce;
      const fy = (deltaY / dist) * attrForce;

      dispU.dx += fx;
      dispU.dy += fy;
      dispV.dx -= fx;
      dispV.dy -= fy;
    }

    // C. Center Gravity and Layer Orientation Pull
    nodeArray.forEach(n => {
      const disp = dispMap.get(n.id)!;
      // Gravity toward center
      disp.dx += (cx - n.x) * centerGravity;
      disp.dy += (cy - n.y) * centerGravity * 1.5;

      // Layer horizontal tendency pull
      const targetLayerX = layerXMap[n.asset.layer] ?? cx;
      disp.dx += (targetLayerX - n.x) * 0.05;
    });

    // D. Update node coordinates with temperature clipping (simulated annealing)
    const paddingX = 140;
    const paddingY = 90;

    nodeArray.forEach(n => {
      const disp = dispMap.get(n.id)!;
      const dLen = Math.sqrt(disp.dx * disp.dx + disp.dy * disp.dy);
      if (dLen > 0) {
        const moveDist = Math.min(dLen, temperature);
        n.x += (disp.dx / dLen) * moveDist;
        n.y += (disp.dy / dLen) * moveDist;
      }

      // Constrain within bounding box
      n.x = Math.max(paddingX, Math.min(canvasWidth - paddingX, n.x));
      n.y = Math.max(paddingY, Math.min(canvasHeight - paddingY, n.y));
    });

    temperature *= coolingFactor;
  }

  return { type: 'FORCE_DIRECTED', nodes: nodeMap, width: canvasWidth, height: canvasHeight };
}

/**
 * 3. Radial Concentric Orbit Layout Calculation
 * Positions the selected/focused node at the center (0, 0),
 * and places dependencies along concentric circular rings based on graph hop distance.
 * Upstream nodes placed on left arc (90° -> 270°), downstream on right arc (-90° -> 90°).
 */
export function calculateRadialLayout(
  centerAssetId: string,
  assets: Asset[],
  edges: LineageEdge[],
  canvasWidth = 1600,
  canvasHeight = 1200
): RadialLayoutResult {
  const nodeMap = new Map<string, LayoutNodePosition>();
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  const centerAsset = assets.find(a => a.id === centerAssetId) || assets[0];
  if (!centerAsset) {
    return { type: 'RADIAL', nodes: nodeMap, centerX: cx, centerY: cy, rings: [], width: canvasWidth, height: canvasHeight };
  }

  // Ring radiuses (px)
  const RING_RADII = [
    { hop: 0, radius: 0, label: '聚焦核心资产 (Center Core)' },
    { hop: 1, radius: 240, label: '第 1 跳直连依赖 (Hop 1 Direct)' },
    { hop: 2, radius: 460, label: '第 2 跳扩散波及 (Hop 2 Indirect)' },
    { hop: 3, radius: 680, label: '第 3 跳及远端终端 (Hop 3+ Distant)' }
  ];

  // Adjacency maps for BFS
  const upstreamMap = new Map<string, string[]>();   // node -> its direct upstreams
  const downstreamMap = new Map<string, string[]>(); // node -> its direct downstreams

  assets.forEach(a => {
    upstreamMap.set(a.id, []);
    downstreamMap.set(a.id, []);
  });

  edges.forEach(e => {
    if (upstreamMap.has(e.to) && downstreamMap.has(e.from)) {
      upstreamMap.get(e.to)!.push(e.from);
      downstreamMap.get(e.from)!.push(e.to);
    }
  });

  // BFS to determine hop and upstream/downstream orientation
  interface NodeHopMeta {
    hop: number;
    isUpstream: boolean;
    isDownstream: boolean;
  }
  const hopMetaMap = new Map<string, NodeHopMeta>();

  hopMetaMap.set(centerAsset.id, { hop: 0, isUpstream: false, isDownstream: false });

  // 1. BFS Upstream traversal
  const queueUp: { id: string; hop: number }[] = [{ id: centerAsset.id, hop: 0 }];
  const visitedUp = new Set<string>([centerAsset.id]);

  while (queueUp.length > 0) {
    const curr = queueUp.shift()!;
    const ups = upstreamMap.get(curr.id) || [];
    for (const upId of ups) {
      if (!visitedUp.has(upId)) {
        visitedUp.add(upId);
        const nextHop = curr.hop + 1;
        hopMetaMap.set(upId, { hop: nextHop, isUpstream: true, isDownstream: false });
        if (nextHop < 3) queueUp.push({ id: upId, hop: nextHop });
      }
    }
  }

  // 2. BFS Downstream traversal
  const queueDown: { id: string; hop: number }[] = [{ id: centerAsset.id, hop: 0 }];
  const visitedDown = new Set<string>([centerAsset.id]);

  while (queueDown.length > 0) {
    const curr = queueDown.shift()!;
    const downs = downstreamMap.get(curr.id) || [];
    for (const downId of downs) {
      if (!visitedDown.has(downId)) {
        visitedDown.add(downId);
        const nextHop = curr.hop + 1;
        const existing = hopMetaMap.get(downId);
        if (!existing || nextHop < existing.hop) {
          hopMetaMap.set(downId, { hop: nextHop, isUpstream: false, isDownstream: true });
        }
        if (nextHop < 3) queueDown.push({ id: downId, hop: nextHop });
      }
    }
  }

  // Group nodes by (hop, orientation)
  const hopGroups: Record<number, { up: Asset[]; down: Asset[]; other: Asset[] }> = {
    1: { up: [], down: [], other: [] },
    2: { up: [], down: [], other: [] },
    3: { up: [], down: [], other: [] }
  };

  assets.forEach(asset => {
    if (asset.id === centerAsset.id) return;
    const meta = hopMetaMap.get(asset.id);
    const hop = meta ? Math.min(3, meta.hop) : 3;
    if (!hopGroups[hop]) hopGroups[hop] = { up: [], down: [], other: [] };

    if (meta?.isUpstream) hopGroups[hop].up.push(asset);
    else if (meta?.isDownstream) hopGroups[hop].down.push(asset);
    else hopGroups[hop].other.push(asset);
  });

  // Place Center Node (Hop 0)
  nodeMap.set(centerAsset.id, {
    id: centerAsset.id,
    x: cx,
    y: cy,
    asset: centerAsset,
    hop: 0,
    isCenter: true,
    angle: 0
  });

  // Place Nodes along Rings
  [1, 2, 3].forEach(hop => {
    const ring = RING_RADII.find(r => r.hop === hop)!;
    const { up, down, other } = hopGroups[hop];

    // Upstream nodes: placed on LEFT semicircle (angle: 120° -> 240° or Math.PI * 0.65 -> 1.35)
    if (up.length > 0) {
      const startAngle = Math.PI * 0.72;
      const endAngle = Math.PI * 1.28;
      const span = up.length === 1 ? 0 : (endAngle - startAngle) / (up.length - 1);

      up.forEach((asset, idx) => {
        const angle = up.length === 1 ? Math.PI : startAngle + idx * span;
        nodeMap.set(asset.id, {
          id: asset.id,
          x: cx + Math.cos(angle) * ring.radius,
          y: cy + Math.sin(angle) * ring.radius,
          asset,
          hop,
          angle
        });
      });
    }

    // Downstream nodes: placed on RIGHT semicircle (angle: -60° -> +60° or -Math.PI * 0.35 -> +Math.PI * 0.35)
    if (down.length > 0) {
      const startAngle = -Math.PI * 0.3;
      const endAngle = Math.PI * 0.3;
      const span = down.length === 1 ? 0 : (endAngle - startAngle) / (down.length - 1);

      down.forEach((asset, idx) => {
        const angle = down.length === 1 ? 0 : startAngle + idx * span;
        nodeMap.set(asset.id, {
          id: asset.id,
          x: cx + Math.cos(angle) * ring.radius,
          y: cy + Math.sin(angle) * ring.radius,
          asset,
          hop,
          angle
        });
      });
    }

    // Other/Unconnected nodes placed on top/bottom arcs
    if (other.length > 0) {
      const topArc = other.slice(0, Math.ceil(other.length / 2));
      const bottomArc = other.slice(Math.ceil(other.length / 2));

      topArc.forEach((asset, idx) => {
        const angle = -Math.PI * 0.5 + (idx - topArc.length / 2 + 0.5) * 0.3;
        nodeMap.set(asset.id, {
          id: asset.id,
          x: cx + Math.cos(angle) * ring.radius,
          y: cy + Math.sin(angle) * ring.radius,
          asset,
          hop,
          angle
        });
      });

      bottomArc.forEach((asset, idx) => {
        const angle = Math.PI * 0.5 + (idx - bottomArc.length / 2 + 0.5) * 0.3;
        nodeMap.set(asset.id, {
          id: asset.id,
          x: cx + Math.cos(angle) * ring.radius,
          y: cy + Math.sin(angle) * ring.radius,
          asset,
          hop,
          angle
        });
      });
    }
  });

  return {
    type: 'RADIAL',
    nodes: nodeMap,
    centerX: cx,
    centerY: cy,
    rings: RING_RADII,
    width: canvasWidth,
    height: canvasHeight
  };
}
