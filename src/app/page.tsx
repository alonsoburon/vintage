import { headers } from "next/headers";
import ThemeToggle from "@/components/ThemeToggle";
import VintageExplorer, { type HistoryRow } from "@/components/VintageExplorer";
import { getDb } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { getObservationHistory, listSeries } from "@/lib/queries";
import type { SeriesSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const REPO_URL = "https://github.com/alonsoburon/vintage";

async function getOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function HomePage() {
  const origin = await getOrigin();

  let series: SeriesSummary[] = [];
  let initialSeriesId = "";
  let initialRows: HistoryRow[] = [];
  let dbError: string | null = null;

  try {
    const sql = getDb();
    series = await listSeries(sql);
    const first = series.find((item) => item.observations > 0) ?? series[0];
    if (first) {
      initialSeriesId = first.id;
      const from = new Date();
      from.setUTCFullYear(from.getUTCFullYear() - 6);
      const rows = await getObservationHistory(sql, {
        seriesId: first.id,
        from: from.toISOString().slice(0, 10),
        limit: 20_000,
      });
      initialRows = rows.map((row) => ({
        obs_date: row.obs_date,
        value: row.value,
        published_at: row.published_at,
      }));
    }
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  const totalObservations = series.reduce(
    (total, item) => total + item.observations,
    0,
  );
  const totalVintages = series.reduce(
    (total, item) => total + item.vintages,
    0,
  );

  return (
    <div className="wrap">
      <header className="topbar">
        <a className="wordmark" href="/">
          vintage
          <span>point-in-time · Chile</span>
        </a>
        <nav>
          <a href={REPO_URL}>GitHub</a>
          <a href={`${origin}/api`}>API</a>
          <a href={`${origin}/api/mcp`}>MCP</a>
          <ThemeToggle />
        </nav>
      </header>

      <header className="hero">
        <h1>Datos macroeconómicos como se conocían en cada fecha</h1>
        <p>
          vintage archiva cada versión publicada de una serie y responde una
          pregunta concreta: <strong>cuál era el valor de una serie en una
          fecha, según la información disponible hasta ese día</strong>. Evita
          el sesgo de anticipación en backtests y análisis económicos.
        </p>
        <p className="meta">
          Chile · {series.length} series ·{" "}
          {totalObservations.toLocaleString("es-CL")} observaciones ·{" "}
          {totalVintages.toLocaleString("es-CL")} vintages · MIT
        </p>
      </header>

      <VintageExplorer
        series={series}
        dbError={dbError}
        initialSeriesId={initialSeriesId}
        initialRows={initialRows}
      />

      <section className="panel">
        <h2>¿Qué es un vintage?</h2>
        <p className="hint">
          Un vintage es una versión de una serie tal como se publicó en una
          fecha determinada. Los datos macroeconómicos se revisan: el PIB, el IPC
          y el IMACEC se corrigen durante meses. Trabajar con la última revisión
          para estudiar el pasado introduce sesgo de anticipación
          (<em>look-ahead bias</em>).
        </p>
        <p className="hint">
          Ejemplo: si el IPC de enero se publicó el 5 de febrero en 0,2% y se
          revisó el 8 de marzo a 0,5%, un modelo que simula decisiones el 20 de
          febrero solo debía ver 0,2%. vintage conserva ambas versiones y
          devuelve la correcta según la fecha consultada.
        </p>
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>API abierta</h2>
          <p className="hint">
            Sin claves ni registro. Base: <a href={origin}>{origin}</a> · índice
            en <a href={`${origin}/api`}>{origin}/api</a>. Límites duros por IP y
            globales para mantenerla disponible.
          </p>
          <pre>{`# Series disponibles
curl "${origin}/api/series"

# Observaciones como se conocían el 2025-06-30
curl "${origin}/api/series/imacec/observations?as_of=2025-06-30"

# Rango de fechas y salida CSV
curl "${origin}/api/series/usd_clp/observations?from=2025-01-01&format=csv"

# Fechas de publicación archivadas
curl "${origin}/api/series/ipc/vintages"`}</pre>
          <p className="hint">
            Límites: {LIMITS.burstPerMinute}/min por IP,{" "}
            {LIMITS.dailyPerIp.toLocaleString("es-CL")}/día por IP y{" "}
            {LIMITS.dailyGlobal.toLocaleString("es-CL")}/día globales. Las
            respuestas aceptan <code className="inline-code">limit</code> (máx.
            20.000) y <code className="inline-code">offset</code>.
          </p>
        </section>

        <section className="panel">
          <h2>Servidor MCP</h2>
          <p className="hint">
            Conecta agentes como Claude o Cursor directamente por URL:
          </p>
          <pre>{`{
  "mcpServers": {
    "vintage": {
      "url": "${origin}/api/mcp"
    }
  }
}`}</pre>
          <p className="hint">Herramientas expuestas:</p>
          <ul className="hint">
            <li>
              <code className="inline-code">list_series</code> — todas las series.
            </li>
            <li>
              <code className="inline-code">search_series</code> — búsqueda por
              texto.
            </li>
            <li>
              <code className="inline-code">get_series</code> — metadatos de una
              serie.
            </li>
            <li>
              <code className="inline-code">get_observations</code> — valores con{" "}
              <code className="inline-code">as_of</code> para consultas
              point-in-time.
            </li>
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>Ingesta diaria</h2>
        <p className="hint">
          Un cron diario descarga cada serie desde el Banco Central de Chile, la
          compara con lo archivado e inserta únicamente los períodos nuevos o
          revisados, con su fecha de publicación. El proceso es idempotente:
          repetir la ingesta nunca duplica filas.
        </p>
      </section>

      <footer>
        <p>
          Código bajo licencia MIT. Los datos pertenecen a sus fuentes
          originales, citadas en cada serie. Proyecto de{" "}
          <a href={REPO_URL}>Alonso Burón</a>.
        </p>
        <ul>
          <li>
            Fuente principal: Banco Central de Chile, Base de Datos Estadísticos
            (BDE / SIETE).
          </li>
          <li>
            Series de precios y empleo: Instituto Nacional de Estadísticas (INE),
            republicadas por el BCCh.
          </li>
          <li>
            Este proyecto no está afiliado al BCCh ni al INE. Verifica los
            términos de cada fuente antes de redistribuir los datos.
          </li>
        </ul>
      </footer>
    </div>
  );
}
