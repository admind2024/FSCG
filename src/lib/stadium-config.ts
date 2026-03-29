// Hardkodirani kapaciteti za Gradski stadion Podgorica
// Struktura: tribina → sektor → kapacitet

export const GRADSKI_STADION_SECTORS: Record<string, Record<string, number>> = {
  Zapad: {
    A: 898,
    B: 817,
    C: 586,
    D: 578,
    E: 821,
    F: 897,
  },
  Istok: {
    A: 55,
    B: 171,
    C: 172,
    D: 165,
    E: 172,
    F: 172,
    G: 171,
  },
  Sjever: {
    A: 374,
    B: 452,
    C: 371,
    "A-galerija": 572,
    "B-galerija": 523,
    "C-galerija": 562,
  },
  Jug: {
    A: 378,
    B: 934,
    "A-galerija": 413,
    "B-galerija": 927,
  },
  VIP: {
    A: 210,
    B: 86,
    C: 86,
  },
};

// Ukupni kapaciteti po tribini
export function getTribuneCapacities(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [tribune, sectors] of Object.entries(GRADSKI_STADION_SECTORS)) {
    result[tribune] = Object.values(sectors).reduce((sum, cap) => sum + cap, 0);
  }
  return result;
}

export function isGradskiStadion(venue: string | null | undefined): boolean {
  if (!venue) return false;
  return venue.toLowerCase().includes("gradski stadion");
}

// Izvlači tribinu iz category polja
export function getTribuneFromCategory(category: string): string {
  const lower = category.toLowerCase().trim();
  if (lower === "nedostupno") return "Zapad";
  if (lower.startsWith("zapad")) return "Zapad";
  if (lower.startsWith("istok")) return "Istok";
  if (lower.startsWith("sjever")) return "Sjever";
  if (lower.startsWith("jug")) return "Jug";
  if (lower.startsWith("vip")) return "VIP";
  return category;
}

// Izvlači sektor iz seatId
// Primjeri:
//   "Sektor E-11-14" → "E"
//   "Sektor E desno-21-10" → "E"
//   "Sektor B Lijevo-5-3" → "B"
//   "VIP A-8-148" → "A"
//   "Sektor VIP A-4-75" → "A"
//   "Sektor VIP B-2-10" → "B"
//   "Sektor VIP C-1-5" → "C"
//   "A-4-74" → "A"
//   "Galerija Sektor C-5-12" → "C-galerija"
//   "Galerija Sektor A-3-7" → "A-galerija"
//   "Tribina Sektor B1-3-5" → "B"
//   "Tribina Sektor B2-3-5" → "B"
//   "Sektor B2-3-5" → "B"
export function extractSectorFromSeatId(seatId: string): string {
  if (!seatId) return "Nepoznato";

  const s = seatId.trim();

  // Galerija Sektor X-... → X-galerija
  const galMatch = s.match(/^Galerija\s+Sektor\s+([A-Z])/i);
  if (galMatch) return `${galMatch[1].toUpperCase()}-galerija`;

  // "Sektor GALERIJA-SEKTOR X-..." → X-galerija
  const sektorGalMatch = s.match(/^Sektor\s+GALERIJA[\s-]+SEKTOR\s+([A-Z])/i);
  if (sektorGalMatch) return `${sektorGalMatch[1].toUpperCase()}-galerija`;

  // Sektor VIP X-... → X (VIP sektor sa slovom iza)
  const vipSektorMatch = s.match(/^Sektor\s+VIP\s+([A-Z])/i);
  if (vipSektorMatch) return vipSektorMatch[1].toUpperCase();

  // "Sektor VIP-1-6" → koristi kategoriju za tribune, VIP bez slova
  const vipNoLetterMatch = s.match(/^Sektor\s+VIP-\d/i);
  if (vipNoLetterMatch) return "VIP";

  // VIP X-... → X
  const vipMatch = s.match(/^VIP\s+([A-Z])/i);
  if (vipMatch) return vipMatch[1].toUpperCase();

  // Tribina Sektor X... → X (remove trailing digits like B1, B2)
  const tribMatch = s.match(/^Tribina\s+Sektor\s+([A-Z])/i);
  if (tribMatch) return tribMatch[1].toUpperCase();

  // "Sektor sektor X-..." → X (dupli "Sektor sektor" format)
  const duplSektorMatch = s.match(/^Sektor\s+sektor\s+([A-Z])/i);
  if (duplSektorMatch) return duplSektorMatch[1].toUpperCase();

  // Sektor X (desno/lijevo/...) → X
  const sektorMatch = s.match(/^Sektor\s+([A-Z])/i);
  if (sektorMatch) return sektorMatch[1].toUpperCase();

  // Bare letter-number format like "A-4-74" → A
  const bareMatch = s.match(/^([A-Z])-\d/i);
  if (bareMatch) return bareMatch[1].toUpperCase();

  return "Nepoznato";
}

// Za "Nedostupno" karte - uvijek sektor C u Zapadu
export function extractSectorForTicket(
  category: string,
  seatId: string,
): { tribune: string; sector: string } {
  if (category.toLowerCase().trim() === "nedostupno") {
    return { tribune: "Zapad", sector: "C" };
  }

  const tribune = getTribuneFromCategory(category);
  const sector = extractSectorFromSeatId(seatId);

  return { tribune, sector };
}
