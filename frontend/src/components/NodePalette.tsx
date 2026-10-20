import {
  CATEGORY_LABELS,
  NODE_TYPE_SPECS,
  PALETTE_ORDER,
  type NodeCategory,
} from '../graph/nodeRegistry';
import { useGraphStore } from '../store/graphStore';

const CATEGORIES: NodeCategory[] = ['io', 'layer', 'activation'];

export function NodePalette() {
  const addNode = useGraphStore((state) => state.addNode);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Node palette
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Drag onto the canvas, or click to append.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {CATEGORIES.map((category) => {
          const ids = PALETTE_ORDER.filter(
            (id) => NODE_TYPE_SPECS[id].category === category,
          );
          if (ids.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-1.5">
                {ids.map((id) => {
                  const spec = NODE_TYPE_SPECS[id];
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        title={spec.description}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            'application/torchflow-node',
                            id,
                          );
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => addNode(id)}
                        className="flex w-full cursor-grab items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-left transition hover:border-slate-600 hover:bg-slate-800/80 active:cursor-grabbing"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: spec.accent }}
                        />
                        <span className="text-xs font-medium text-slate-200">
                          {spec.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="border-t border-slate-800 p-3 text-[11px] leading-snug text-slate-500">
        Milestone 1 supports a single sequential path: one input, one output,
        no branching.
      </p>
    </aside>
  );
}
