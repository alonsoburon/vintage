import type { Frequency } from "./types";

export interface SeriesDefinition {
  /** Stable public identifier used across the REST API and MCP tools. */
  id: string;
  name: string;
  description: string;
  unit: string;
  frequency: Frequency;
  /** Human-readable data source label. */
  source: string;
  /** Canonical landing page for the upstream source. */
  sourceUrl: string;
  /**
   * Approximate number of days between the end of the reference period and
   * publication. Used only to reconstruct `published_at` for historical
   * backfill when the source does not expose a release date.
   */
  releaseLagDays: number;
  metadata: {
    country: string;
    institution: string;
    notes?: string;
    bcch?: string;
    mindicador?: string;
    ine?: {
      url: string;
      dateColumn: string;
      valueColumn: string;
      delimiter?: string;
    };
  };
}

export const SERIES: SeriesDefinition[] = [
  {
    id: "pib",
    name: "PIB trimestral (volumen encadenado, referencia 2018)",
    description:
      "Producto Interno Bruto de Chile, volumen a precios del año anterior encadenado, serie empalmada referencia 2018. Frecuencia trimestral.",
    unit: "miles de millones de pesos encadenados (2018=100)",
    frequency: "quarterly",
    source: "Banco Central de Chile",
    sourceUrl:
      "https://si3.bcentral.cl/Siete/ES/Siete/Cuadro/CAP_PIB/MN_PIB_NACIONAL",
    releaseLagDays: 48,
    metadata: {
      country: "CL",
      institution: "BCCh",
      bcch: "F032.PIB.FLU.R.CLP.EP18.Z.Z.0.T",
      notes:
        "Se publica ~45-50 días después del cierre del trimestre (cuentas nacionales).",
    },
  },
  {
    id: "ipc",
    name: "IPC, variación mensual",
    description:
      "Índice de Precios al Consumidor de Chile (base 2023=100), variación porcentual mensual. Publicado por el INE.",
    unit: "% variación mensual",
    frequency: "monthly",
    source: "INE (vía Banco Central de Chile)",
    sourceUrl: "https://www.ine.gob.cl/estadisticas/economia/indices-de-precios-e-inflacion/ipc",
    releaseLagDays: 5,
    metadata: {
      country: "CL",
      institution: "INE",
      bcch: "F074.IPC.VAR.Z.Z.C.M",
      mindicador: "ipc",
      notes:
        "El INE publica el IPC el primer día hábil de la semana del 5 de cada mes.",
    },
  },
  {
    id: "imacec",
    name: "IMACEC, serie original (índice 2018=100)",
    description:
      "Indicador Mensual de Actividad Económica de Chile, serie desestacionalizada/original, índice 2018=100.",
    unit: "índice (2018=100)",
    frequency: "monthly",
    source: "Banco Central de Chile",
    sourceUrl: "https://si3.bcentral.cl/Siete/ES/Siete/Cuadro/CAP_PIB/MN_PIB_IMACEC",
    releaseLagDays: 32,
    metadata: {
      country: "CL",
      institution: "BCCh",
      bcch: "F032.IMC.IND.Z.Z.EP18.Z.Z.0.M",
      mindicador: "imacec",
      notes: "Se publica ~30-35 días después del mes de referencia.",
    },
  },
  {
    id: "tpm",
    name: "Tasa de Política Monetaria (TPM)",
    description:
      "Tasa de interés de política monetaria del Banco Central de Chile, decisión de cada Reunión de Política Monetaria (RPM).",
    unit: "% nominal anual",
    frequency: "daily",
    source: "Banco Central de Chile",
    sourceUrl: "https://si3.bcentral.cl/Siete/ES/Siete/Cuadro/CAP_TASA_INTERES/MN_TASA_INTERES_1",
    releaseLagDays: 1,
    metadata: {
      country: "CL",
      institution: "BCCh",
      bcch: "F022.TPM.TIN.D001.NO.Z.D",
      mindicador: "tpm",
    },
  },
  {
    id: "usd_clp",
    name: "Tipo de cambio observado (CLP/USD)",
    description:
      "Dólar observado: tipo de cambio nominal pesos chilenos por dólar estadounidense.",
    unit: "CLP por USD",
    frequency: "daily",
    source: "Banco Central de Chile",
    sourceUrl: "https://si3.bcentral.cl/Siete/ES/Siete/Cuadro/CAP_MONEDA/MN_MERCADO_CAM/MN_MERCADO_CAM_D",
    releaseLagDays: 1,
    metadata: {
      country: "CL",
      institution: "BCCh",
      bcch: "F073.TCO.PRE.Z.D",
      mindicador: "dolar",
      notes: "El dólar observado se publica el día hábil siguiente al de mercado.",
    },
  },
  {
    id: "desempleo",
    name: "Tasa de desocupación nacional",
    description:
      "Tasa de desocupación total, serie no ajustada, publicada mensualmente por el INE.",
    unit: "% de la fuerza de trabajo",
    frequency: "monthly",
    source: "INE (vía Banco Central de Chile)",
    sourceUrl: "https://www.ine.gob.cl/estadisticas/sociales/mercado-laboral",
    releaseLagDays: 30,
    metadata: {
      country: "CL",
      institution: "INE",
      bcch: "F049.DES.TAS.INE9.10.M",
      mindicador: "tasa_desempleo",
      notes:
        "El INE publica la tasa el último día hábil del mes siguiente al de referencia.",
    },
  },
  {
    id: "cobre",
    name: "Precio de la libra de cobre (BML)",
    description:
      "Precio de la libra de cobre en la Bolsa de Metales de Londres, en dólares por libra.",
    unit: "USD por libra",
    frequency: "daily",
    source: "Banco Central de Chile",
    sourceUrl: "https://si3.bcentral.cl/Siete/ES/Siete/Cuadro/CAP_COMMODITIES/MN_COMMODITIES",
    releaseLagDays: 1,
    metadata: {
      country: "CL",
      institution: "BCCh",
      bcch: "F019.PPB.PRE.100.D",
      mindicador: "libra_cobre",
      notes:
        "Corresponde a 'Precio del cobre refinado BML (dólares/libra)' en la BDE del BCCh.",
    },
  },
];

const BY_ID = new Map(SERIES.map((series) => [series.id, series]));

export function getSeriesDefinition(id: string): SeriesDefinition | undefined {
  return BY_ID.get(id);
}

export function requireSeriesDefinition(id: string): SeriesDefinition {
  const def = getSeriesDefinition(id);
  if (!def) {
    throw new Error(`Unknown series id: ${id}`);
  }
  return def;
}
