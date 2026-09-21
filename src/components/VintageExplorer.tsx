"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SeriesSummary } from "@/lib/types";

interface HistRow {
  obs_date: string;
  value: number;
  published_at: string;
}

interface Point {
  date: string;
  value: number;
}

const CHART = { w: 920, h: 340, padL: 68, padR: 20, padT: 18, padB: 34 };
const MAX_SLIDER_STEPS = 400;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const monthFormat = new Intl.DateTimeFormat("es", {
  month: "short",
  year: "numeric",
});

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function formatDate(value: string): string {
  return dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) {
    out.push(items[Math.round((i * (items.length - 1)) / (max - 1))]);
  }
  return Array.from(new Set(out));
}

function downsample(points: Point[], max = 1400): Point[] {
  if (points.length <= max) return points;
  return sample(points, max);
}

function buildPath(
  points: Point[],
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): string {
  if (points.length === 0) return "";
  const innerW = CHART.w - CHART.padL - CHART.padR;
  const innerH = CHART.h - CHART.padT - CHART.padB;
  const span = Math.max(1, xMax - xMin);
  const ySpan = Math.max(1e-9, yMax - yMin);
  let path = "";
  points.forEach((point, index) => {
    const t = Date.parse(`${point.date}T00:00:00Z`);
    const x = CHART.padL + ((t - xMin) / span) * innerW;
    const y = CHART.padT + innerH - ((point.value - yMin) / ySpan) * innerH;
    path += `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  return path.trim();
}

export default function VintageExplorer({
  series,
  dbError,
}: {
  series: SeriesSummary[];
  dbError: string | null;
}) {
  const firstWithData = series.find((item) => item.observations > 0);
  const [selectedId, setSelectedId] = useState(
    firstWithData?.id ?? series[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return series;
    return series.filter(
      (item) =>
        item.id.includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.source.toLowerCase().includes(term),
    );
  }, [series, query]);

  const selected = series.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    appliedRef.current = false;
    setLoading(true);
    setError(null);

    const from = new Date();
    from.setUTCFullYear(from.getUTCFullYear() - 6);
    const fromParam = from.toISOString().slice(0, 10);

    fetch(
      `/api/series/${selectedId}/observations?history=true&from=${fromParam}&limit=20000`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`No se pudo cargar la serie (HTTP ${response.status}).`);
        }
        return (await response.json()) as { observations: HistRow[] };
      })
      .then((data) => setRows(data.observations ?? []))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedId]);

  const vintages = useMemo(
    () => Array.from(new Set(rows.map((row) => row.published_at))).sort(),
    [rows],
  );

  const steps = useMemo(() => sample(vintages, MAX_SLIDER_STEPS), [vintages]);
  const appliedRef = useRef(false);

  // Applies the deep-link (/ ?as_of=2024-06-30) or defaults to the latest
  // vintage, once per loaded series.
  useEffect(() => {
    if (appliedRef.current || steps.length === 0) return;
    appliedRef.current = true;
    const param = new URLSearchParams(window.location.search).get("as_of");
    if (param) {
      const target = param.slice(0, 10);
      const found = steps.findIndex((value) => value.slice(0, 10) > target);
      setStepIndex(found === -1 ? steps.length - 1 : Math.max(0, found - 1));
      return;
    }
    setStepIndex(steps.length - 1);
  }, [steps]);

  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const asOf = steps[safeIndex] ?? null;

  const { today, asKnown } = useMemo(() => {
    const byDate = new Map<string, HistRow[]>();
    for (const row of rows) {
      const bucket = byDate.get(row.obs_date);
      if (bucket) bucket.push(row);
      else byDate.set(row.obs_date, [row]);
    }
    const dates = Array.from(byDate.keys()).sort();
    const todayPoints: Point[] = [];
    const asKnownPoints: Point[] = [];
    for (const date of dates) {
      const bucket = byDate.get(date) as HistRow[];
      todayPoints.push({ date, value: bucket[bucket.length - 1].value });
      if (asOf) {
        for (let i = bucket.length - 1; i >= 0; i -= 1) {
          if (bucket[i].published_at <= asOf) {
            asKnownPoints.push({ date, value: bucket[i].value });
            break;
          }
        }
      }
    }
    return { today: todayPoints, asKnown: asKnownPoints };
  }, [rows, asOf]);

  const domains = useMemo(() => {
    if (today.length === 0) return null;
    const values = today.map((point) => point.value);
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const pad = (yMax - yMin) * 0.06;
    return {
      yMin: yMin - pad,
      yMax: yMax + pad,
      xMin: Date.parse(`${today[0].date}T00:00:00Z`),
      xMax: Date.parse(`${today[today.length - 1].date}T00:00:00Z`),
    };
  }, [today]);

  const yTicks = domains
    ? Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        return domains.yMin + ratio * (domains.yMax - domains.yMin);
      })
    : [];

  const lastToday = today[today.length - 1];
  const lastKnown = asKnown[asKnown.length - 1];

  return (
    <div className="panel">
      <h2>Explorador de vintages</h2>
      <p className="hint">
        Elige una serie y mueve el control de fecha para ver qué valor se conocía
        en cada momento, frente a la serie revisada de hoy.
      </p>

      {dbError ? (
        <p className="status error">
          No hay conexión con la base de datos todavía. El explorador estará
          disponible cuando la ingesta cargue datos.
        </p>
      ) : null}

      <input
        className="search"
        type="search"
        placeholder="Buscar serie por nombre, id o fuente…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar series"
      />

      <div className="series-list">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            className="series-item"
            aria-pressed={item.id === selectedId}
            onClick={() => setSelectedId(item.id)}
          >
            <span className="name">{item.name}</span>
            <span className="meta">
              {item.id} · {item.frequency} · {item.observations} obs ·{" "}
              {item.vintages} vintages
            </span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="status">No se encontraron series para “{query}”.</p>
        ) : null}
      </div>

      {selected ? (
        <div style={{ marginTop: 20 }}>
          <div className="chart-head">
            <div>
              <h2>{selected.name}</h2>
              <div className="unit">
                {selected.unit} · fuente: {selected.source}
              </div>
            </div>
            <div className="status">
              {loading ? "Cargando…" : `${vintages.length} vintages archivados`}
            </div>
          </div>

          {error ? <p className="status error">{error}</p> : null}

          {domains ? (
            <>
              <div className="legend">
                <span className="today">Serie de hoy (última revisión)</span>
                <span className="asof">Conocida al {asOf ? formatDate(asOf) : "—"}</span>
              </div>
              <svg
                className="chart"
                viewBox={`0 0 ${CHART.w} ${CHART.h}`}
                role="img"
                aria-label={`Gráfico de ${selected.name}`}
              >
                {yTicks.map((tick) => {
                  const innerH = CHART.h - CHART.padT - CHART.padB;
                  const y =
                    CHART.padT +
                    innerH -
                    ((tick - domains.yMin) / (domains.yMax - domains.yMin)) *
                      innerH;
                  return (
                    <g key={tick}>
                      <line
                        className="grid-line"
                        x1={CHART.padL}
                        x2={CHART.w - CHART.padR}
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="axis-text"
                        x={CHART.padL - 8}
                        y={y + 4}
                        textAnchor="end"
                      >
                        {formatNumber(tick)}
                      </text>
                    </g>
                  );
                })}

                {[today[0], today[Math.floor(today.length / 2)], lastToday]
                  .filter(Boolean)
                  .map((point, index) => {
                    const innerW = CHART.w - CHART.padL - CHART.padR;
                    const t = Date.parse(`${point.date}T00:00:00Z`);
                    const x =
                      CHART.padL +
                      ((t - domains.xMin) / (domains.xMax - domains.xMin)) *
                        innerW;
                    return (
                      <text
                        key={`${point.date}-${index}`}
                        className="axis-text"
                        x={x}
                        y={CHART.h - 12}
                        textAnchor={
                          index === 0
                            ? "start"
                            : index === 2
                              ? "end"
                              : "middle"
                        }
                      >
                        {monthFormat.format(
                          new Date(`${point.date}T00:00:00Z`),
                        )}
                      </text>
                    );
                  })}

                <path
                  d={buildPath(
                    downsample(today),
                    domains.xMin,
                    domains.xMax,
                    domains.yMin,
                    domains.yMax,
                  )}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                  strokeOpacity={0.85}
                />
                <path
                  d={buildPath(
                    downsample(asKnown),
                    domains.xMin,
                    domains.xMax,
                    domains.yMin,
                    domains.yMax,
                  )}
                  fill="none"
                  stroke="var(--accent-2)"
                  strokeWidth={2}
                />
              </svg>

              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, steps.length - 1)}
                  value={safeIndex}
                  onChange={(event) => setStepIndex(Number(event.target.value))}
                  disabled={steps.length < 2}
                  aria-label="Fecha de conocimiento"
                />
                <span className="slider-date">
                  {asOf ? asOf.slice(0, 10) : "—"}
                </span>
              </div>

              <div className="cards">
                <div className="card">
                  <span className="label">Último dato publicado</span>
                  <span className="value">
                    {lastToday ? formatNumber(lastToday.value) : "—"}
                  </span>
                  <span className="sub">
                    {lastToday ? formatDate(lastToday.date) : ""}
                  </span>
                </div>
                <div className="card">
                  <span className="label">Conocido al {asOf ? formatDate(asOf) : "—"}</span>
                  <span className="value">
                    {lastKnown ? formatNumber(lastKnown.value) : "—"}
                  </span>
                  <span className="sub">
                    {lastKnown ? formatDate(lastKnown.date) : "sin datos"}
                  </span>
                </div>
                <div className="card">
                  <span className="label">Cobertura en el gráfico</span>
                  <span className="value">{today.length}</span>
                  <span className="sub">períodos (últimos 6 años)</span>
                </div>
              </div>

              <p className="sub" style={{ marginTop: 12 }}>
                Los vintages históricos se reconstruyen a partir del rezago de
                publicación de cada serie. Las revisiones reales se agregan solas
                a medida que el cron guarda nuevas versiones cada día.
              </p>
            </>
          ) : (
            <p className="status">
              {loading ? "Cargando datos…" : "Esta serie todavía no tiene observaciones."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
