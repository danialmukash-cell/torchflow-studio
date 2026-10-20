import { getNodeSpec } from '../graph/nodeRegistry';
import { useGraphStore } from '../store/graphStore';
import { ParamField } from './ParamField';

export function Inspector() {
  const graphName = useGraphStore((state) => state.graphName);
  const setGraphName = useGraphStore((state) => state.setGraphName);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const deleteNode = useGraphStore((state) => state.deleteNode);
  const duplicateNode = useGraphStore((state) => state.duplicateNode);

  const selected = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const spec = selected ? getNodeSpec(selected.type) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="border-b border-slate-800 p-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Graph name
          </span>
          <input
            type="text"
            value={graphName}
            onChange={(event) => setGraphName(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>
        <p className="mt-2 text-[11px] text-slate-500">
          {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'} ·{' '}
          {edges.length} {edges.length === 1 ? 'connection' : 'connections'}
        </p>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selected || !spec ? (
          <EmptyInspector />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: spec.accent }}
                />
                <h3 className="text-sm font-semibold text-slate-100">
                  {spec.label}
                </h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                {spec.description}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-600">
                {selected.id}
              </p>
            </div>

            {spec.params.length > 0 ? (
              <div className="space-y-3">
                {spec.params.map((paramSpec) => (
                  <ParamField
                    key={paramSpec.key}
                    spec={paramSpec}
                    value={selected.params[paramSpec.key]}
                    onChange={(value) =>
                      updateNodeParams(selected.id, {
                        [paramSpec.key]: value,
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-slate-800 bg-slate-900/60 p-2.5 text-[11px] text-slate-500">
                This node has no configurable parameters.
              </p>
            )}

            <div className="flex gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => duplicateNode(selected.id)}
                className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => deleteNode(selected.id)}
                className="flex-1 rounded-md border border-rose-900/70 bg-rose-950/50 px-2.5 py-1.5 text-[11px] font-medium text-rose-300 transition hover:bg-rose-950"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div className="space-y-3 text-[11px] leading-relaxed text-slate-500">
      <p className="text-xs font-medium text-slate-300">Nothing selected</p>
      <ul className="space-y-1.5">
        <li>· Click a node to edit its parameters.</li>
        <li>· Drag from a node&apos;s right handle to its target&apos;s left handle to connect them.</li>
        <li>· Select a node or a connection and press Backspace or Delete to remove it.</li>
        <li>· Use the toolbar to save, load, or start from an example.</li>
      </ul>
      <p className="rounded-md border border-slate-800 bg-slate-900/60 p-2.5">
        Use Validate to inspect tensor shapes and Generate PyTorch to export executable model code.
      </p>
    </div>
  );
}
