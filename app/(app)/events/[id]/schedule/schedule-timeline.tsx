"use client";

import { dayRange, barGeometry, hhmmToMinutes, hourTicks, minutesToLabel } from "@/lib/calc/schedule";
import {
  type ScheduleRow,
  TYPE_COLORS,
  TYPE_COLOR_DEFAULT,
  TYPE_LABELS,
  formatDateLabel,
  groupByDate,
  supplierLabel,
} from "./schedule-shared";

type ToggleFn = (row: ScheduleRow, field: "completed" | "critical_path", value: boolean) => void;

export function ScheduleTimeline({ rows, onToggle }: { rows: ScheduleRow[]; onToggle: ToggleFn }) {
  const groups = groupByDate(rows);
  if (groups.length === 0) {
    return (
      <div className="rounded-md border px-3 py-10 text-center text-sm text-[var(--muted-foreground)]">
        No schedule entries.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <DayTimeline key={g.date ?? "undated"} date={g.date} rows={g.rows} onToggle={onToggle} />
      ))}
      <Legend />
    </div>
  );
}

function barLabel(r: ScheduleRow): string {
  return r.action ?? (r.type ? TYPE_LABELS[r.type] : null) ?? "—";
}
function barTitle(r: ScheduleRow): string {
  const time = `${r.startTime ?? ""}${r.finishTime ? `–${r.finishTime}` : ""}`.trim();
  const sup = supplierLabel(r);
  return [time, barLabel(r), sup].filter(Boolean).join(" · ");
}
function barClasses(r: ScheduleRow): string {
  const color = (r.type && TYPE_COLORS[r.type]) || TYPE_COLOR_DEFAULT;
  return `${color} ${r.completed ? "opacity-50" : ""} ${r.criticalPath ? "ring-2 ring-[var(--destructive)]" : ""}`;
}

function DayTimeline({ date, rows, onToggle }: { date: string | null; rows: ScheduleRow[]; onToggle: ToggleFn }) {
  const range = dayRange(rows.map((r) => ({ startTime: r.startTime, finishTime: r.finishTime })));
  const span = range.endMin - range.startMin;
  const ticks = hourTicks(range);
  const timed = rows.filter((r) => hhmmToMinutes(r.startTime) != null);
  const untimed = rows.filter((r) => hhmmToMinutes(r.startTime) == null);
  const pct = (min: number) => ((min - range.startMin) / span) * 100;

  return (
    <div className="rounded-md border">
      <div className="bg-[var(--accent)]/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
        {formatDateLabel(date)} · {rows.length}
      </div>
      <div className="p-3">
        <div className="relative mb-1 h-4 text-[10px] tabular-nums text-[var(--muted-foreground)]">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
              {minutesToLabel(t)}
            </span>
          ))}
        </div>

        {timed.length > 0 ? (
          <div className="relative">
            <div className="pointer-events-none absolute inset-0">
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full w-px bg-slate-200" style={{ left: `${pct(t)}%` }} />
              ))}
            </div>
            <div className="relative space-y-1">
              {timed.map((r) => {
                const geom = barGeometry(hhmmToMinutes(r.startTime), hhmmToMinutes(r.finishTime), range);
                if (!geom) return null;
                return (
                  <div key={r.id} className="relative h-7">
                    <button
                      type="button"
                      onClick={() => onToggle(r, "completed", !r.completed)}
                      title={barTitle(r)}
                      className={`absolute top-0.5 flex h-6 items-center overflow-hidden whitespace-nowrap rounded px-1.5 text-[10px] font-medium text-white ${barClasses(r)}`}
                      style={{ left: `${geom.leftPct}%`, width: `${geom.widthPct}%` }}
                    >
                      {r.completed ? "✓ " : ""}
                      {barLabel(r)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="py-2 text-xs text-[var(--muted-foreground)]">No timed entries this day.</p>
        )}

        {untimed.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Untimed</span>
            {untimed.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onToggle(r, "completed", !r.completed)}
                title={barTitle(r)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${barClasses(r)}`}
              >
                {r.completed ? "✓ " : ""}
                {barLabel(r)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
      {Object.entries(TYPE_LABELS).map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={`h-3 w-3 rounded-sm ${TYPE_COLORS[k] ?? TYPE_COLOR_DEFAULT}`} />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded-sm ring-2 ring-[var(--destructive)]" />
        Critical
      </span>
    </div>
  );
}
