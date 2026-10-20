import type { NodeTypeId, ParamMap, ParamValue } from '../types/graph';

export type ParamKind = 'int' | 'float' | 'boolean' | 'select';

export type ParamSpec = {
  key: string;
  label: string;
  kind: ParamKind;
  defaultValue: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  help?: string;
};

export type NodeCategory = 'io' | 'layer' | 'activation';

export type NodeTypeSpec = {
  id: NodeTypeId;
  label: string;
  category: NodeCategory;
  description: string;
  /** Hex colour used for the node accent dot and handles. */
  accent: string;
  allowIncoming: boolean;
  allowOutgoing: boolean;
  params: ParamSpec[];
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  io: 'Input / Output',
  layer: 'Layers',
  activation: 'Activations',
};

/**
 * The single source of truth for node types. Adding a node type means adding an
 * entry here — the palette, inspector form, canvas node, and JSON validator all
 * read from this registry.
 */
export const NODE_TYPE_SPECS: Record<NodeTypeId, NodeTypeSpec> = {
  input: {
    id: 'input',
    label: 'Input',
    category: 'io',
    description:
      'Entry point of the network. Declares the number of input features.',
    accent: '#38bdf8',
    allowIncoming: false,
    allowOutgoing: true,
    params: [
      {
        key: 'features',
        label: 'Features',
        kind: 'int',
        defaultValue: 784,
        min: 1,
        step: 1,
        help: 'Size of the flattened input vector (784 for 28×28 images).',
      },
    ],
  },
  linear: {
    id: 'linear',
    label: 'Linear',
    category: 'layer',
    description:
      'Fully connected layer (nn.Linear). The input size is inferred from the previous layer.',
    accent: '#a78bfa',
    allowIncoming: true,
    allowOutgoing: true,
    params: [
      {
        key: 'out_features',
        label: 'Out features',
        kind: 'int',
        defaultValue: 128,
        min: 1,
        step: 1,
      },
      { key: 'bias', label: 'Bias', kind: 'boolean', defaultValue: true },
    ],
  },
  relu: {
    id: 'relu',
    label: 'ReLU',
    category: 'activation',
    description: 'Element-wise rectified linear unit (nn.ReLU).',
    accent: '#34d399',
    allowIncoming: true,
    allowOutgoing: true,
    params: [],
  },
  sigmoid: {
    id: 'sigmoid',
    label: 'Sigmoid',
    category: 'activation',
    description: 'Element-wise logistic sigmoid (nn.Sigmoid).',
    accent: '#fbbf24',
    allowIncoming: true,
    allowOutgoing: true,
    params: [],
  },
  tanh: {
    id: 'tanh',
    label: 'Tanh',
    category: 'activation',
    description: 'Element-wise hyperbolic tangent (nn.Tanh).',
    accent: '#fb923c',
    allowIncoming: true,
    allowOutgoing: true,
    params: [],
  },
  flatten: {
    id: 'flatten',
    label: 'Flatten',
    category: 'layer',
    description:
      'Flattens every dimension except the batch dimension (nn.Flatten).',
    accent: '#22d3ee',
    allowIncoming: true,
    allowOutgoing: true,
    params: [],
  },
  dropout: {
    id: 'dropout',
    label: 'Dropout',
    category: 'layer',
    description: 'Randomly zeroes elements during training (nn.Dropout).',
    accent: '#94a3b8',
    allowIncoming: true,
    allowOutgoing: true,
    params: [
      {
        key: 'p',
        label: 'Probability',
        kind: 'float',
        defaultValue: 0.5,
        min: 0,
        max: 0.99,
        step: 0.05,
      },
    ],
  },
  output: {
    id: 'output',
    label: 'Output',
    category: 'io',
    description:
      'Exit point of the network. Declares how many values the model returns.',
    accent: '#f472b6',
    allowIncoming: true,
    allowOutgoing: false,
    params: [
      {
        key: 'classes',
        label: 'Output size',
        kind: 'int',
        defaultValue: 10,
        min: 1,
        step: 1,
      },
    ],
  },
};

/** Order in which node types appear in the palette. */
export const PALETTE_ORDER: NodeTypeId[] = [
  'input',
  'output',
  'linear',
  'flatten',
  'dropout',
  'relu',
  'sigmoid',
  'tanh',
];

export function getNodeSpec(type: NodeTypeId): NodeTypeSpec {
  return NODE_TYPE_SPECS[type];
}

export function createDefaultParams(type: NodeTypeId): ParamMap {
  const params: ParamMap = {};
  for (const spec of NODE_TYPE_SPECS[type].params) {
    params[spec.key] = spec.defaultValue;
  }
  return params;
}

/** Short human-readable parameter summary rendered inside a canvas node. */
export function summarizeNode(type: NodeTypeId, params: ParamMap): string {
  switch (type) {
    case 'input':
      return `features: ${String(params.features ?? '?')}`;
    case 'output':
      return `size: ${String(params.classes ?? '?')}`;
    case 'linear':
      return `out: ${String(params.out_features ?? '?')}${
        params.bias === false ? ' · no bias' : ''
      }`;
    case 'dropout':
      return `p: ${String(params.p ?? '?')}`;
    case 'relu':
    case 'sigmoid':
    case 'tanh':
    case 'flatten':
      return 'element-wise';
    default:
      return '';
  }
}
