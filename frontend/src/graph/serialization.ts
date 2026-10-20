import {
  GRAPH_SCHEMA_VERSION,
  NODE_TYPE_IDS,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type NodeTypeId,
  type ParamMap,
  type ParamValue,
} from '../types/graph';
import { createDefaultParams, getNodeSpec } from './nodeRegistry';
import { checkConnection } from './model';

export function toDocument(
  name: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphDocument {
  return { schemaVersion: GRAPH_SCHEMA_VERSION, name, nodes, edges };
}

export function serializeDocument(document: GraphDocument): string {
  return JSON.stringify(document, null, 2);
}

export type ParseResult =
  | { ok: true; document: GraphDocument }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ParamsResult =
  | { ok: true; params: ParamMap }
  | { ok: false; error: string };

function sanitizeParams(
  type: NodeTypeId,
  raw: unknown,
  where: string,
): ParamsResult {
  const spec = getNodeSpec(type);
  const params = createDefaultParams(type);

  if (raw === undefined || raw === null) return { ok: true, params };
  if (!isRecord(raw)) {
    return { ok: false, error: `${where}.params must be an object.` };
  }

  for (const key of Object.keys(raw)) {
    if (!spec.params.some((paramSpec) => paramSpec.key === key)) {
      return {
        ok: false,
        error: `${where}.params has unknown key "${key}" for node type "${type}".`,
      };
    }
  }

  for (const paramSpec of spec.params) {
    const value = raw[paramSpec.key];
    if (value === undefined) continue;

    if (typeof value !== typeof paramSpec.defaultValue) {
      return {
        ok: false,
        error: `${where}.params.${paramSpec.key} must be a ${typeof paramSpec.defaultValue}.`,
      };
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      return {
        ok: false,
        error: `${where}.params.${paramSpec.key} must be a finite number.`,
      };
    }

    if (typeof value === 'number') {
      if (paramSpec.kind === 'int' && !Number.isInteger(value)) {
        return { ok: false, error: `${where}.params.${paramSpec.key} must be an integer.` };
      }
      if (paramSpec.min !== undefined && value < paramSpec.min) {
        return { ok: false, error: `${where}.params.${paramSpec.key} must be >= ${paramSpec.min}.` };
      }
      if (paramSpec.max !== undefined && value > paramSpec.max) {
        return { ok: false, error: `${where}.params.${paramSpec.key} must be <= ${paramSpec.max}.` };
      }
    }
    if (paramSpec.kind === 'select' && !paramSpec.options?.some((option) => option.value === value)) {
      return { ok: false, error: `${where}.params.${paramSpec.key} is not a valid choice.` };
    }
    params[paramSpec.key] = value as ParamValue;
  }

  return { ok: true, params };
}

/**
 * Parses and validates a graph document from JSON text.
 * Rejects anything the current build cannot faithfully represent.
 */
export function parseDocument(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (!isRecord(data)) {
    return { ok: false, error: 'The document root must be a JSON object.' };
  }

  if (data.schemaVersion !== GRAPH_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schemaVersion ${String(
        data.schemaVersion,
      )}. This build supports schemaVersion ${GRAPH_SCHEMA_VERSION}.`,
    };
  }

  const name =
    typeof data.name === 'string' && data.name.trim().length > 0
      ? data.name
      : 'Untitled network';

  if (!Array.isArray(data.nodes)) {
    return { ok: false, error: '"nodes" must be an array.' };
  }
  if (!Array.isArray(data.edges)) {
    return { ok: false, error: '"edges" must be an array.' };
  }

  const nodeIds = new Set<string>();
  const nodes: GraphNode[] = [];

  for (let index = 0; index < data.nodes.length; index += 1) {
    const rawNode = data.nodes[index] as unknown;
    const where = `nodes[${index}]`;

    if (!isRecord(rawNode)) {
      return { ok: false, error: `${where} must be an object.` };
    }

    if (typeof rawNode.id !== 'string' || rawNode.id.length === 0) {
      return { ok: false, error: `${where}.id must be a non-empty string.` };
    }

    if (nodeIds.has(rawNode.id)) {
      return { ok: false, error: `Duplicate node id "${rawNode.id}".` };
    }

    if (
      typeof rawNode.type !== 'string' ||
      !NODE_TYPE_IDS.includes(rawNode.type as NodeTypeId)
    ) {
      return {
        ok: false,
        error: `${where}.type "${String(
          rawNode.type,
        )}" is not supported. Allowed: ${NODE_TYPE_IDS.join(', ')}.`,
      };
    }

    const type = rawNode.type as NodeTypeId;

    if (
      !isRecord(rawNode.position) ||
      typeof rawNode.position.x !== 'number' ||
      typeof rawNode.position.y !== 'number' ||
      !Number.isFinite(rawNode.position.x) ||
      !Number.isFinite(rawNode.position.y)
    ) {
      return {
        ok: false,
        error: `${where}.position must be { x: number, y: number }.`,
      };
    }

    const paramsResult = sanitizeParams(type, rawNode.params, where);
    if (!paramsResult.ok) {
      return { ok: false, error: paramsResult.error };
    }

    nodeIds.add(rawNode.id);
    nodes.push({
      id: rawNode.id,
      type,
      position: { x: rawNode.position.x, y: rawNode.position.y },
      params: paramsResult.params,
    });
  }

  for (const endpoint of ['input', 'output'] as const) {
    if (nodes.filter((node) => node.type === endpoint).length > 1) {
      return { ok: false, error: `Only one ${endpoint} node is supported.` };
    }
  }

  const edgeIds = new Set<string>();
  const edges: GraphEdge[] = [];

  for (let index = 0; index < data.edges.length; index += 1) {
    const rawEdge = data.edges[index] as unknown;
    const where = `edges[${index}]`;

    if (!isRecord(rawEdge)) {
      return { ok: false, error: `${where} must be an object.` };
    }

    if (typeof rawEdge.id !== 'string' || rawEdge.id.length === 0) {
      return { ok: false, error: `${where}.id must be a non-empty string.` };
    }

    if (edgeIds.has(rawEdge.id)) {
      return { ok: false, error: `Duplicate edge id "${rawEdge.id}".` };
    }

    if (typeof rawEdge.source !== 'string' || !nodeIds.has(rawEdge.source)) {
      return {
        ok: false,
        error: `${where}.source must reference an existing node id.`,
      };
    }

    if (typeof rawEdge.target !== 'string' || !nodeIds.has(rawEdge.target)) {
      return {
        ok: false,
        error: `${where}.target must reference an existing node id.`,
      };
    }

    const check = checkConnection(nodes, edges, rawEdge.source, rawEdge.target);
    if (!check.ok) {
      return { ok: false, error: `${where}: ${check.reason}` };
    }

    edgeIds.add(rawEdge.id);
    edges.push({
      id: rawEdge.id,
      source: rawEdge.source,
      target: rawEdge.target,
    });
  }

  return {
    ok: true,
    document: {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      name,
      nodes,
      edges,
    },
  };
}
