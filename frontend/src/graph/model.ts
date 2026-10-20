/**
 * Pure graph operations. No React, no React Flow, no browser APIs.
 * Everything here is unit-testable in plain Node.
 */

import type {
  GraphEdge,
  GraphNode,
  NodeTypeId,
  ParamMap,
  Vec2,
} from '../types/graph';
import { createDefaultParams, getNodeSpec } from './nodeRegistry';

let idCounter = 0;

/** Generates a unique id. Not cryptographic — just collision-resistant enough. */
export function makeId(prefix: string): string {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${idCounter.toString(36)}-${random}`;
}

export function createNode(
  type: NodeTypeId,
  position: Vec2,
  id: string = makeId(type),
): GraphNode {
  return {
    id,
    type,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    params: createDefaultParams(type),
  };
}

export function moveNodeInGraph(
  nodes: GraphNode[],
  id: string,
  position: Vec2,
): GraphNode[] {
  return nodes.map((node) =>
    node.id === id
      ? {
          ...node,
          position: { x: Math.round(position.x), y: Math.round(position.y) },
        }
      : node,
  );
}

export function updateNodeParams(
  nodes: GraphNode[],
  id: string,
  patch: ParamMap,
): GraphNode[] {
  return nodes.map((node) =>
    node.id === id ? { ...node, params: { ...node.params, ...patch } } : node,
  );
}

export function removeNodeFromGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  id: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: nodes.filter((node) => node.id !== id),
    edges: edges.filter((edge) => edge.source !== id && edge.target !== id),
  };
}

export function duplicateNodeInGraph(
  nodes: GraphNode[],
  id: string,
): { nodes: GraphNode[]; newNode: GraphNode } | null {
  const original = nodes.find((node) => node.id === id);
  if (!original) return null;

  const clone: GraphNode = {
    ...original,
    id: makeId(original.type),
    position: {
      x: original.position.x + 40,
      y: original.position.y + 40,
    },
    params: { ...original.params },
  };

  return { nodes: [...nodes, clone], newNode: clone };
}

/** Picks a sensible spot for a node created by clicking the palette. */
export function nextFreePosition(nodes: GraphNode[]): Vec2 {
  if (nodes.length === 0) return { x: 80, y: 80 };
  const lowest = Math.max(...nodes.map((node) => node.position.y));
  return { x: 80, y: lowest + 110 };
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: string };

/** Would adding source → target create a cycle in the existing edge set? */
function wouldCreateCycle(
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
): boolean {
  const stack: string[] = [targetId];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === sourceId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of edges) {
      if (edge.source === current) stack.push(edge.target);
    }
  }

  return false;
}

export function checkConnection(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
): ConnectionCheck {
  if (sourceId === targetId) {
    return { ok: false, reason: 'A node cannot be connected to itself.' };
  }

  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);

  if (!source || !target) {
    return { ok: false, reason: 'Both nodes must exist before connecting them.' };
  }

  const sourceSpec = getNodeSpec(source.type);
  const targetSpec = getNodeSpec(target.type);

  if (!sourceSpec.allowOutgoing) {
    return {
      ok: false,
      reason: `${sourceSpec.label} nodes cannot have outgoing connections.`,
    };
  }

  if (!targetSpec.allowIncoming) {
    return {
      ok: false,
      reason: `${targetSpec.label} nodes cannot have incoming connections.`,
    };
  }

  if (edges.some((edge) => edge.source === sourceId)) {
    return {
      ok: false,
      reason:
        'This node already has an outgoing connection. Milestone 1 supports a single sequential path.',
    };
  }

  if (edges.some((edge) => edge.target === targetId)) {
    return {
      ok: false,
      reason:
        'This node already has an incoming connection. Branching is not supported yet.',
    };
  }

  if (
    edges.some((edge) => edge.source === sourceId && edge.target === targetId)
  ) {
    return { ok: false, reason: 'These nodes are already connected.' };
  }

  if (wouldCreateCycle(edges, sourceId, targetId)) {
    return { ok: false, reason: 'That connection would create a cycle.' };
  }

  return { ok: true };
}

export type ConnectOutcome =
  | { ok: true; edge: GraphEdge; edges: GraphEdge[] }
  | { ok: false; reason: string };

export function connectNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
): ConnectOutcome {
  const check = checkConnection(nodes, edges, sourceId, targetId);
  if (!check.ok) return check;

  const edge: GraphEdge = {
    id: makeId('edge'),
    source: sourceId,
    target: targetId,
  };

  return { ok: true, edge, edges: [...edges, edge] };
}
