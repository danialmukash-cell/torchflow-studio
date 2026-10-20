/**
 * Canonical, framework-agnostic representation of a TorchFlow graph.
 *
 * IMPORTANT: this file must never import React, React Flow, or anything from
 * the UI layer. The same structure is what Milestone 2 sends to the Python
 * backend, so it has to stay portable and serialisable.
 */

export const GRAPH_SCHEMA_VERSION = 1;

export const NODE_TYPE_IDS = [
  'input',
  'linear',
  'relu',
  'sigmoid',
  'tanh',
  'flatten',
  'dropout',
  'output',
] as const;

export type NodeTypeId = (typeof NODE_TYPE_IDS)[number];

export type ParamValue = number | string | boolean;

export type ParamMap = Record<string, ParamValue>;

export type Vec2 = { x: number; y: number };

export type GraphNode = {
  id: string;
  type: NodeTypeId;
  position: Vec2;
  params: ParamMap;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type GraphDocument = {
  schemaVersion: number;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};
