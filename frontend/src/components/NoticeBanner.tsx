import { useGraphStore } from '../store/graphStore';

export function NoticeBanner() {
  const notice = useGraphStore((state) => state.notice);
  const dismissNotice = useGraphStore((state) => state.dismissNotice);

  if (!notice) return null;

  const isError = notice.kind === 'error';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg border px-4 py-2.5 shadow-2xl ${
          isError
            ? 'border-rose-800 bg-rose-950/95 text-rose-100'
            : 'border-sky-800 bg-sky-950/95 text-sky-100'
        }`}
      >
        <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {isError ? 'Error' : 'Info'}
        </span>
        <span className="flex-1 text-xs leading-relaxed">
          {notice.message}
        </span>
        <button
          type="button"
          onClick={dismissNotice}
          className="rounded px-1 text-xs opacity-70 transition hover:opacity-100"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
