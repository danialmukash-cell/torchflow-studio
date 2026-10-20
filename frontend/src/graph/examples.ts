import type { GraphDocument, GraphNode, NodeTypeId, ParamMap } from '../types/graph';
import { GRAPH_SCHEMA_VERSION } from '../types/graph';
import { createDefaultParams } from './nodeRegistry';

export type ExampleKey = 'mlp-classifier' | 'binary-classifier';

export type ExampleDefinition = {
  key: ExampleKey;
  label: string;
  description: string;
  document: GraphDocument;
};

function node(
  id: string,
  type: NodeTypeId,
  y: number,
  overrides: ParamMap = {},
): GraphNode {
  return {
    id,
    type,
    position: { x: 0, y },
    params: { ...createDefaultParams(type), ...overrides },
  };
}

function chain(nodes: GraphNode[], prefix: string): GraphDocument['edges'] {
  const edges: GraphDocument['edges'] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    edges.push({
      id: `${prefix}-edge-${index + 1}`,
      source: nodes[index].id,
      target: nodes[index + 1].id,
    });
  }
  return edges;
}

const mlpNodes: GraphNode[] = [
  node('mlp-input', 'input', 0, { features: 784 }),
  node('mlp-linear-1', 'linear', 110, { out_features: 128 }),
  node('mlp-relu-1', 'relu', 220),
  node('mlp-dropout', 'dropout', 330, { p: 0.2 }),
  node('mlp-linear-2', 'linear', 440, { out_features: 64 }),
  node('mlp-relu-2', 'relu', 550),
  node('mlp-linear-3', 'linear', 660, { out_features: 10 }),
  node('mlp-output', 'output', 770, { classes: 10 }),
];

const binaryNodes: GraphNode[] = [
  node('binary-input', 'input', 0, { features: 20 }),
  node('binary-linear-1', 'linear', 110, { out_features: 32 }),
  node('binary-tanh', 'tanh', 220),
  node('binary-linear-2', 'linear', 330, { out_features: 16 }),
  node('binary-linear-3', 'linear', 440, { out_features: 1 }),
  node('binary-sigmoid', 'sigmoid', 550),
  node('binary-output', 'output', 660, { classes: 1 }),
];

export const EXAMPLES: ExampleDefinition[] = [
  {
    key: 'mlp-classifier',
    label: 'MLP classifier (784 → 10)',
    description:
      'Two hidden layers with ReLU and dropout, ending in a 10-way output.',
    document: {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      name: 'MLP classifier',
      nodes: mlpNodes,
      edges: chain(mlpNodes, 'mlp'),
    },
  },
  {
    key: 'binary-classifier',
    label: 'Binary classifier (20 → 1)',
    description:
      'Small tanh/sigmoid network producing a single probability.',
    document: {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      name: 'Binary classifier',
      nodes: binaryNodes,
      edges: chain(binaryNodes, 'binary'),
    },
  },
];

export function getExample(key: ExampleKey): ExampleDefinition {
  const found = EXAMPLES.find((example) => example.key === key);
  if (!found) throw new Error(`Unknown example "${key}".`);
  return found;
}
