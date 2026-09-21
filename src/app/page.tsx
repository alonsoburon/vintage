import VintageExplorer from "@/components/VintageExplorer";
import { getDb } from "@/lib/db";
import { listSeries } from "@/lib/queries";
import type { SeriesSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const REPO_URL = "https://github.com/alonsoburon/vintage";

export default async function HomePage() {
  let series: SeriesSummary[] = [];
  let dbError: string | null = null;
  try {
    series = await listSeries(getDb());
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
      <header className="hero">
        <h1>vintage</h1>
        <p>
          Archivo de datos macroeconómicos de Chile <em>point-in-time</em>.
          Guarda cada versión publicada de una serie y responde una pregunta
          concreta: <strong>¿cuánto valía la serie X el día Y, según lo publicado
          hasta ese día?</strong>
        </p>
        <div className="badge-row">
          <span className="badge">MIT (código)</span>
          <span className="badge">Chile · MVP</span>
          <span className="badge">REST + MCP</span>
          <span className="badge">{series.length} series</span>
          <span className="badge">{totalObservations.toLocaleString("es-CL")} observaciones</span>
          <span className="badge">{totalVintages.toLocaleString("es-CL")} vintages</span>
        </div>
      </header>

      <VintageExplorer series={series} dbError={dbError} />

      <section className="panel">
        <h2>¿Qué es un vintage?</h2>
        <p className="hint">
          Un vintage es una versión de una serie tal como se publicó en una fecha.
          Los datos macro se revisan: el PIB, el IPC o el IMACEC se corrigen
          durante meses. Usar la última revisión para estudiar el pasado produce
          sesgo de anticipación (<em>look-ahead bias</em>).
        </p>
        <p className="hint">
          Ejemplo: si el IPC de enero se publicó el 5 de febrero con 0,2% y luego
          se revisó el 8 de marzo a 0,5%, un modelo que el 20 de febrero simulaba
          decisiones solo debía ver 0,2%. Vintage guarda ambas versiones y te
          devuelve la correcta según la fecha que consultes.
        </p>
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>API abierta</h2>
          <p className="hint">
            Sin claves ni registro. Límites duros por IP y globales para
            mantenerla disponible para todos.
          </p>
          <pre>{`# Series disponibles
curl "$BASE/api/series"

# Observaciones como se conocían el 2025-06-30
curl "$BASE/api/series/imacec/observations?as_of=2025-06-30"

# Rango de fechas y salida CSV
curl "$BASE/api/series/usd_clp/observations?from=2025-01-01&format=csv"

# Fechas de publicación archivadas
curl "$BASE/api/series/ipc/vintages"`}</pre>
          <p className="hint">
            Límites: 60 solicitudes/minuto por IP, 2.000/día por IP y 50.000/día
            globales. Las respuestas aceptan <code className="inline-code">limit</code>{" "}
            (máx. 20.000) y <code className="inline-code">offset</code>.
          </p>
        </section>

        <section className="panel">
          <h2>Servidor MCP</h2>
          <p className="hint">
            Conecta agentes como Claude o Cursor directo por URL:
          </p>
          <pre>{`${"${BASE}"}/api/mcp`}</pre>
          <p className="hint">Herramientas expuestas:</p>
          <ul className="hint">
            <li><code className="inline-code">list_series</code> — todas las series.</li>
            <li><code className="inline-code">search_series</code> — buscar por texto.</li>
            <li><code className="inline-code">get_series</code> — metadatos de una serie.</li>
            <li>
              <code className="inline-code">get_observations</code> — valores con{" "}
              <code className="inline-code">as_of</code> para consultas point-in-time.
            </li>
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>Ingesta diaria</h2>
        <p className="hint">
          Un cron diario baja cada serie desde el Banco Central de Chile,
          compara con lo archivado e inserta solo lo nuevo o revisado, con su
          fecha de publicación. Es idempotente: repetir la ingesta nunca duplica
          filas.
        </p>
      </section>

      <footer>
        <p>
          Código bajo licencia MIT · Datos de sus fuentes originales, citadas en
          cada serie. Proyecto de{" "}
          <a href={REPO_URL}>Alonso Burón</a>.
        </p>
        <ul>
          <li>
            Fuente principal: Banco Central de Chile, Base de Datos Estadísticos
            (BDE / SIETE).
          </li>
          <li>
            Series laborales y de precios: Instituto Nacional de Estadísticas
            (INE), republicadas por el BCCh.
          </li>
          <li>
            Este proyecto no está afiliado al BCCh ni al INE. Verifica siempre
            los términos de cada fuente antes de redistribuir los datos.
          </li>
        </ul>
      </footer>
    </div>
  );
}
