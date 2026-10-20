import { useEffect, useState } from 'react';
import type { ParamSpec } from '../graph/nodeRegistry';
import type { ParamValue } from '../types/graph';

type Props = {
  spec: ParamSpec;
  value: ParamValue | undefined;
  onChange: (value: ParamValue) => void;
};

const inputClasses =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-sky-500';

export function ParamField({ spec, value, onChange }: Props) {
  const current = value ?? spec.defaultValue;

  if (spec.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(current)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
        />
        <span className="text-xs text-slate-300">{spec.label}</span>
      </label>
    );
  }

  if (spec.kind === 'select') {
    return (
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {spec.label}
        </span>
        <select
          value={String(current)}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
        >
          {spec.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <NumberParamField
      spec={spec}
      value={current}
      onChange={onChange}
    />
  );
}

function NumberParamField({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
}) {
  const [text, setText] = useState(() => String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (next: string) => {
    setText(next);
    const trimmed = next.trim();
    if (trimmed === '') return;

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) return;
    if (spec.kind === 'int' && !Number.isInteger(parsed)) return;
    if (spec.min !== undefined && parsed < spec.min) return;
    if (spec.max !== undefined && parsed > spec.max) return;

    onChange(parsed);
  };

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {spec.label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        min={spec.min}
        max={spec.max}
        step={spec.step ?? (spec.kind === 'int' ? 1 : 0.01)}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setText(String(value))}
        className={inputClasses}
      />
      {spec.help && (
        <span className="mt-1 block text-[11px] leading-snug text-slate-500">
          {spec.help}
        </span>
      )}
    </label>
  );
}
