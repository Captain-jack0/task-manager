import { formatDate } from '@/lib/date';
import type { BurndownPoint } from '@/types/api';

const W = 320;
const H = 130;
const PAD = { left: 22, right: 8, top: 8, bottom: 16 };

const formatDay = (day: string) => formatDate(`${day}T00:00:00`);

/** Remaining tasks per sprint day against a straight ideal line. */
export function BurndownChart({ points }: { points: BurndownPoint[] }) {
  if (points.length === 0) return null;
  const yMax = Math.max(1, ...points.map((p) => Math.max(p.ideal, p.remaining ?? 0)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const ideal = points.map((p, i) => `${x(i).toFixed(1)},${y(p.ideal).toFixed(1)}`).join(' ');
  const measured = points.flatMap((p, i) => (p.remaining === null ? [] : [{ i, v: p.remaining, p }]));
  const actual = measured.map(({ i, v }) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const colW = points.length === 1 ? innerW : innerW / (points.length - 1);

  return (
    <figure>
      <div className="mb-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded bg-[#2a78d6] dark:bg-[#3987e5]" aria-hidden />
          Remaining
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-3 border-t-2 border-dashed border-slate-400" aria-hidden />
          Ideal
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sprint burndown">
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
        <text x={PAD.left - 4} y={y(yMax) + 3} textAnchor="end" fontSize={8} className="fill-slate-400">
          {yMax}
        </text>
        <text x={PAD.left - 4} y={y(0) + 3} textAnchor="end" fontSize={8} className="fill-slate-400">
          0
        </text>
        <polyline points={ideal} fill="none" strokeWidth={1.5} strokeDasharray="4 3" className="stroke-slate-400 dark:stroke-slate-500" data-series="ideal" />
        {actual && (
          <polyline
            points={actual}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
            data-series="remaining"
          />
        )}
        {points.map((p, i) => (
          <g key={p.day}>
            <title>
              {formatDay(p.day)}: {p.remaining === null ? 'not yet' : `${p.remaining} remaining`} · ideal {p.ideal}
            </title>
            <rect x={x(i) - colW / 2} y={PAD.top} width={colW} height={innerH} fill="transparent" />
            {p.remaining !== null && <circle cx={x(i)} cy={y(p.remaining)} r={3} className="fill-[#2a78d6] dark:fill-[#3987e5]" />}
          </g>
        ))}
        <text x={PAD.left} y={H - 4} fontSize={8} className="fill-slate-400">
          {formatDay(points[0].day)}
        </text>
        <text x={W - PAD.right} y={H - 4} fontSize={8} textAnchor="end" className="fill-slate-400">
          {formatDay(points[points.length - 1].day)}
        </text>
      </svg>
      <details className="mt-1 text-xs text-slate-500">
        <summary className="cursor-pointer">Table view</summary>
        <table className="mt-1 w-full">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="font-medium">Day</th>
              <th className="text-right font-medium">Remaining</th>
              <th className="text-right font-medium">Ideal</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <td className="py-0.5">{formatDay(p.day)}</td>
                <td className="py-0.5 text-right tabular-nums">{p.remaining ?? '–'}</td>
                <td className="py-0.5 text-right tabular-nums">{p.ideal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
