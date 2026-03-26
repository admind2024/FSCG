// src/lib/stadium-capacity.ts
// Kapaciteti stadiona po tribunama i sektorima
// Koristi se za FSCG utakmice na poznatim stadionima

export interface SectorCapacity {
  name: string;       // e.g. "Sektor A", "Sektor A - galerija", "VIP A"
  capacity: number;
}

export interface TribuneCapacity {
  tribune: string;    // e.g. "Zapad", "Istok", "Sjever", "Jug", "VIP"
  sectors: SectorCapacity[];
  totalCapacity: number;
}

export interface StadiumCapacity {
  name: string;
  totalCapacity: number;
  tribunes: TribuneCapacity[];
}

// ═══════════════════════════════════════════════════════════════
// GRADSKI STADION PODGORICA - Kapacitet: 11.563
// ═══════════════════════════════════════════════════════════════

const GRADSKI_STADION_PODGORICA: StadiumCapacity = {
  name: "Gradski stadion Podgorica",
  totalCapacity: 11563,
  tribunes: [
    {
      tribune: "Zapad",
      totalCapacity: 4597,
      sectors: [
        { name: "Sektor A", capacity: 898 },
        { name: "Sektor B", capacity: 817 },
        { name: "Sektor C", capacity: 586 },
        { name: "Sektor D", capacity: 578 },
        { name: "Sektor E", capacity: 821 },
        { name: "Sektor F", capacity: 897 },
      ],
    },
    {
      tribune: "Istok",
      totalCapacity: 1078,
      sectors: [
        { name: "Sektor A", capacity: 55 },
        { name: "Sektor B", capacity: 171 },
        { name: "Sektor C", capacity: 172 },
        { name: "Sektor D", capacity: 165 },
        { name: "Sektor E", capacity: 172 },
        { name: "Sektor F", capacity: 172 },
        { name: "Sektor G", capacity: 171 },
      ],
    },
    {
      tribune: "Sjever",
      totalCapacity: 2854,
      sectors: [
        { name: "Sektor A", capacity: 374 },
        { name: "Sektor B", capacity: 452 },
        { name: "Sektor C", capacity: 371 },
        { name: "Sektor A - galerija", capacity: 572 },
        { name: "Sektor B - galerija", capacity: 523 },
        { name: "Sektor C - galerija", capacity: 562 },
      ],
    },
    {
      tribune: "Jug",
      totalCapacity: 2652,
      sectors: [
        { name: "Sektor A", capacity: 378 },
        { name: "Sektor B", capacity: 934 },
        { name: "Sektor A - galerija", capacity: 413 },
        { name: "Sektor B - galerija", capacity: 927 },
      ],
    },
    {
      tribune: "VIP",
      totalCapacity: 382,
      sectors: [
        { name: "VIP A", capacity: 210 },
        { name: "VIP B", capacity: 86 },
        { name: "VIP C", capacity: 86 },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// REGISTAR STADIONA - dodaj nove stadione ovdje
// ═══════════════════════════════════════════════════════════════

const STADIUM_REGISTRY: Record<string, StadiumCapacity> = {
  "gradski stadion podgorica": GRADSKI_STADION_PODGORICA,
  "gradski stadion": GRADSKI_STADION_PODGORICA,
  "podgorica": GRADSKI_STADION_PODGORICA,
};

/**
 * Pronađi kapacitet stadiona po nazivu venue-a.
 * Vraća null ako stadion nije u registru.
 */
export function getStadiumCapacity(venue: string | null | undefined): StadiumCapacity | null {
  if (!venue) return null;
  const lower = venue.toLowerCase().trim();

  for (const [key, stadium] of Object.entries(STADIUM_REGISTRY)) {
    if (lower.includes(key)) {
      return stadium;
    }
  }
  return null;
}

/**
 * Provjeri da li je event FSCG (po imenu eventa ili organizatoru).
 */
export function isFSCGEvent(eventName: string | null | undefined): boolean {
  if (!eventName) return false;
  const lower = eventName.toLowerCase();
  return lower.includes("fscg") || lower.includes("crna gora") || lower.includes("montenegro");
}

/**
 * Vrati kapacitet po tribunama kao flat Record<string, number> za kompatibilnost
 * sa postojećim kodom (capacityByCategory).
 */
export function getStadiumCapacityFlat(stadium: StadiumCapacity): Record<string, number> {
  const result: Record<string, number> = {};
  for (const tribune of stadium.tribunes) {
    result[tribune.tribune] = tribune.totalCapacity;
  }
  return result;
}

/**
 * Vrati kapacitet po sektorima kao nested struktura:
 * { "Zapad": { "Sektor A": 898, "Sektor B": 817, ... }, ... }
 */
export function getStadiumCapacityBySector(stadium: StadiumCapacity): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const tribune of stadium.tribunes) {
    result[tribune.tribune] = {};
    for (const sector of tribune.sectors) {
      result[tribune.tribune][sector.name] = sector.capacity;
    }
  }
  return result;
}

/**
 * Iz ticket category i Karta polja, odredi tribinu i sektor.
 * Vraća { tribune, sector } ili null ako ne može odrediti.
 *
 * Primjeri mogućih formata u category/Karta:
 * - "Zapad A", "Zapad Sektor A" → tribune: "Zapad", sector: "Sektor A"
 * - "Sjever A - galerija" → tribune: "Sjever", sector: "Sektor A - galerija"
 * - "VIP A" → tribune: "VIP", sector: "VIP A"
 * - "Istok" → tribune: "Istok", sector: null (samo tribina)
 */
export function parseTribuneAndSector(
  category: string | null | undefined,
  karta: string | null | undefined,
  stadium: StadiumCapacity,
): { tribune: string; sector: string | null } | null {
  // Probaj prvo Karta polje (detaljnije), pa category
  const sources = [karta, category].filter(Boolean) as string[];

  for (const source of sources) {
    const result = matchTribuneAndSector(source, stadium);
    if (result) return result;
  }

  return null;
}

function matchTribuneAndSector(
  text: string,
  stadium: StadiumCapacity,
): { tribune: string; sector: string | null } | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Za svaku tribinu pokušaj matchirati
  for (const tribune of stadium.tribunes) {
    const tribuneLower = tribune.tribune.toLowerCase();

    if (!lower.startsWith(tribuneLower) && !lower.includes(tribuneLower)) continue;

    // Pronašli smo tribinu - sad traži sektor
    // Ukloni ime tribune iz stringa da dobijemo ostatak
    let remainder = lower;
    const tribuneIdx = remainder.indexOf(tribuneLower);
    if (tribuneIdx >= 0) {
      remainder = remainder.substring(tribuneIdx + tribuneLower.length).trim();
    }

    // Pokušaj matchirati sektor
    for (const sector of tribune.sectors) {
      const sectorLower = sector.name.toLowerCase();

      // Direktan match sa sektorom
      if (remainder === sectorLower) {
        return { tribune: tribune.tribune, sector: sector.name };
      }

      // "A" → "Sektor A", "A - galerija" → "Sektor A - galerija"
      const sectorShort = sectorLower.replace("sektor ", "").replace("vip ", "");
      if (remainder === sectorShort) {
        return { tribune: tribune.tribune, sector: sector.name };
      }

      // "sektor a" match
      if (remainder.includes(sectorLower)) {
        return { tribune: tribune.tribune, sector: sector.name };
      }

      // Match patterns like "a - galerija", "a-galerija", "a galerija"
      const normalizedRemainder = remainder.replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ");
      const normalizedSectorShort = sectorShort.replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ");
      if (normalizedRemainder === normalizedSectorShort) {
        return { tribune: tribune.tribune, sector: sector.name };
      }
    }

    // Tribina pronađena ali sektor nije - vrati samo tribinu
    if (remainder === "" || remainder === "-" || remainder === "–") {
      return { tribune: tribune.tribune, sector: null };
    }

    // Možda je samo slovo sektora: "A", "B", "C", itd.
    if (/^[a-g]$/i.test(remainder)) {
      const sectorName = tribune.tribune === "VIP"
        ? `VIP ${remainder.toUpperCase()}`
        : `Sektor ${remainder.toUpperCase()}`;
      const matchedSector = tribune.sectors.find(s => s.name.toLowerCase() === sectorName.toLowerCase());
      if (matchedSector) {
        return { tribune: tribune.tribune, sector: matchedSector.name };
      }
    }

    // Galerija pattern: "galerija a", "gal a", "a gal"
    const galMatch = remainder.match(/(?:galerija|gal)\s*([a-c])|([a-c])\s*(?:galerija|gal)/i);
    if (galMatch) {
      const letter = (galMatch[1] || galMatch[2]).toUpperCase();
      const galSectorName = `Sektor ${letter} - galerija`;
      const matchedSector = tribune.sectors.find(s => s.name.toLowerCase() === galSectorName.toLowerCase());
      if (matchedSector) {
        return { tribune: tribune.tribune, sector: matchedSector.name };
      }
    }

    // Vrati tribinu bez sektora
    return { tribune: tribune.tribune, sector: null };
  }

  return null;
}
