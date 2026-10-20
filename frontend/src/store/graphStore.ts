import { create } from 'zustand';
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  NodeTypeId,
  ParamMap,
  Vec2,
} from '../types/graph';
import {
  connectNodes,
  createNode,
  duplicateNodeInGraph,
  moveNodeInGraph,
  nextFreePosition,
  removeNodeFromGraph,
  updateNodeParams as applyParamPatch,
} from '../graph/model';
import { toDocument } from '../graph/serialization';
import { getExample, type ExampleKey } from '../graph/examples';

export type Notice = { kind: 'error' | 'info'; message: string };

const infoNotice = (message: string): Notice => ({ kind: 'info', message });
const errorNotice = (message: string): Notice => ({ kind: 'error', message });

export type GraphStore = {
  graphName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  notice: Notice | null;
  /** Incremented whenever the viewport should re-fit (load / new graph). */
  fitViewRequest: number;

  addNode: (type: NodeTypeId, position?: Vec2) => void;
  moveNode: (id: string, position: Vec2) => void;
  updateNodeParams: (id: string, patch: ParamMap) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  connect: (source: string, target: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setGraphName: (name: string) => void;
  loadDocument: (document: GraphDocument, options?: { silent?: boolean }) => void;
  loadExample: (key: ExampleKey) => void;
  newGraph: () => void;
  getDocument: () => GraphDocument;
  notify: (notice: Notice) => void;
  dismissNotice: () => void;
};

export const useGraphStore = create<GraphStore>()((set, get) => ({
  graphName: 'Untitled network',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  notice: null,
  fitViewRequest: 0,

  addNode: (type, position) =>
    set((state) => {
      if ((type === 'input' || type === 'output') && state.nodes.some((n) => n.type === type)) {
        return { notice: errorNotice(`Only one ${type} node is supported in the current editor.`) };
      }
      const point = position ?? nextFreePosition(state.nodes);
      const node = createNode(type, point);
      return {
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        selectedEdgeId: null,
        notice: null,
      };
    }),

  moveNode: (id, position) =>
    set((state) => ({ nodes: moveNodeInGraph(state.nodes, id, position) })),

  updateNodeParams: (id, patch) =>
    set((state) => ({ nodes: applyParamPatch(state.nodes, id, patch) })),

  deleteNode: (id) =>
    set((state) => {
      const { nodes, edges } = removeNodeFromGraph(
        state.nodes,
        state.edges,
        id,
      );
      return {
        nodes,
        edges,
        selectedNodeId:
          state.selectedNodeId === id ? null : state.selectedNodeId,
        selectedEdgeId: edges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null,
      };
    }),

  duplicateNode: (id) =>
    set((state) => {
      const original = state.nodes.find((node) => node.id === id);
      if (original?.type === 'input' || original?.type === 'output') {
        return { notice: errorNotice(`Only one ${original.type} node is supported.`) };
      }
      const result = duplicateNodeInGraph(state.nodes, id);
      if (!result) return {};
      return { nodes: result.nodes, selectedNodeId: result.newNode.id, selectedEdgeId: null };
    }),

  deleteEdge: (id) =>
    set((state) => ({ edges: state.edges.filter((edge) => edge.id !== id), selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId })),

  connect: (source, target) =>
    set((state) => {
      const outcome = connectNodes(state.nodes, state.edges, source, target);
      if (!outcome.ok) {
        return { notice: errorNotice(outcome.reason) };
      }
      return { edges: outcome.edges, notice: null };
    }),

  selectNode: (id) => set({ selectedNodeId: id, ...(id ? { selectedEdgeId: null } : {}) }),

  selectEdge: (id) => set({ selectedEdgeId: id, ...(id ? { selectedNodeId: null } : {}) }),

  setGraphName: (name) => set({ graphName: name }),

  loadDocument: (document, options) =>
    set((state) => {
      const clone = JSON.parse(JSON.stringify(document)) as GraphDocument;
      return {
        graphName: clone.name,
        nodes: clone.nodes,
        edges: clone.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        fitViewRequest: state.fitViewRequest + 1,
        notice: options?.silent
          ? null
          : infoNotice(`Loaded graph "${clone.name}".`),
      };
    }),

  loadExample: (key) => {
    const example = getExample(key);
    get().loadDocument(example.document);
  },

  newGraph: () =>
    set((state) => ({
      graphName: 'Untitled network',
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      notice: infoNotice('Started a new graph.'),
      fitViewRequest: state.fitViewRequest + 1,
    })),

  getDocument: () =>
    toDocument(get().graphName, get().nodes, get().edges),

  notify: (notice) => set({ notice }),

  dismissNotice: () => set({ notice: null }),
}));
