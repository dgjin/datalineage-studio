/**
 * Shortest Path Graph Algorithm for Data Lineage
 * Finds the primary directed flow between two nodes using Breadth-First Search (BFS)
 */

import { Asset, LineageEdge } from '../types/lineage';

export interface PathStep {
  asset: Asset;
  stepIndex: number;
  isStart: boolean;
  isEnd: boolean;
  edgeToNext?: LineageEdge;
}

export interface PathResult {
  found: boolean;
  startId: string;
  endId: string;
  nodeIds: string[];
  edgeIds: string[];
  lowestConfidence: number;
  totalHops: number;
  direction: 'FORWARD' | 'REVERSE' | 'NONE';
  steps: PathStep[];
  criticalPathCount: number;
}

export function findShortestPath(
  startId: string,
  endId: string,
  assets: Asset[],
  edges: LineageEdge[]
): PathResult {
  const assetMap = new Map<string, Asset>(assets.map(a => [a.id, a]));

  if (startId === endId) {
    const asset = assetMap.get(startId);
    return {
      found: true,
      startId,
      endId,
      nodeIds: [startId],
      edgeIds: [],
      lowestConfidence: asset?.confidence ?? 100,
      totalHops: 0,
      direction: 'FORWARD',
      steps: asset ? [{ asset, stepIndex: 1, isStart: true, isEnd: true }] : [],
      criticalPathCount: 0
    };
  }

  // 1. Try Forward Search (startId -> endId)
  const forward = runBfs(startId, endId, assetMap, edges);
  if (forward) {
    return {
      ...forward,
      startId,
      endId,
      direction: 'FORWARD'
    };
  }

  // 2. Try Reverse Search (endId -> startId)
  const reverse = runBfs(endId, startId, assetMap, edges);
  if (reverse) {
    return {
      ...reverse,
      startId,
      endId,
      direction: 'REVERSE'
    };
  }

  return {
    found: false,
    startId,
    endId,
    nodeIds: [],
    edgeIds: [],
    lowestConfidence: 0,
    totalHops: 0,
    direction: 'NONE',
    steps: [],
    criticalPathCount: 0
  };
}

function runBfs(
  source: string,
  target: string,
  assetMap: Map<string, Asset>,
  edges: LineageEdge[]
): Omit<PathResult, 'startId' | 'endId' | 'direction'> | null {
  // Build directed adjacency list
  const adj = new Map<string, { to: string; edge: LineageEdge }[]>();

  edges.forEach(edge => {
    // Standardize IDs: remove column specifiers if present to match table nodes
    const fromId = edge.from.includes(':col:') ? edge.from.split(':col:')[0] : edge.from;
    const toId = edge.to.includes(':col:') ? edge.to.split(':col:')[0] : edge.to;

    if (!adj.has(fromId)) adj.set(fromId, []);
    adj.get(fromId)!.push({ to: toId, edge });
  });

  const queue: string[] = [source];
  const visited = new Set<string>([source]);
  const parent = new Map<string, { prev: string; edge: LineageEdge }>();

  let found = false;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === target) {
      found = true;
      break;
    }

    const neighbors = adj.get(curr) || [];
    for (const { to, edge } of neighbors) {
      if (!visited.has(to)) {
        visited.add(to);
        parent.set(to, { prev: curr, edge });
        queue.push(to);
      }
    }
  }

  if (!found) return null;

  // Reconstruct path from target back to source
  const nodeIds: string[] = [];
  const edgeList: LineageEdge[] = [];
  let curr = target;

  while (curr !== source) {
    nodeIds.push(curr);
    const p = parent.get(curr);
    if (!p) break;
    edgeList.push(p.edge);
    curr = p.prev;
  }
  nodeIds.push(source);

  nodeIds.reverse();
  edgeList.reverse();

  let lowestConfidence = 100;
  let criticalCount = 0;

  edgeList.forEach(e => {
    if (e.confidence < lowestConfidence) lowestConfidence = e.confidence;
    if (e.isCriticalPath) criticalCount++;
  });

  const steps: PathStep[] = nodeIds.map((id, index) => {
    const asset = assetMap.get(id) || {
      id,
      code: id,
      name: id,
      displayTitle: id,
      type: 'TABLE',
      layer: 'DWD',
      space: 'crm',
      owner: '未知',
      department: '未知',
      status: 'ACTIVE',
      description: '',
      confidence: 100,
      sourceType: 'OPENLINEAGE',
      downstreamCount: 0,
      upstreamCount: 0,
      createdAt: '',
      updatedAt: '',
      isManaged: true
    };

    return {
      asset,
      stepIndex: index + 1,
      isStart: index === 0,
      isEnd: index === nodeIds.length - 1,
      edgeToNext: edgeList[index]
    };
  });

  return {
    found: true,
    nodeIds,
    edgeIds: edgeList.map(e => e.id),
    lowestConfidence,
    totalHops: nodeIds.length - 1,
    steps,
    criticalPathCount: criticalCount
  };
}
