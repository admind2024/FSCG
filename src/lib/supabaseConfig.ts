// src/lib/supabaseConfig.ts
// Centralized Supabase configuration and query function

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hvpytasddzeprgqkwlbu.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cHl0YXNkZHplcHJncWt3bGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDMyODQsImV4cCI6MjA4MjE3OTI4NH0.R1wPgBpyO7MHs0YL_pW0XBKkX8QweJ8MuhHUpuDSuKk";

export const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export { SUPABASE_URL, SUPABASE_KEY };

export async function supabaseQuery(table: string, params: string = ""): Promise<any[]> {
  const allData: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const separator = params ? "&" : "";
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}${separator}limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: supabaseHeaders });

    if (!res.ok) {
      console.error("Supabase error:", res.status, res.statusText);
      throw new Error(`Query failed: ${res.statusText}`);
    }

    const data = await res.json();
    allData.push(...data);

    if (data.length < limit) break;
    offset += limit;
  }

  return allData;
}

export async function supabaseBatchUpdate(
  table: string,
  ids: string[],
  updates: Record<string, any>,
  batchSize: number = 50
): Promise<number> {
  let updatedCount = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const idList = batch.join(",");

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=in.(${idList})`, {
      method: "PATCH",
      headers: { ...supabaseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      updatedCount += batch.length;
    }
  }

  return updatedCount;
}
