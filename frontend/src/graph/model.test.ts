import { describe, expect, it } from 'vitest';
import {
  checkConnection,
  connectNodes,
  createNode,
  duplicateNodeInGraph,
  moveNodeInGraph,
  nextFreePosition,
  removeNodeFromGraph,
  updateNodeParams,
} from './model';
import { parseDocument, serializeDocument, toDocument } from './serialization';
import { createDefaultParams } from './nodeRegistry';
import { EXAMPLES } from './examples';
import type { GraphNode } from '../types/graph';

function buildLinearChain(): GraphNode[] {
  return [
    createNode('input', { x: 0, y: 0 }, 'a'),
    createNode('linear', { x: 0, y: 100 }, 'b'),
    createNode('relu', { x: 0, y: 200 }, 'c'),
    createNode('output', { x: 0, y: 300 }, 'd'),
  ];
}

describe('createNode', () => {
  it('applies registry defaults', () => {
    const node = createNode('linear', { x: 10, y: 20 }, 'n1');
    expect(node.id).toBe('n1');
    expect(node.type).toBe('linear');
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.params).toEqual(createDefaultParams('linear'));
    expect(node.params.out_features).toBe(128);
    expect(node.params.bias).toBe(true);
  });

  it('rounds fractional positions', () => {
    const node = createNode('relu', { x: 10.6, y: 20.2 }, 'n2');
    expect(node.position).toEqual({ x: 11, y: 20 });
  });
});

describe('checkConnection', () => {
  const nodes = buildLinearChain();

  it('accepts a valid forward connection', () => {
    expect(checkConnection(nodes, [], 'a', 'b').ok).toBe(true);
  });

  it('rejects self connections', () => {
    const result = checkConnection(nodes, [], 'a', 'a');
    expect(result.ok).toBe(false);
  });

  it('rejects a second outgoing connection from the same node', () => {
    const outcome = connectNodes(nodes, [], 'a', 'b');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const second = checkConnection(nodes, outcome.edges, 'a', 'c');
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toMatch(/outgoing connection/i);
  });

  it('rejects a second incoming connection to the same node', () => {
    const outcome = connectNodes(nodes, [], 'a', 'b');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const second = checkConnection(nodes, outcome.edges, 'd', 'b');
    expect(second.ok).toBe(false);
  });

  it('rejects outgoing connections from the output node', () => {
    const result = checkConnection(nodes, [], 'd', 'a');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/cannot have outgoing/i);
  });

  it('rejects incoming connections to the input node', () => {
    const result = checkConnection(nodes, [], 'b', 'a');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/cannot have incoming/i);
  });

  it('rejects connections that would create a cycle', () => {
    // a -> b -> c already exists; c -> a must be rejected.
    const first = connectNodes(nodes, [], 'a', 'b');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = connectNodes(nodes, first.edges, 'b', 'c');
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const cyclic = checkConnection(nodes, second.edges, 'c', 'a');
    expect(cyclic.ok).toBe(false);
  });
});

describe('graph mutation helpers', () => {
  const nodes = buildLinearChain();

  it('removes a node together with its edges', () => {
    const connected = connectNodes(nodes, [], 'a', 'b');
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;

    const result = removeNodeFromGraph(nodes, connected.edges, 'b');
    expect(result.nodes.map((node) => node.id)).toEqual(['a', 'c', 'd']);
    expect(result.edges).toHaveLength(0);
  });

  it('duplicates a node with an offset position and independent params', () => {
    const result = duplicateNodeInGraph(nodes, 'b');
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.nodes).toHaveLength(nodes.length + 1);
    expect(result.newNode.id).not.toBe('b');
    expect(result.newNode.position).toEqual({ x: 40, y: 140 });
    expect(result.newNode.params).not.toBe(
      nodes.find((node) => node.id === 'b')?.params,
    );
  });

  it('returns null when duplicating a missing node', () => {
    expect(duplicateNodeInGraph(nodes, 'nope')).toBeNull();
  });

  it('patches params immutably', () => {
    const updated = updateNodeParams(nodes, 'b', { out_features: 256 });
    const target = updated.find((node) => node.id === 'b');
    expect(target?.params.out_features).toBe(256);
    expect(nodes.find((node) => node.id === 'b')?.params.out_features).toBe(128);
  });

  it('moves a node without touching the others', () => {
    const moved = moveNodeInGraph(nodes, 'c', { x: 55.4, y: 66.6 });
    expect(moved.find((node) => node.id === 'c')?.position).toEqual({
      x: 55,
      y: 67,
    });
    expect(moved.find((node) => node.id === 'a')?.position).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('suggests a free position below the lowest node', () => {
    expect(nextFreePosition([])).toEqual({ x: 80, y: 80 });
    expect(nextFreePosition(nodes)).toEqual({ x: 80, y: 410 });
  });
});

describe('serialization', () => {
  const example = EXAMPLES[0];

  it('round-trips a document', () => {
    const text = serializeDocument(example.document);
    const parsed = parseDocument(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.nodes).toHaveLength(example.document.nodes.length);
    expect(parsed.document.edges).toHaveLength(example.document.edges.length);
    expect(parsed.document.name).toBe(example.document.name);
  });

  it('rejects an unsupported schema version', () => {
    const parsed = parseDocument(
      JSON.stringify({ schemaVersion: 999, name: 'x', nodes: [], edges: [] }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/schemaVersion/);
  });

  it('rejects unknown node types', () => {
    const parsed = parseDocument(
      JSON.stringify({
        schemaVersion: 1,
        name: 'x',
        nodes: [
          { id: 'n1', type: 'conv2d', position: { x: 0, y: 0 }, params: {} },
        ],
        edges: [],
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('rejects edges pointing at missing nodes', () => {
    const parsed = parseDocument(
      JSON.stringify({
        schemaVersion: 1,
        name: 'x',
        nodes: [
          {
            id: 'n1',
            type: 'relu',
            position: { x: 0, y: 0 },
            params: {},
          },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'ghost' }],
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('rejects unknown parameter keys', () => {
    const parsed = parseDocument(
      JSON.stringify({
        schemaVersion: 1,
        name: 'x',
        nodes: [
          {
            id: 'n1',
            type: 'linear',
            position: { x: 0, y: 0 },
            params: { out_features: 32, nonsense: 1 },
          },
        ],
        edges: [],
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('fills in missing params with registry defaults', () => {
    const parsed = parseDocument(
      JSON.stringify({
        schemaVersion: 1,
        name: 'x',
        nodes: [
          { id: 'n1', type: 'linear', position: { x: 0, y: 0 }, params: {} },
        ],
        edges: [],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.nodes[0].params).toEqual(
      createDefaultParams('linear'),
    );
  });

  it('rejects an out-of-range dropout probability', () => {
    const document = structuredClone(EXAMPLES[0].document);
    const dropout = document.nodes.find((node) => node.type === 'dropout');
    if (!dropout) throw new Error('Missing fixture');
    dropout.params.p = 3;
    expect(parseDocument(JSON.stringify(document)).ok).toBe(false);
  });

  it('rejects fractional integer parameter values', () => {
    const document = structuredClone(EXAMPLES[0].document);
    document.nodes[0].params.features = 5.5;
    expect(parseDocument(JSON.stringify(document)).ok).toBe(false);
  });

  it('rejects branching or cyclic imported JSON', () => {
    const document = structuredClone(EXAMPLES[0].document);
    document.edges.push({ id: 'branch', source: 'mlp-input', target: 'mlp-dropout' });
    expect(parseDocument(JSON.stringify(document)).ok).toBe(false);
  });

  it('rejects a second input or output node', () => {
    const document = structuredClone(EXAMPLES[0].document);
    document.nodes.push(createNode('input', { x: 300, y: 300 }, 'another-input'));
    expect(parseDocument(JSON.stringify(document)).ok).toBe(false);
  });

  it('rejects malformed JSON', () => {
    const parsed = parseDocument('{ not json');
    expect(parsed.ok).toBe(false);
  });

  it('produces the current schema version via toDocument', () => {
    const document = toDocument('Test', [], []);
    expect(document.schemaVersion).toBe(1);
    expect(document.name).toBe('Test');
  });
});
