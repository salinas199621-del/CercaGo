import { pool } from "./db";

export interface ExchangeRateRecord {
  rate: number;
  source: "BCV";
  valueDate: string;
  updatedAt: string;
}

export function parseBcvRate(html: string): Omit<ExchangeRateRecord, "updatedAt" | "source"> {
  const usdStart = html.search(/<div\b[^>]*id=["']dolar["']/i);
  if (usdStart < 0) throw new Error("No se encontró la tasa USD publicada por el BCV");

  const usdSection = html.slice(usdStart, usdStart + 12_000);
  const rateMatch = usdSection.match(/<strong\b[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
  if (!rateMatch) throw new Error("El BCV no publicó una tasa USD reconocible");

  const normalizedRate = rateMatch[1].includes(",")
    ? rateMatch[1].replace(/\./g, "").replace(",", ".")
    : rateMatch[1];
  const rate = Number(normalizedRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("La tasa USD publicada por el BCV no es válida");

  const dateTag = usdSection.match(/<span\b[^>]*property=["']dc:date["'][^>]*>/i)?.[0];
  const valueDate = dateTag?.match(/\bcontent=["'](\d{4}-\d{2}-\d{2})T/i)?.[1];
  if (!valueDate) throw new Error("No se encontró la fecha de valor de la tasa BCV");

  return { rate, valueDate };
}

export async function fetchBcvRate(): Promise<Omit<ExchangeRateRecord, "updatedAt" | "source">> {
  const response = await fetch("https://bcv.org.ve/", {
    headers: { "User-Agent": "CercaGo/1.0 (BCV exchange rate sync)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`El BCV respondió HTTP ${response.status}`);
  return parseBcvRate(await response.text());
}

export async function refreshExchangeRate(onUpdated?: (rate: ExchangeRateRecord) => void): Promise<ExchangeRateRecord> {
  const bcvRate = await fetchBcvRate();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<{ updated_at: string }>(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES ('exchange_rate', $1::jsonb, NOW())
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING updated_at`,
      [JSON.stringify(bcvRate.rate)],
    );
    await client.query(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES ('exchange_rate_source', '"BCV"'::jsonb, NOW())
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    );
    await client.query(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES ('exchange_rate_value_date', $1::jsonb, NOW())
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(bcvRate.valueDate)],
    );
    await client.query("COMMIT");
    const record: ExchangeRateRecord = {
      ...bcvRate,
      source: "BCV",
      updatedAt: updated.rows[0].updated_at,
    };
    onUpdated?.(record);
    return record;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
