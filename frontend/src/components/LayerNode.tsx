import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { getNodeSpec } from '../graph/nodeRegistry';
import type { NodeTypeId } from '../types/graph';

export type LayerNodeData = {
  nodeType: NodeTypeId;
  label: string;
  summary: string;
  accent: string;
};

export type LayerFlowNode = Node<LayerNodeData, 'layer'>;

const handleStyle = (accent: string) => ({
  width: 10,
  height: 10,
  background: accent,
  border: '2px solid #020617',
});

export function LayerNode({ data, selected }: NodeProps<LayerFlowNode>) {
  const spec = getNodeSpec(data.nodeType);

  return (
    <div
      className="min-w-[176px] rounded-lg border bg-slate-900 px-3 py-2 shadow-lg transition-colors"
      style={{ borderColor: selected ? data.accent : '#334155' }}
    >
      {spec.allowIncoming && (
        <Handle
          type="target"
          position={Position.Left}
          style={handleStyle(data.accent)}
        />
      )}

      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: data.accent }}
        />
        <span className="text-xs font-semibold tracking-wide text-slate-100">
          {data.label}
        </span>
      </div>
      <div className="mt-1 font-mono text-[11px] text-slate-400">
        {data.summary}
      </div>

      {spec.allowOutgoing && (
        <Handle
          type="source"
          position={Position.Right}
          style={handleStyle(data.accent)}
        />
      )}
    </div>
  );
}
