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
import { generateModel, validateGraph, type ValidateResponseDto } from '../api/client';

export type Notice = { kind: 'error' | 'info'; message: string };

const infoNotice = (message: string): Notice => ({ kind: 'info', message });
const errorNotice = (message: string): Notice => ({ kind: 'error', message });

export type GraphStore = {
  validation: ValidateResponseDto | null;
  generatedCode: string | null;
  backendStatus: 'idle' | 'validating' | 'generating';
  revision: number;
  requestId: number;
  validate: () => Promise<void>;
  generate: () => Promise<void>;
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
  validation: null,
  generatedCode: null,
  backendStatus: 'idle',
  revision: 0,
  requestId: 0,

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
        validation: null, generatedCode: null, backendStatus: 'idle',
        revision: state.revision + 1, requestId: state.requestId + 1,
      };
    }),

  moveNode: (id, position) =>
    set((state) => ({ nodes: moveNodeInGraph(state.nodes, id, position) })),

  updateNodeParams: (id, patch) =>
    set((state) => ({ nodes: applyParamPatch(state.nodes, id, patch), validation: null, generatedCode: null, backendStatus: 'idle', revision: state.revision + 1, requestId: state.requestId + 1 })),

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
        validation: null, generatedCode: null, backendStatus: 'idle', revision: state.revision + 1, requestId: state.requestId + 1,
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
      return { nodes: result.nodes, selectedNodeId: result.newNode.id, selectedEdgeId: null, validation: null, generatedCode: null, backendStatus: 'idle' as const, revision: state.revision + 1, requestId: state.requestId + 1 };
    }),

  deleteEdge: (id) =>
    set((state) => ({ edges: state.edges.filter((edge) => edge.id !== id), selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId, validation: null, generatedCode: null, backendStatus: 'idle', revision: state.revision + 1, requestId: state.requestId + 1 })),

  connect: (source, target) =>
    set((state) => {
      const outcome = connectNodes(state.nodes, state.edges, source, target);
      if (!outcome.ok) {
        return { notice: errorNotice(outcome.reason) };
      }
      return { edges: outcome.edges, notice: null, validation: null, generatedCode: null, backendStatus: 'idle' as const, revision: state.revision + 1, requestId: state.requestId + 1 };
    }),

  selectNode: (id) => set({ selectedNodeId: id, ...(id ? { selectedEdgeId: null } : {}) }),

  selectEdge: (id) => set({ selectedEdgeId: id, ...(id ? { selectedNodeId: null } : {}) }),

  setGraphName: (name) => set((state) => ({ graphName: name, generatedCode: null, revision: state.revision + 1, requestId: state.requestId + 1, backendStatus: 'idle' })),

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
        revision: state.revision + 1, requestId: state.requestId + 1,
        validation: null, generatedCode: null, backendStatus: 'idle',
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

  validate: async () => {
    const { revision, requestId } = get();
    const request = requestId + 1;
    const document = get().getDocument();
    set({ requestId: request, backendStatus: 'validating', notice: null, generatedCode: null });
    try {
      const result = await validateGraph(document);
      if (get().revision !== revision || get().requestId !== request) return;
      set({ validation: result, backendStatus: 'idle', notice: result.valid
        ? infoNotice('Graph is valid — tensor shapes are available.')
        : errorNotice(`${result.errors.length} validation issue(s). See Validation tab.`) });
    } catch (error) {
      if (get().revision !== revision || get().requestId !== request) return;
      set({ backendStatus: 'idle', validation: null, notice: errorNotice(error instanceof Error ? error.message : String(error)) });
    }
  },
  generate: async () => {
    const { revision, requestId } = get();
    const request = requestId + 1;
    const document = get().getDocument();
    set({ requestId: request, backendStatus: 'generating', notice: null, generatedCode: null });
    try {
      const [validation, result] = await Promise.all([validateGraph(document), generateModel(document)]);
      if (get().revision !== revision || get().requestId !== request) return;
      set({
        backendStatus: 'idle', validation,
        generatedCode: result.valid ? result.code : null,
        notice: result.valid
          ? infoNotice('PyTorch nn.Module generated.')
          : errorNotice(result.errors.map((issue) => issue.message).join(' | ') || 'Invalid graph.'),
      });
    } catch (error) {
      if (get().revision !== revision || get().requestId !== request) return;
      set({ backendStatus: 'idle', validation: null, notice: errorNotice(error instanceof Error ? error.message : String(error)) });
    }
  },
}));
