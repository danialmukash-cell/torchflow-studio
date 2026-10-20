import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';
import { LayerNode, type LayerFlowNode } from './LayerNode';
import { getNodeSpec, summarizeNode } from '../graph/nodeRegistry';
import { NODE_TYPE_IDS, type NodeTypeId } from '../types/graph';

const nodeTypes = { layer: LayerNode };

function CanvasInner() {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId);
  const validation = useGraphStore((state) => state.validation);
  const fitViewRequest = useGraphStore((state) => state.fitViewRequest);
  const addNode = useGraphStore((state) => state.addNode);
  const moveNode = useGraphStore((state) => state.moveNode);
  const deleteNode = useGraphStore((state) => state.deleteNode);
  const deleteEdge = useGraphStore((state) => state.deleteEdge);
  const connect = useGraphStore((state) => state.connect);
  const selectNode = useGraphStore((state) => state.selectNode);
  const selectEdge = useGraphStore((state) => state.selectEdge);
  const loadExample = useGraphStore((state) => state.loadExample);

  const { screenToFlowPosition, fitView } = useReactFlow();

  const rfNodes = useMemo<LayerFlowNode[]>(
    () =>
      nodes.map((node) => {
        const spec = getNodeSpec(node.type);
        return {
          id: node.id,
          type: 'layer',
          position: node.position,
          selected: node.id === selectedNodeId,
          data: {
            nodeType: node.type,
            label: spec.label,
            summary: summarizeNode(node.type, node.params),
            accent: spec.accent,
            shape: validation?.shapes[node.id],
            error: validation?.nodeErrors[node.id],
          },
        };
      }),
    [nodes, selectedNodeId, validation],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        selected: edge.id === selectedEdgeId,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        style: { stroke: '#64748b', strokeWidth: 2 },
      })),
    [edges, selectedEdgeId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<LayerFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position);
        } else if (change.type === 'remove') {
          deleteNode(change.id);
        }
      }
    },
    [moveNode, deleteNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') deleteEdge(change.id);
        else if (change.type === 'select') selectEdge(change.selected ? change.id : null);
      }
    },
    [deleteEdge, selectEdge],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      connect(connection.source, connection.target);
    },
    [connect],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/torchflow-node');
      if (!raw) return;
      if (!NODE_TYPE_IDS.includes(raw as NodeTypeId)) return;

      const point = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(raw as NodeTypeId, { x: point.x - 88, y: point.y - 30 });
    },
    [addNode, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  useEffect(() => {
    if (fitViewRequest === 0) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.25, duration: 300 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [fitViewRequest, fitView]);

  return (
    <div
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => { selectNode(null); selectEdge(null); }}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="#475569"
          maskColor="rgba(2, 6, 23, 0.75)"
        />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[420px] rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center shadow-2xl backdrop-blur">
            <h2 className="text-sm font-semibold text-slate-100">
              This canvas is empty
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Drag a node from the palette on the left, or start from a working
              example.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => loadExample('mlp-classifier')}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Load MLP example
              </button>
              <button
                type="button"
                onClick={() => loadExample('binary-classifier')}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Load binary example
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
