// src/lib/scan-data-utils.ts
// Utility for fetching check-in/scan statistics from QRKarte

import { supabaseQuery } from "./supabaseConfig";
import { isGradskiStadion, getTribuneFromCategory } from "./stadium-config";
import { ScanStatistics, ScanBreakdown } from "@/types/dashboard";

interface RawScanTicket {
  isUsed: string | null;
  used: string | null;
  checkTime: string | null;
  scannedAt: string | null;
  category: string;
  entrance: string;
  salesChannel: string | null;
}

function isScanned(t: RawScanTicket): boolean {
  return t.isUsed === "true" || t.used === "true" || !!t.checkTime;
}

function normalizeEntrance(entrance: string): string {
  if (!entrance) return "Nepoznat";
  const e = entrance.trim();
  if (/zapad.*a.*b.*c/i.test(e)) return "Zapad A,B,C";
  if (/zapad.*d.*e.*f/i.test(e)) return "Zapad D,E,F";
  if (/sjever|north/i.test(e)) return "Sjever";
  if (/jug|south/i.test(e)) return "Jug";
  if (/istok|east/i.test(e)) return "Istok";
  if (/vip/i.test(e)) return "VIP";
  return e;
}

function normalizeSalesChannel(ch: string | null): string {
  if (!ch) return "Online";
  const c = ch.trim().toLowerCase();
  if (c.includes("gotovina")) return "Biletarnica";
  if (c === "online-biletarnica") return "Online";
  if (c.includes("biletarnica")) return "Biletarnica";
  if (c.includes("virman") || c.includes("bank") || c.includes("transfer")) return "Virman";
  if (c.includes("kartica")) return "Kartica";
  if (c === "savez" || c === "igraci") return "Savez";
  if (c === "rezervacija" || c.includes("bukiranje")) return "Rezervacija";
  return "Online";
}

function buildBreakdown(
  tickets: RawScanTicket[],
  keyFn: (t: RawScanTicket) => string,
  filterFn?: (name: string) => boolean,
): ScanBreakdown[] {
  const map = new Map<string, { total: number; scanned: number }>();

  for (const t of tickets) {
    const key = keyFn(t);
    if (!map.has(key)) map.set(key, { total: 0, scanned: 0 });
    const entry = map.get(key)!;
    entry.total++;
    if (isScanned(t)) entry.scanned++;
  }

  const result: ScanBreakdown[] = [];
  for (const [name, data] of map) {
    if (filterFn && !filterFn(name)) continue;
    result.push({
      name,
      total: data.total,
      scanned: data.scanned,
      percentage: data.total > 0 ? (data.scanned / data.total) * 100 : 0,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

export async function fetchScanStatistics(
  eventKey: string,
  venue: string,
): Promise<ScanStatistics> {
  // Get eventId from AboutEvents (may be comma-separated)
  const aboutEvents = await supabaseQuery(
    "AboutEvents",
    `eventKey=eq.${eventKey}&select=eventId`,
  );
  const rawEventId = aboutEvents[0]?.eventId || eventKey;
  const eventIds = rawEventId.split(",").map((id: string) => id.trim()).filter(Boolean);

  // Fetch tickets for each eventId
  let allTickets: RawScanTicket[] = [];
  for (const eid of eventIds) {
    const data = await supabaseQuery(
      "QRKarte",
      `eventId=eq.${eid}&select=isUsed,used,checkTime,scannedAt,category,entrance,salesChannel`,
    );
    allTickets = allTickets.concat(data as RawScanTicket[]);
  }

  const total = allTickets.length;
  const scanned = allTickets.filter(isScanned).length;
  const isStadion = isGradskiStadion(venue);

  // By tribune
  const tribuneOrder = ["Zapad", "Istok", "Sjever", "Jug", "VIP"];
  const byTribune = buildBreakdown(
    allTickets,
    (t) => isStadion ? getTribuneFromCategory(t.category || "") : (t.category || "Ostalo"),
  );
  if (isStadion) {
    byTribune.sort((a, b) => {
      const ai = tribuneOrder.indexOf(a.name);
      const bi = tribuneOrder.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  // By entrance
  const byEntrance = buildBreakdown(
    allTickets,
    (t) => normalizeEntrance(t.entrance),
    (name) => name !== "Nepoznat",
  );

  // By sales channel
  const byChannel = buildBreakdown(
    allTickets,
    (t) => normalizeSalesChannel(t.salesChannel),
  );

  return {
    total,
    scanned,
    percentage: total > 0 ? (scanned / total) * 100 : 0,
    byTribune,
    byEntrance,
    byChannel,
  };
}
