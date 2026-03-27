// src/lib/dashboard-utils.ts
// KOMPLETNE UTILITY FUNKCIJE - SVE FUNKCIJE UKLJUČENE

import {
  Ticket,
  DailyStats,
  CategoryStats,
  LocationStats,
  DailyCategoryStats,
  ChannelStats,
  EventData,
} from "@/types/dashboard";

// ============================================
// SALES CHANNEL NORMALIZATION
// ============================================

export function normalizeSalesChannel(channel: string | null | undefined): string {
  if (!channel) return "Online";
  const ch = channel.trim().toLowerCase();

  if (ch.includes("gotovina")) return "Biletarnica";
  // Online-Biletarnica has cs_live sessionId = online sales, not physical biletarnica
  if (ch === "online-biletarnica") return "Online";
  if (ch.includes("biletarnica")) return "Biletarnica";
  if (ch.includes("virman") || ch.includes("bank") || ch.includes("transfer")) return "Virman";
  if (ch.includes("kartica")) return "Online-Kartica";
  if (ch === "savez") return "Savez";
  if (ch === "igraci") return "Igraci";
  if (ch === "website" || ch === "online") return "Online";

  return "Online";
}

// ============================================
// TICKET FILTERING
// ============================================

export function isTicketHidden(ticket: any): boolean {
  if (ticket.Hide === true || ticket.Hide === "true") return true;
  if (ticket.manualHide === true || ticket.manualHide === "true") return true;
  if (ticket.hide === true || ticket.hide === "true") return true;
  return false;
}

export function isExcludedChannel(ticket: any): boolean {
  const channel = (ticket.salesChannel || "").toLowerCase();
  if (channel === "savez" || channel === "igraci") return true;
  // Igrači karte unijete kroz biletarnicu (customerName = "IGRACI")
  const name = (ticket.customerName || "").trim().toUpperCase();
  if (name === "IGRACI") return true;
  // "Nedostupno" kategorija = savez/interne karte, ne prava prodaja
  const category = (ticket.category || "").toLowerCase();
  if (category === "nedostupno") return true;
  return false;
}

export function filterVisibleTickets(tickets: Ticket[]): Ticket[] {
  return tickets.filter((ticket) => {
    if (isTicketHidden(ticket)) return false;
    if (isExcludedChannel(ticket)) return false;
    if ((ticket as any).status === "refunded") return false;
    return true;
  });
}

// ============================================
// CAPACITY PARSING
// ============================================

export function parseCapacityString(capacityStr: string | null | undefined): Record<string, number> {
  if (!capacityStr) return {};

  const capacities: Record<string, number> = {};

  // Ako string ima newline-ove, koristi stari format (par linija: ime + "N places")
  if (capacityStr.includes("\n")) {
    const lines = capacityStr.split("\n");
    for (let i = 0; i < lines.length; i += 2) {
      const categoryName = lines[i]?.trim();
      const capacityLine = lines[i + 1]?.trim();
      if (categoryName && capacityLine) {
        const match = capacityLine.match(/(\d+)\s*places?/i);
        if (match) {
          capacities[categoryName] = parseInt(match[1]);
        }
      }
    }
  } else {
    // Sve u jednom redu: "Fan pit250 placesGalerija500 places..."
    const regex = /([A-Za-z\u00C0-\u024F\s]+?)(\d+)\s*places?/gi;
    let match;
    while ((match = regex.exec(capacityStr)) !== null) {
      const name = match[1].trim();
      const count = parseInt(match[2]);
      if (name && count > 0) {
        capacities[name] = count;
      }
    }
  }

  return capacities;
}

export function getTotalCapacity(capacityStr: string | null | undefined): number {
  const capacities = parseCapacityString(capacityStr);
  return Object.values(capacities).reduce((sum, cap) => sum + cap, 0);
}

// ============================================
// DATE FORMATTING
// ============================================

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString("sr-Latn-ME", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString("sr-Latn-ME", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ============================================
// CURRENCY FORMATTING
// ============================================

export function formatCurrency(
  amount: number,
  currency: string = "EUR",
  exchangeRate: number | null = null,
  showSymbol: boolean = true,
): string {
  const num = Number(amount) || 0;

  const symbols: Record<string, string> = {
    EUR: "€",
    RSD: "RSD",
    USD: "$",
    BAM: "KM",
    HRK: "kn",
    MKD: "MKD",
    DOP: "DOP",
  };

  const symbol = symbols[currency] || currency;

  // Format number with thousand separators
  const formatted = num.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (showSymbol) {
    return currency === "EUR" || currency === "USD" ? `${formatted} ${symbol}` : `${formatted} ${symbol}`;
  }

  return `${formatted} ${symbol}`;
}

export function formatCurrencyNoDecimals(
  amount: number,
  currency: string = "EUR",
  exchangeRate: number | null = null,
  showSymbol: boolean = true,
): string {
  const num = Number(amount) || 0;

  const symbols: Record<string, string> = {
    EUR: "€",
    RSD: "RSD",
    USD: "$",
    BAM: "KM",
    HRK: "kn",
    MKD: "MKD",
    DOP: "DOP",
  };

  const symbol = symbols[currency] || currency;

  // Format number WITHOUT decimals
  const formatted = Math.round(num).toLocaleString("de-DE");

  if (showSymbol) {
    return `${formatted} ${symbol}`;
  }

  return formatted;
}

// ============================================
// FEE CALCULATIONS
// ============================================

export function calculateFees(
  price: number,
  serviceFeePercentage: number,
  pdvPercentage: number,
  salesChannel: string,
  biletarnicaFee: number,
  virmanFee: number,
): {
  price: number;
  serviceFee: number;
  pdvAmount: number;
  totalFee: number;
  finalAmount: number;
} {
  price = Number(price) || 0;
  serviceFeePercentage = Number(serviceFeePercentage) || 0;
  pdvPercentage = Number(pdvPercentage) || 0;
  biletarnicaFee = Number(biletarnicaFee) || 0;
  virmanFee = Number(virmanFee) || 0;

  const normalizedChannel = normalizeSalesChannel(salesChannel);

  let actualFeePercentage: number;
  if (normalizedChannel === "Biletarnica") {
    actualFeePercentage = biletarnicaFee;
  } else if (normalizedChannel === "Virman") {
    actualFeePercentage = virmanFee || serviceFeePercentage;
  } else if (normalizedChannel === "Online-Kartica") {
    actualFeePercentage = biletarnicaFee;
  } else {
    actualFeePercentage = serviceFeePercentage;
  }

  const serviceFee = (price * actualFeePercentage) / 100;
  const pdvAmount = (serviceFee * pdvPercentage) / 100;
  const totalFee = serviceFee + pdvAmount;

  return {
    price,
    serviceFee,
    pdvAmount,
    totalFee,
    finalAmount: price - totalFee,
  };
}

// ============================================
// DAILY STATISTICS
// ============================================

export function calculateDailyStats(tickets: Ticket[], eventData?: any): DailyStats[] {
  const dailyMap = new Map<string, DailyStats>();

  const serviceFeePercentage = eventData?.serviceFeePercentage || 5;
  const biletarnicaFee = eventData?.biletarnicaFee || 5;
  const virmanFee = eventData?.virmanFee || 0;
  const pdvPercentage = eventData?.pdvPercentage || 21;

  tickets.forEach((ticket) => {
    const date = ticket.purchaseDate || "Unknown";

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        total: 0,
        totalAmount: 0,
        online: { count: 0, amount: 0, fees: 0 },
        biletarnica: { count: 0, amount: 0, fees: 0 },
        virman: { count: 0, amount: 0, fees: 0 },
        kartica: { count: 0, amount: 0, fees: 0 },
      });
    }

    const stats = dailyMap.get(date)!;
    const channel = normalizeSalesChannel(ticket.salesChannel);
    const price = Number(ticket.price) || 0;

    // Calculate fee for this ticket
    let feePercent = serviceFeePercentage;
    if (channel === "Biletarnica" || channel === "Online-Kartica") {
      feePercent = biletarnicaFee;
    } else if (channel === "Virman") {
      feePercent = virmanFee || serviceFeePercentage;
    }
    const fee = ((price * feePercent) / 100) * (1 + pdvPercentage / 100);

    stats.total++;
    stats.totalAmount += price;

    // Update channel stats
    const channelKey =
      channel === "Online"
        ? "online"
        : channel === "Biletarnica"
          ? "biletarnica"
          : channel === "Virman"
            ? "virman"
            : "kartica";

    stats[channelKey].count++;
    stats[channelKey].amount += price;
    stats[channelKey].fees += fee;
  });

  // Sort by date
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// CATEGORY STATISTICS
// ============================================

export function calculateCategoryStats(
  tickets: Ticket[],
  eventData?: EventData | Record<string, number>,
): CategoryStats[] {
  // Extract capacity from eventData if provided
  let capacityByCategory: Record<string, number> = {};

  if (eventData) {
    if ("capacityByCategory" in eventData) {
      // It's EventData
      capacityByCategory = (eventData as EventData).capacityByCategory || {};
    } else {
      // It's Record<string, number>
      capacityByCategory = eventData as Record<string, number>;
    }
  }

  const categoryMap = new Map<
    string,
    {
      count: number;
      amount: number;
      online: number;
      biletarnica: number;
      virman: number;
      kartica: number;
    }
  >();

  let totalCount = 0;
  let totalAmount = 0;

  tickets.forEach((ticket) => {
    const category = ticket.category || "Ostalo";

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        count: 0,
        amount: 0,
        online: 0,
        biletarnica: 0,
        virman: 0,
        kartica: 0,
      });
    }

    const stats = categoryMap.get(category)!;
    const channel = normalizeSalesChannel(ticket.salesChannel);
    const price = Number(ticket.price) || 0;

    stats.count++;
    stats.amount += price;
    totalCount++;
    totalAmount += price;

    if (channel === "Online") stats.online++;
    else if (channel === "Biletarnica") stats.biletarnica++;
    else if (channel === "Virman") stats.virman++;
    else stats.kartica++;
  });

  const result: CategoryStats[] = [];

  categoryMap.forEach((stats, category) => {
    const capacity = capacityByCategory[category] || 0;
    const fillPercentage = capacity > 0 ? (stats.count / capacity) * 100 : 0;

    result.push({
      category,
      count: stats.count,
      capacity,
      fillPercentage,
      online: stats.online,
      biletarnica: stats.biletarnica,
      virman: stats.virman,
      kartica: stats.kartica,
      amount: stats.amount,
      totalAmount: stats.amount,
      percentage: totalCount > 0 ? (stats.count / totalCount) * 100 : 0,
      onlineCount: stats.online,
      biletarnicaCount: stats.biletarnica,
      virmanCount: stats.virman,
      karticaCount: stats.kartica,
    });
  });

  return result.sort((a, b) => b.count - a.count);
}

// ============================================
// LOCATION STATISTICS
// ============================================

export function calculateLocationStats(
  tickets: Ticket[],
  _eventData?: any, // Opcionalni argument za kompatibilnost
): LocationStats[] {
  const locationMap = new Map<string, { count: number; amount: number }>();
  let totalCount = 0;

  tickets.forEach((ticket) => {
    const location = ticket.city || ticket.country || "Nepoznato";

    if (!locationMap.has(location)) {
      locationMap.set(location, { count: 0, amount: 0 });
    }

    const stats = locationMap.get(location)!;
    stats.count++;
    stats.amount += Number(ticket.price) || 0;
    totalCount++;
  });

  const result: LocationStats[] = [];

  locationMap.forEach((stats, location) => {
    result.push({
      location,
      count: stats.count,
      amount: stats.amount,
      percentage: totalCount > 0 ? (stats.count / totalCount) * 100 : 0,
    });
  });

  return result.sort((a, b) => b.count - a.count);
}

// ============================================
// DAILY CATEGORY STATISTICS
// ============================================

export function calculateDailyCategoryStats(
  tickets: Ticket[],
  _eventData?: any, // Opcionalni argument za kompatibilnost
): DailyCategoryStats[] {
  const map = new Map<string, DailyCategoryStats>();

  tickets.forEach((ticket) => {
    const date = ticket.purchaseDate || "Unknown";
    const category = ticket.category || "Ostalo";
    const key = `${date}|${category}`;

    if (!map.has(key)) {
      map.set(key, {
        date,
        category,
        total: 0,
        amount: 0,
        online: 0,
        biletarnica: 0,
        virman: 0,
        kartica: 0,
      });
    }

    const stats = map.get(key)!;
    const channel = normalizeSalesChannel(ticket.salesChannel);
    const price = Number(ticket.price) || 0;

    stats.total++;
    stats.amount += price;

    if (channel === "Online") stats.online++;
    else if (channel === "Biletarnica") stats.biletarnica++;
    else if (channel === "Virman") stats.virman++;
    else stats.kartica++;
  });

  return Array.from(map.values()).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.category.localeCompare(b.category);
  });
}

// ============================================
// EXPORT HELPERS
// ============================================

export function exportToCSV(data: any[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value ?? "";
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

// ============================================
// NUMBER FORMATTING HELPERS
// ============================================

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercentage(num: number, decimals: number = 1): string {
  return `${num.toFixed(decimals)}%`;
}
