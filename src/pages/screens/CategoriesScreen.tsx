import React, { useState, useMemo } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import {
  calculateCategoryStats,
  formatCurrencyNoDecimals,
  filterVisibleTickets,
  getTotalCapacity,
} from "@/lib/dashboard-utils";
import {
  isGradskiStadion,
  GRADSKI_STADION_SECTORS,
  getTribuneCapacities,
  extractSectorForTicket,
} from "@/lib/stadium-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Users,
  Ticket,
  Target,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Building2,
  Globe,
  UtensilsCrossed,
  Search,
  FileDown,
  Gift,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CATEGORY_COLORS: Record<string, string> = {
  VIP: "hsl(45, 93%, 47%)",
  Premium: "hsl(45, 93%, 47%)",
  Student: "hsl(160, 84%, 39%)",
  Grup: "hsl(280, 67%, 56%)",
  Group: "hsl(280, 67%, 56%)",
  Parter: "hsl(214, 100%, 40%)",
  Tribina: "hsl(199, 89%, 48%)",
  General: "hsl(239, 84%, 67%)",
  Istok: "hsl(214, 100%, 40%)",
  Zapad: "hsl(330, 81%, 60%)",
  Sjever: "hsl(160, 84%, 39%)",
  Jug: "hsl(24, 95%, 53%)",
};

// ═══════════════════════════════════════════════════════════════
// GRUPISANJE TRIBINA - "Istok A", "Istok F" → "Istok"
// ═══════════════════════════════════════════════════════════════

const TRIBUNE_GROUPS = ["istok", "zapad", "sjever", "jug", "vip"];

function getTribuneGroup(category: string): string {
  const lower = category.toLowerCase().trim();
  if (lower === "nedostupno") return "Zapad";
  for (const group of TRIBUNE_GROUPS) {
    if (lower.startsWith(group)) {
      // Capitalize first letter
      return group.charAt(0).toUpperCase() + group.slice(1);
    }
  }
  return category; // Ostale kategorije ostaju kao što jesu
}

interface GroupedCategoryStats {
  group: string;
  count: number;
  capacity: number;
  fillPercentage: number;
  online: number;
  biletarnica: number;
  virman: number;
  kartica: number;
  amount: number;
  percentage: number;
  subcategories: string[];
}

function groupCategoryStatsByTribune(
  categoryStats: any[],
  capacityByCategory: Record<string, number>,
): GroupedCategoryStats[] {
  const groupMap = new Map<string, GroupedCategoryStats>();
  const totalCount = categoryStats.reduce((sum, c) => sum + c.count, 0);

  categoryStats.forEach((cat) => {
    const group = getTribuneGroup(cat.category);

    if (!groupMap.has(group)) {
      groupMap.set(group, {
        group,
        count: 0,
        capacity: 0,
        fillPercentage: 0,
        online: 0,
        biletarnica: 0,
        virman: 0,
        kartica: 0,
        amount: 0,
        percentage: 0,
        subcategories: [],
      });
    }

    const grouped = groupMap.get(group)!;
    grouped.count += cat.count;
    grouped.online += cat.online;
    grouped.biletarnica += cat.biletarnica;
    grouped.virman += cat.virman;
    grouped.kartica += cat.kartica;
    grouped.amount += cat.amount;
    grouped.subcategories.push(cat.category);
  });

  // Dodaj kapacitete - grupiši i kapacitete iz baze
  Object.entries(capacityByCategory).forEach(([catName, cap]) => {
    const group = getTribuneGroup(catName);
    const grouped = groupMap.get(group);
    if (grouped) {
      grouped.capacity += cap;
    }
  });

  // Izračunaj fillPercentage i percentage
  groupMap.forEach((grouped) => {
    grouped.fillPercentage = grouped.capacity > 0 ? (grouped.count / grouped.capacity) * 100 : 0;
    grouped.percentage = totalCount > 0 ? (grouped.count / totalCount) * 100 : 0;
  });

  return Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
}

const DEFAULT_COLORS = [
  "hsl(214, 100%, 40%)",
  "hsl(239, 84%, 67%)",
  "hsl(330, 81%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(45, 93%, 47%)",
  "hsl(160, 84%, 39%)",
];

function getCategoryColor(category: string, index: number): string {
  return CATEGORY_COLORS[category] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

// ═══════════════════════════════════════════════════════════════
// ALOKACIJE - TIPOVI I FUNKCIJE
// ═══════════════════════════════════════════════════════════════

interface Allocation {
  id: string;
  type: "reserved" | "external_channel" | "internal_use" | "blocked" | "complimentary";
  category: string;
  quantity: number;
  channel?: string;
  notes?: string;
  created_at: string;
}

interface AllocationSummary {
  total: number;
  reserved: number;
  externalChannel: number;
  internalUse: number;
  blocked: number;
  complimentary: number;
  byChannel: Record<string, number>;
}

function calculateAllocations(allocations: Allocation[]): AllocationSummary {
  const summary: AllocationSummary = {
    total: 0,
    reserved: 0,
    externalChannel: 0,
    internalUse: 0,
    blocked: 0,
    complimentary: 0,
    byChannel: {},
  };

  allocations.forEach((alloc) => {
    summary.total += alloc.quantity;

    switch (alloc.type) {
      case "reserved":
        summary.reserved += alloc.quantity;
        break;
      case "external_channel":
        summary.externalChannel += alloc.quantity;
        if (alloc.channel) {
          summary.byChannel[alloc.channel] = (summary.byChannel[alloc.channel] || 0) + alloc.quantity;
        }
        break;
      case "internal_use":
        summary.internalUse += alloc.quantity;
        break;
      case "blocked":
        summary.blocked += alloc.quantity;
        break;
      case "complimentary":
        summary.complimentary += alloc.quantity;
        break;
    }
  });

  return summary;
}

function calculateCategoryAllocations(allocations: Allocation[], category: string): AllocationSummary {
  const categoryAllocations = allocations.filter((a) => a.category === category);
  return calculateAllocations(categoryAllocations);
}

// ═══════════════════════════════════════════════════════════════
// STOLOVI - TIPOVI I FUNKCIJE
// ═══════════════════════════════════════════════════════════════

interface TableItem {
  seatId: string;
  tickets: number;
  category: string;
  customerName: string;
  customerPhone: string;
}

interface TableTypeStat {
  type: string;
  tableCount: number;
  ticketCount: number;
  tables: string[];
}

interface TableStats {
  tables: TableItem[];
  typeStats: TableTypeStat[];
  summary: {
    totalTables: number;
    totalTickets: number;
  };
}

const TABLE_PREFIXES = [
  "vip barski sto",
  "vip sjedeći",
  "vip sjedeci",
  "vip sto",
  "premium barski sto",
  "regular barski sto",
  "barski sto",
  "balkonski sto",
  "separe",
  "sto ",
];

function isTableSeat(seatId: string, category?: string): boolean {
  if (!seatId) return false;
  const lowerSeat = seatId.toString().toLowerCase().trim();
  if (TABLE_PREFIXES.some((prefix) => lowerSeat.startsWith(prefix))) return true;
  // Also check category field (e.g. "Barski sto sektor A")
  if (category) {
    const lowerCat = category.toString().toLowerCase().trim();
    if (TABLE_PREFIXES.some((prefix) => lowerCat.startsWith(prefix))) return true;
  }
  // Also match seatId patterns like "Sektor A - Sto broj-62"
  if (/sto\s*broj/i.test(seatId)) return true;
  return false;
}

function formatSeatDisplay(seatId: string): string {
  if (!seatId) return seatId;
  // Extract table number from patterns like "Sektor A - Sto broj-62" → "Sto broj 62"
  const match = seatId.match(/Sto\s*broj[- ]*(\d+)/i);
  if (match) {
    return `Sto broj ${match[1]}`;
  }
  return seatId;
}

function categorizeTable(seatId: string, category?: string): string {
  // Try seatId first, then fall back to category field from DB
  const sources = [seatId, category].filter(Boolean);

  for (const source of sources) {
    const lowerName = source!.toString().toLowerCase().trim();

    if (lowerName.startsWith("vip barski sto")) return "VIP barski sto";
    if (lowerName.startsWith("vip sjedeći") || lowerName.startsWith("vip sjedeci")) return "VIP sjedeći";
    if (lowerName.startsWith("vip sto")) return "VIP sto";
    if (lowerName.startsWith("premium barski sto")) return "Premium barski sto";
    if (lowerName.startsWith("regular barski sto")) return "Regular barski sto";
    if (lowerName.startsWith("barski sto")) return "Barski sto";
    if (lowerName.startsWith("balkonski sto")) return "Balkonski sto";
    if (lowerName.startsWith("separe")) return "Separe";
    if (lowerName.startsWith("sto ")) return "Sto";
  }

  return "Ostali stolovi";
}

function calculateTableStats(tickets: any[]): TableStats {
  const tableTickets = tickets.filter((ticket) => isTableSeat(ticket.seatId, ticket.category));
  const tableGroups: Record<string, TableItem> = {};

  tableTickets.forEach((ticket) => {
    const seatId = ticket.seatId.toString().trim();

    if (!tableGroups[seatId]) {
      tableGroups[seatId] = {
        seatId: seatId,
        tickets: 0,
        category: categorizeTable(seatId, ticket.category),
        customerName: ticket.customerName || "Nepoznato",
        customerPhone: ticket.customerPhone || "-",
      };
    }

    tableGroups[seatId].tickets++;
  });

  const tables = Object.values(tableGroups).sort((a, b) => {
    const catCompare = a.category.localeCompare(b.category, "hr");
    if (catCompare !== 0) return catCompare;

    const aNum = parseInt(a.seatId.replace(/\D/g, "")) || 0;
    const bNum = parseInt(b.seatId.replace(/\D/g, "")) || 0;

    if (aNum !== bNum) return aNum - bNum;
    return a.seatId.localeCompare(b.seatId, "hr");
  });

  const tableTypes: Record<string, TableTypeStat> = {};

  tables.forEach((table) => {
    const tableType = table.category;

    if (!tableTypes[tableType]) {
      tableTypes[tableType] = { type: tableType, tableCount: 0, ticketCount: 0, tables: [] };
    }

    tableTypes[tableType].tableCount++;
    tableTypes[tableType].ticketCount += table.tickets;
    tableTypes[tableType].tables.push(table.seatId);
  });

  const categoryOrder = [
    "VIP barski sto",
    "VIP sjedeći",
    "VIP sto",
    "Separe",
    "Balkonski sto",
    "Barski sto",
    "Sto",
    "Ostali stolovi",
  ];

  const typeStats = Object.values(tableTypes).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a.type);
    const bIndex = categoryOrder.indexOf(b.type);
    const aOrder = aIndex === -1 ? 999 : aIndex;
    const bOrder = bIndex === -1 ? 999 : bIndex;
    return aOrder - bOrder;
  });

  return {
    tables,
    typeStats,
    summary: { totalTables: tables.length, totalTickets: tableTickets.length },
  };
}

// ═══════════════════════════════════════════════════════════════
// PDF EXPORT - A4 FORMAT
// ═══════════════════════════════════════════════════════════════

function exportTablesToPDF(tables: TableItem[], eventName: string, totalTables: number, totalTickets: number) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Molimo dozvolite pop-up prozore za export PDF-a");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Stolovi - ${eventName}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; line-height: 1.3; color: #1f2937; background: white; }
        .header { text-align: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 3px solid #d97706; }
        .header h1 { font-size: 18px; font-weight: 700; color: #C8102E; margin-bottom: 4px; letter-spacing: -0.5px; }
        .header .event-name { font-size: 13px; color: #4b5563; font-weight: 500; }
        .header .date { font-size: 9px; color: #9ca3af; margin-top: 4px; }
        .summary { display: flex; justify-content: center; gap: 12px; margin-bottom: 15px; }
        .summary-box { flex: 0 1 120px; text-align: center; padding: 10px 8px; border-radius: 6px; border: 1px solid; }
        .summary-box.amber { background: #fff1f2; border-color: #fca5a5; }
        .summary-box.blue { background: #eff6ff; border-color: #93c5fd; }
        .summary-box.green { background: #f0fdf4; border-color: #86efac; }
        .summary-box .value { font-size: 16px; font-weight: 700; line-height: 1.2; }
        .summary-box.amber .value { color: #C8102E; }
        .summary-box.blue .value { color: #2563eb; }
        .summary-box.green .value { color: #16a34a; }
        .summary-box .label { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        thead { display: table-header-group; }
        th { background: #C8102E; color: white; padding: 8px 6px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
        th:last-child { text-align: right; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
        td:last-child { text-align: right; }
        tr:nth-child(even) { background: #f9fafb; }
        .col-seat { width: 30%; }
        .col-type { width: 20%; }
        .col-guest { width: 25%; }
        .col-phone { width: 15%; }
        .col-tickets { width: 10%; }
        .guest-name { color: #2563eb; font-weight: 600; }
        .type { color: #6b7280; font-size: 9px; }
        .phone { color: #6b7280; font-size: 9px; }
        .tickets { color: #1e293b; font-weight: 700; }
        .footer-row { background: #f1f5f9 !important; border-top: 2px solid #C8102E; }
        .footer-row td { padding: 10px 6px; font-weight: 700; }
        .footer-row .label { color: #1e293b; font-size: 10px; }
        .footer-row .tickets { color: #1e293b; font-size: 11px; }
        .page-footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 8px; color: #9ca3af; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-break { page-break-inside: avoid; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Pregled stolova</h1>
        <div class="event-name">${eventName}</div>
        <div class="date">Datum exporta: ${new Date().toLocaleDateString("sr-RS")} u ${new Date().toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      <div class="summary">
        <div class="summary-box amber">
          <div class="value">${totalTables}</div>
          <div class="label">Ukupno stolova</div>
        </div>
        <div class="summary-box blue">
          <div class="value">${totalTickets}</div>
          <div class="label">Ukupno karata</div>
        </div>
        <div class="summary-box green">
          <div class="value">${totalTables > 0 ? (totalTickets / totalTables).toFixed(1) : 0}</div>
          <div class="label">Prosjek/sto</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="col-seat">Sto</th>
            <th class="col-type">Tip</th>
            <th class="col-guest">Gost</th>
            <th class="col-phone">Telefon</th>
            <th class="col-tickets">Karata</th>
          </tr>
        </thead>
        <tbody>
          ${tables
            .map(
              (t) => `
            <tr>
              <td class="col-seat">${formatSeatDisplay(t.seatId)}</td>
              <td class="col-type type">${t.category}</td>
              <td class="col-guest guest-name">${t.customerName}</td>
              <td class="col-phone phone">${t.customerPhone}</td>
              <td class="col-tickets tickets">${t.tickets}</td>
            </tr>
          `,
            )
            .join("")}
          <tr class="footer-row no-break">
            <td colspan="4" class="label">UKUPNO (${totalTables} stolova)</td>
            <td class="tickets">${totalTickets}</td>
          </tr>
        </tbody>
      </table>

      <div class="page-footer">
        e-tickets.me • Generisano automatski
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

// ═══════════════════════════════════════════════════════════════
// GRATIS STATISTIKA PO KATEGORIJAMA SA BROJEM STOLOVA
// ═══════════════════════════════════════════════════════════════

interface GratisByCategoryItem {
  category: string;
  count: number;
  tableCount: number;
}

function calculateGratisByCategory(tickets: any[]): GratisByCategoryItem[] {
  const gratisTickets = tickets.filter((t) => t.price === 0);
  const byCategory: Record<string, { count: number; tables: Set<string> }> = {};

  gratisTickets.forEach((t) => {
    const cat = t.category || "Nepoznato";
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, tables: new Set() };
    }
    byCategory[cat].count++;

    if (t.seatId && isTableSeat(t.seatId, t.category)) {
      byCategory[cat].tables.add(t.seatId.toString().trim());
    }
  });

  return Object.entries(byCategory)
    .map(([category, data]) => ({
      category,
      count: data.count,
      tableCount: data.tables.size,
    }))
    .sort((a, b) => b.count - a.count);
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CategoriesScreen() {
  const { selectedEvent, isLoading, exchangeRate } = useDashboard();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllTables, setShowAllTables] = useState(true);
  const [tableSearch, setTableSearch] = useState("");

  // Alokacije iz event-a
  const allocations: Allocation[] = useMemo(() => {
    if (!selectedEvent?.allocations) return [];
    return selectedEvent.allocations;
  }, [selectedEvent?.allocations]);

  const allocationSummary = useMemo(() => calculateAllocations(allocations), [allocations]);

  const tableStats = useMemo(() => {
    if (!selectedEvent?.tickets) return null;
    const visibleTickets = filterVisibleTickets(selectedEvent.tickets);
    return calculateTableStats(visibleTickets);
  }, [selectedEvent?.tickets]);

  const filteredTables = useMemo(() => {
    if (!tableStats?.tables) return [];
    if (!tableSearch.trim()) return tableStats.tables;

    const searchLower = tableSearch.toLowerCase().trim();
    return tableStats.tables.filter(
      (table) =>
        table.seatId.toLowerCase().includes(searchLower) ||
        table.customerName.toLowerCase().includes(searchLower) ||
        table.customerPhone.toLowerCase().includes(searchLower),
    );
  }, [tableStats?.tables, tableSearch]);

  const gratisByCategory = useMemo(() => {
    if (!selectedEvent?.tickets) return [];
    const visibleTickets = filterVisibleTickets(selectedEvent.tickets);
    return calculateGratisByCategory(visibleTickets);
  }, [selectedEvent?.tickets]);

  const totalGratis = gratisByCategory.reduce((sum, g) => sum + g.count, 0);

  const eventName = (selectedEvent as any)?.name || (selectedEvent as any)?.title || "Event";

  const handleExportPDF = () => {
    if (!tableStats) return;
    exportTablesToPDF(tableStats.tables, eventName, tableStats.summary.totalTables, tableStats.summary.totalTickets);
  };

  if (isLoading || !selectedEvent) {
    return <LoadingSkeleton />;
  }

  const categoryStats = calculateCategoryStats(selectedEvent.tickets, selectedEvent);
  const allTickets = filterVisibleTickets(selectedEvent.tickets);
  const paidTickets = allTickets.filter((t) => t.price > 0);
  const totalTickets = allTickets.length;
  const totalPaid = paidTickets.length;

  // Gradski stadion detekcija
  const venue = selectedEvent.venue || "";
  const isStadion = isGradskiStadion(venue);

  // Kapacitet - koristi hardkodirani za Gradski stadion
  const totalCapacity = isStadion
    ? Object.values(getTribuneCapacities()).reduce((s, v) => s + v, 0)
    : getTotalCapacity(selectedEvent.capacity);
  const fillPercentage = totalCapacity > 0 ? (totalTickets / totalCapacity) * 100 : 0;

  // STVARNO PREOSTALO = Kapacitet - (Prodato + Gratis + Sve alokacije)
  const realRemaining = Math.max(0, totalCapacity - totalTickets - allocationSummary.total);

  const currency = selectedEvent.currency;

  // Savez i Igraci karte (iz posebnog polja - isključene iz eTickets prodaje)
  const savezIgraciTickets = (selectedEvent as any).savezIgraciTickets || [];
  const savezByCategory: Record<string, number> = {};
  const igraciByCategory: Record<string, number> = {};
  savezIgraciTickets.forEach((t: any) => {
    const ch = (t.salesChannel || "").trim();
    const cat = t.category || "Ostalo";
    if (ch === "Savez") savezByCategory[cat] = (savezByCategory[cat] || 0) + 1;
    if (ch === "Igraci") igraciByCategory[cat] = (igraciByCategory[cat] || 0) + 1;
  });
  const totalSavez = Object.values(savezByCategory).reduce((s, v) => s + v, 0);
  const totalIgraci = Object.values(igraciByCategory).reduce((s, v) => s + v, 0);

  // ═══════════════════════════════════════════════════════════════
  // SEKTORSKA STATISTIKA (za Gradski stadion)
  // ═══════════════════════════════════════════════════════════════
  const sectorStats: { tribune: string; sector: string; etickets: number; gratis: number; savez: number; igraci: number; total: number; capacity: number }[] = [];
  if (isStadion) {
    const sectorMap = new Map<string, SectorStat>();
    const tribuneCaps = getTribuneCapacities();

    // Inicijalizuj sve sektore iz kapaciteta
    for (const [tribune, sectors] of Object.entries(GRADSKI_STADION_SECTORS)) {
      for (const [sector, cap] of Object.entries(sectors)) {
        const key = `${tribune}|${sector}`;
        sectorMap.set(key, {
          tribune,
          sector,
          etickets: 0,
          gratis: 0,
          savez: 0,
          igraci: 0,
          total: 0,
          capacity: cap,
        });
      }
    }

    // Rasporedi karte po sektorima
    // Helper za dodavanje karte u sektorsku mapu
    const addToSector = (t: any, type: "etickets" | "gratis" | "savez" | "igraci") => {
      const { tribune, sector } = extractSectorForTicket(t.category || "", t.seatId || "");
      const key = `${tribune}|${sector}`;
      if (!sectorMap.has(key)) {
        sectorMap.set(key, { tribune, sector, etickets: 0, gratis: 0, savez: 0, igraci: 0, total: 0, capacity: 0 });
      }
      const stat = sectorMap.get(key)!;
      stat.total++;
      stat[type]++;
    };

    // eTickets karte (prodaja + gratis)
    allTickets.forEach((t: any) => {
      const price = Number(t.price) || 0;
      addToSector(t, price === 0 ? "gratis" : "etickets");
    });

    // Savez/Igraci karte (isključene iz prodaje, samo za kapacitet)
    savezIgraciTickets.forEach((t: any) => {
      const ch = (t.salesChannel || "").trim();
      addToSector(t, ch === "Savez" ? "savez" : "igraci");
    });

    sectorStats.push(...Array.from(sectorMap.values()));
  }

  // Grupiši sektore po tribini za prikaz
  const tribuneOrder = ["Zapad", "Istok", "Sjever", "Jug", "VIP"];
  const sectorsByTribune = tribuneOrder
    .map((trib) => ({
      tribune: trib,
      sectors: sectorStats
        .filter((s) => s.tribune === trib)
        .sort((a, b) => a.sector.localeCompare(b.sector)),
    }))
    .filter((g) => g.sectors.length > 0);

  // GRUPISANE TRIBINE - koristi hardkodirani kapacitet za stadion
  const stadionCapacityByCategory = isStadion ? getTribuneCapacities() : (selectedEvent.capacityByCategory || {});
  const groupedStats = groupCategoryStatsByTribune(categoryStats, stadionCapacityByCategory);

  const chartData = groupedStats.map((g, idx) => ({
    name: g.group,
    value: g.count,
    fill: getCategoryColor(g.group, idx),
  }));

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 animate-slide-up">
      {/* Overall Capacity Stats - SA ALOKACIJAMA */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{totalCapacity}</p>
            <p className="text-[10px] text-muted-foreground">Kapacitet</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-3 text-center">
            <Ticket className="w-5 h-5 mx-auto mb-1 text-success" />
            <p className="text-lg font-bold">{totalPaid}</p>
            <p className="text-[10px] text-muted-foreground">Prodato</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-500">
          <CardContent className="p-3 text-center">
            <Gift className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-lg font-bold">{totalGratis}</p>
            <p className="text-[10px] text-muted-foreground">Gratis</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{allocationSummary.reserved}</p>
            <p className="text-[10px] text-muted-foreground">Rezerv.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-500">
          <CardContent className="p-3 text-center">
            <ExternalLink className="w-5 h-5 mx-auto mb-1 text-slate-500" />
            <p className="text-lg font-bold">{allocationSummary.externalChannel}</p>
            <p className="text-[10px] text-muted-foreground">Eksterno</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-warning" />
            <p className="text-lg font-bold">{realRemaining}</p>
            <p className="text-[10px] text-muted-foreground">Slobodno</p>
          </CardContent>
        </Card>
      </div>

      {/* ALOKACIJE PO KANALIMA */}
      {allocationSummary.externalChannel > 0 && (
        <Card className="border-l-4 border-l-slate-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-slate-500" />
              Eksterni Kanali ({allocationSummary.externalChannel} karata)
              <span className="text-xs text-muted-foreground font-normal ml-2">alocirano drugim prodavnicama</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(allocationSummary.byChannel).map(([channel, count], idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                >
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{channel}</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GRATIS KARTE PO KATEGORIJAMA */}
      {totalGratis > 0 && (
        <Card className="border-l-4 border-l-slate-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-slate-600" />
              Gratis Karte ({totalGratis})
              <span className="text-xs text-muted-foreground font-normal ml-2">besplatne ulaznice</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {gratisByCategory.map((g, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-500/10 border border-slate-200 dark:border-slate-500/30"
                >
                  <span className="text-xs text-slate-700 font-medium">{g.category}</span>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {g.count}
                    {g.tableCount > 0 && <span className="text-purple-400 font-normal ml-1">({g.tableCount} st.)</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories Table SA DINAMIČKIM KOLONAMA IZ BAZE */}
      <Card className="md:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Statistika po Tribinama
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-100 dark:bg-gray-800">
                  <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-2 py-2 text-left font-semibold min-w-[120px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    Tribina
                  </th>
                  <th className="px-2 py-2 text-right font-semibold bg-success/10">Prodato</th>
                  <th className="px-2 py-2 text-right font-semibold bg-slate-50 dark:bg-slate-500/10">Gratis</th>
                  {totalSavez > 0 && (
                    <th className="px-2 py-2 text-right font-semibold bg-amber-50 dark:bg-amber-500/10">Savez</th>
                  )}
                  {totalIgraci > 0 && (
                    <th className="px-2 py-2 text-right font-semibold bg-cyan-50 dark:bg-cyan-500/10">Igrači</th>
                  )}

                  {/* DINAMIČKE KOLONE ZA EKSTERNE KANALE IZ BAZE */}
                  {Object.keys(allocationSummary.byChannel)
                    .sort()
                    .map((channel) => (
                      <th key={channel} className="px-2 py-2 text-right font-semibold bg-slate-100">
                        {channel}
                      </th>
                    ))}

                  {/* REZERVISANO ako postoji u bazi */}
                  {allocationSummary.reserved > 0 && (
                    <th className="px-2 py-2 text-right font-semibold bg-blue-50 dark:bg-blue-500/10">Rezerv.</th>
                  )}

                  <th className="px-2 py-2 text-right font-semibold">Kap.</th>
                  <th className="px-2 py-2 text-right font-semibold bg-green-50 dark:bg-green-500/10">Slobodno</th>
                  <th className="px-2 py-2 text-right font-semibold bg-channel-online-bg/30">Onl.</th>
                  <th className="px-2 py-2 text-right font-semibold bg-channel-biletarnica-bg/30">Bil.</th>
                  <th className="px-2 py-2 text-right font-semibold bg-channel-virman-bg/30">Vir.</th>
                  <th className="px-2 py-2 text-right font-semibold bg-channel-kartica-bg/30">Kar.</th>
                  <th className="px-2 py-2 text-right font-semibold bg-success/10">Iznos</th>
                </tr>
              </thead>
              <tbody>
                {groupedStats.map((g, idx) => {
                  const gColor = getCategoryColor(g.group, idx);
                  // Saberi gratis iz svih potkategorija ove grupe
                  const gratisInGroup = gratisByCategory
                    .filter((gr) => g.subcategories.includes(gr.category))
                    .reduce((sum, gr) => sum + gr.count, 0);
                  // Saberi Savez i Igraci iz svih potkategorija
                  const savezInGroup = g.subcategories.reduce((sum, sub) => sum + (savezByCategory[sub] || 0), 0);
                  const igraciInGroup = g.subcategories.reduce((sum, sub) => sum + (igraciByCategory[sub] || 0), 0);
                  // Saberi alokacije iz svih potkategorija
                  const groupAllocTotal = g.subcategories.reduce((sum, sub) => {
                    return sum + calculateCategoryAllocations(allocations, sub).total;
                  }, 0);
                  const groupAllocReserved = g.subcategories.reduce((sum, sub) => {
                    return sum + calculateCategoryAllocations(allocations, sub).reserved;
                  }, 0);
                  const groupAllocByChannel: Record<string, number> = {};
                  g.subcategories.forEach((sub) => {
                    const subAlloc = calculateCategoryAllocations(allocations, sub);
                    Object.entries(subAlloc.byChannel).forEach(([ch, cnt]) => {
                      groupAllocByChannel[ch] = (groupAllocByChannel[ch] || 0) + cnt;
                    });
                  });
                  const realAvailable = Math.max(0, g.capacity - g.count - groupAllocTotal);

                  return (
                    <tr
                      key={g.group}
                      className={`${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} cursor-pointer hover:bg-muted/40 transition-colors`}
                      onClick={() => setSelectedCategory(g.group)}
                    >
                      <td
                        className={`sticky left-0 z-10 px-2 py-2 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap ${
                          idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"
                        }`}
                      >
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap"
                          style={{
                            borderColor: gColor,
                            color: gColor,
                            backgroundColor: "transparent",
                          }}
                        >
                          {g.group}
                        </span>
                        {g.subcategories.length > 1 && (
                          <span className="ml-1 text-[9px] text-muted-foreground">({g.subcategories.length})</span>
                        )}
                      </td>

                      <td className="px-2 py-2 text-right font-semibold text-success bg-success/5">
                        {g.count - gratisInGroup - savezInGroup - igraciInGroup}
                      </td>

                      <td className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10">
                        {gratisInGroup || 0}
                      </td>

                      {totalSavez > 0 && (
                        <td className="px-2 py-2 text-right font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">
                          {savezInGroup || "-"}
                        </td>
                      )}
                      {totalIgraci > 0 && (
                        <td className="px-2 py-2 text-right font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10">
                          {igraciInGroup || "-"}
                        </td>
                      )}

                      {Object.keys(allocationSummary.byChannel)
                        .sort()
                        .map((channel) => (
                          <td key={channel} className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30">
                            {groupAllocByChannel[channel] || "-"}
                          </td>
                        ))}

                      {allocationSummary.reserved > 0 && (
                        <td className="px-2 py-2 text-right font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
                          {groupAllocReserved || "-"}
                        </td>
                      )}

                      <td className="px-2 py-2 text-right text-muted-foreground">{g.capacity || "-"}</td>

                      <td className="px-2 py-2 text-right font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10">{realAvailable}</td>

                      <td className="px-2 py-2 text-right bg-channel-online-bg/20 text-channel-online font-medium">
                        {g.online || "-"}
                      </td>
                      <td className="px-2 py-2 text-right bg-channel-biletarnica-bg/20 text-channel-biletarnica font-medium">
                        {g.biletarnica || "-"}
                      </td>
                      <td className="px-2 py-2 text-right bg-channel-virman-bg/20 text-channel-virman font-medium">
                        {g.virman || "-"}
                      </td>
                      <td className="px-2 py-2 text-right bg-channel-kartica-bg/20 text-channel-kartica font-medium">
                        {g.kartica || "-"}
                      </td>
                      <td className="px-2 py-2 text-right bg-success/5 font-semibold text-success">
                        {formatCurrencyNoDecimals(g.amount, currency, exchangeRate, false)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted font-bold">
                  <td className="sticky left-0 z-10 bg-gray-200 dark:bg-gray-700 px-2 py-2 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    UKUPNO
                  </td>

                  <td className="px-2 py-2 text-right text-success bg-success/10">{totalPaid - totalSavez - totalIgraci}</td>

                  <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10">{totalGratis}</td>

                  {totalSavez > 0 && (
                    <td className="px-2 py-2 text-right text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">{totalSavez}</td>
                  )}
                  {totalIgraci > 0 && (
                    <td className="px-2 py-2 text-right text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10">{totalIgraci}</td>
                  )}

                  {/* UKUPNO PO KANALIMA */}
                  {Object.entries(allocationSummary.byChannel)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([channel, total]) => (
                      <td key={channel} className="px-2 py-2 text-right text-slate-600 bg-slate-50">
                        {total}
                      </td>
                    ))}

                  {/* UKUPNO REZERVISANO */}
                  {allocationSummary.reserved > 0 && (
                    <td className="px-2 py-2 text-right text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">{allocationSummary.reserved}</td>
                  )}

                  <td className="px-2 py-2 text-right">{totalCapacity}</td>

                  <td className="px-2 py-2 text-right text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10">{realRemaining}</td>

                  <td className="px-2 py-2 text-right bg-channel-online-bg/30">
                    {groupedStats.reduce((sum, c) => sum + c.online, 0)}
                  </td>
                  <td className="px-2 py-2 text-right bg-channel-biletarnica-bg/30">
                    {groupedStats.reduce((sum, c) => sum + c.biletarnica, 0)}
                  </td>
                  <td className="px-2 py-2 text-right bg-channel-virman-bg/30">
                    {groupedStats.reduce((sum, c) => sum + c.virman, 0)}
                  </td>
                  <td className="px-2 py-2 text-right bg-channel-kartica-bg/30">
                    {groupedStats.reduce((sum, c) => sum + c.kartica, 0)}
                  </td>
                  <td className="px-2 py-2 text-right bg-success/10 text-success">
                    {formatCurrencyNoDecimals(
                      groupedStats.reduce((sum, c) => sum + c.amount, 0),
                      currency,
                      exchangeRate,
                      false,
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* STATISTIKA PO SEKTORIMA - samo za Gradski stadion */}
      {isStadion && sectorsByTribune.length > 0 && (
        <Card className="md:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Statistika po Sektorima
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead></thead>
                <tbody>
                  {sectorsByTribune.map((group) => {
                    const tribTotals = group.sectors.reduce(
                      (acc, s) => ({
                        etickets: acc.etickets + s.etickets,
                        gratis: acc.gratis + s.gratis,
                        savez: acc.savez + s.savez,
                        igraci: acc.igraci + s.igraci,
                        total: acc.total + s.total,
                        capacity: acc.capacity + s.capacity,
                      }),
                      { etickets: 0, gratis: 0, savez: 0, igraci: 0, total: 0, capacity: 0 },
                    );
                    const tribColor = getCategoryColor(group.tribune, 0);
                    const tribFree = Math.max(0, tribTotals.capacity - tribTotals.total);
                    const tribPct = tribTotals.capacity > 0 ? ((tribTotals.total / tribTotals.capacity) * 100).toFixed(1) : "0.0";

                    return (
                      <React.Fragment key={group.tribune}>
                        {/* Column headers repeated per tribune */}
                        <tr className="border-b bg-gray-100 dark:bg-gray-800 border-t-2">
                          <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 text-left font-semibold min-w-[140px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] text-[10px]">
                            Sektor
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold bg-success/10 text-[10px]">eTickets</th>
                          <th className="px-2 py-1.5 text-right font-semibold bg-slate-50 dark:bg-slate-500/10 text-[10px]">Gratis</th>
                          <th className="px-2 py-1.5 text-right font-semibold bg-amber-50 dark:bg-amber-500/10 text-[10px]">Savez</th>
                          <th className="px-2 py-1.5 text-right font-semibold bg-cyan-50 dark:bg-cyan-500/10 text-[10px]">Igrači</th>
                          <th className="px-2 py-1.5 text-right font-semibold text-[10px]">Ukupno</th>
                          <th className="px-2 py-1.5 text-right font-semibold text-[10px]">Kap.</th>
                          <th className="px-2 py-1.5 text-right font-semibold bg-green-50 dark:bg-green-500/10 text-[10px]">Slobodno</th>
                          <th className="px-2 py-1.5 text-right font-semibold text-[10px]">%</th>
                        </tr>
                        {/* Tribune header row */}
                        <tr className="bg-muted/60">
                          <td
                            className="sticky left-0 z-10 bg-gray-200 dark:bg-gray-700 px-2 py-2 font-bold border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                          >
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{ borderColor: tribColor, color: tribColor }}
                            >
                              {group.tribune}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-bold text-success bg-success/10">{tribTotals.etickets}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-600 bg-slate-50 dark:bg-slate-500/10">{tribTotals.gratis}</td>
                          <td className="px-2 py-2 text-right font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10">{tribTotals.savez}</td>
                          <td className="px-2 py-2 text-right font-bold text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10">{tribTotals.igraci}</td>
                          <td className="px-2 py-2 text-right font-bold">{tribTotals.total}</td>
                          <td className="px-2 py-2 text-right font-bold text-muted-foreground">{tribTotals.capacity}</td>
                          <td className="px-2 py-2 text-right font-bold text-green-600 bg-green-50 dark:bg-green-500/10">{tribFree}</td>
                          <td className="px-2 py-2 text-right font-bold">{tribPct}%</td>
                        </tr>
                        {/* Sector rows */}
                        {group.sectors.map((s, sIdx) => {
                          const free = Math.max(0, s.capacity - s.total);
                          const pct = s.capacity > 0 ? ((s.total / s.capacity) * 100).toFixed(1) : "-";
                          return (
                            <tr
                              key={`${s.tribune}-${s.sector}`}
                              className={sIdx % 2 === 0 ? "bg-card" : "bg-muted/20"}
                            >
                              <td
                                className={`sticky left-0 z-10 px-2 py-1.5 pl-6 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] text-muted-foreground ${
                                  sIdx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"
                                }`}
                              >
                                Sektor: {s.sector}
                              </td>
                              <td className="px-2 py-1.5 text-right text-success bg-success/5">{s.etickets || "-"}</td>
                              <td className="px-2 py-1.5 text-right text-slate-600 bg-purple-50/50 dark:bg-purple-500/5">{s.gratis || "-"}</td>
                              <td className="px-2 py-1.5 text-right text-amber-600 bg-amber-50/50 dark:bg-amber-500/5">{s.savez || "-"}</td>
                              <td className="px-2 py-1.5 text-right text-cyan-600 bg-cyan-50/50 dark:bg-cyan-500/5">{s.igraci || "-"}</td>
                              <td className="px-2 py-1.5 text-right font-medium">{s.total || "-"}</td>
                              <td className="px-2 py-1.5 text-right text-muted-foreground">{s.capacity || "-"}</td>
                              <td className="px-2 py-1.5 text-right text-green-600 bg-green-50/50 dark:bg-green-500/5">{free}</td>
                              <td className="px-2 py-1.5 text-right text-muted-foreground">{pct === "-" ? "-" : `${pct}%`}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted font-bold">
                    <td className="sticky left-0 z-10 bg-gray-200 dark:bg-gray-700 px-2 py-2 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                      UKUPNO
                    </td>
                    <td className="px-2 py-2 text-right text-success bg-success/10">
                      {sectorStats.reduce((s, x) => s + x.etickets, 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-600 bg-slate-50 dark:bg-slate-500/10">
                      {sectorStats.reduce((s, x) => s + x.gratis, 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-amber-600 bg-amber-50 dark:bg-amber-500/10">
                      {sectorStats.reduce((s, x) => s + x.savez, 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10">
                      {sectorStats.reduce((s, x) => s + x.igraci, 0)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {sectorStats.reduce((s, x) => s + x.total, 0)}
                    </td>
                    <td className="px-2 py-2 text-right">{totalCapacity}</td>
                    <td className="px-2 py-2 text-right text-green-600 bg-green-50 dark:bg-green-500/10">
                      {Math.max(0, totalCapacity - sectorStats.reduce((s, x) => s + x.total, 0))}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {totalCapacity > 0 ? ((sectorStats.reduce((s, x) => s + x.total, 0) / totalCapacity) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content grid - Chart and Categories side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Doughnut Chart */}
        <Card className="md:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Distribucija po Tribinama
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    onClick={(data) => setSelectedCategory(data.name)}
                    style={{ cursor: "pointer" }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const g = groupedStats.find((gs) => gs.group === name);
                      const remaining = g ? Math.max(0, g.capacity - g.count) : 0;
                      return [`${value} prodato / ${remaining} preostalo`, name];
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">Klikni tribinu za detalje</p>
          </CardContent>
        </Card>

        {/* Category Legend Card - visible on desktop */}
        <Card className="hidden lg:block md:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pregled Tribina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {groupedStats.map((g, idx) => {
                const gColor = getCategoryColor(g.group, idx);
                const remaining = Math.max(0, g.capacity - g.count);
                const fillPct = g.capacity > 0 ? (g.count / g.capacity) * 100 : 0;

                return (
                  <div
                    key={g.group}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCategory(g.group)}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: gColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium truncate">{g.group}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {g.count}/{g.capacity}
                        </span>
                      </div>
                      <Progress value={fillPct} className="h-1.5" />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-semibold text-success">{remaining}</span>
                      <span className="text-[10px] text-muted-foreground block">slob.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STOLOVI SEKCIJA - ORIGINALNA LOGIKA */}
      {tableStats && tableStats.summary.totalTables > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-slate-500" />
                Stolovi
              </div>
              {showAllTables && (
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-7 px-3 text-xs gap-1.5">
                  <FileDown className="w-3.5 h-3.5 text-red-600" />
                  Export PDF
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-4 bg-slate-50 border border-slate-200 text-center dark:bg-slate-800/50 dark:border-slate-700">
                <UtensilsCrossed className="h-6 w-6 text-slate-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{tableStats.summary.totalTables}</p>
                <p className="text-xs text-slate-500">Ukupno stolova</p>
              </div>
              <div className="rounded-lg p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-center">
                <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{tableStats.summary.totalTickets}</p>
                <p className="text-xs text-blue-600">Ukupno karata</p>
              </div>
              <div className="rounded-lg p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-center">
                <Target className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-700">
                  {tableStats.summary.totalTables > 0
                    ? (tableStats.summary.totalTickets / tableStats.summary.totalTables).toFixed(1)
                    : 0}
                </p>
                <p className="text-xs text-green-600">Prosjek po stolu</p>
              </div>
            </div>

            {tableStats.typeStats.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Po tipu</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {tableStats.typeStats.map((stat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 border dark:border-border">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{stat.type}</p>
                        <p className="text-xs text-gray-500">{stat.ticketCount} karata</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{stat.tableCount}</p>
                        <p className="text-xs text-gray-500">stolova</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Detalji</p>
                <button
                  onClick={() => {
                    setShowAllTables(!showAllTables);
                    if (!showAllTables) setTableSearch("");
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {showAllTables ? "Sakrij" : "Prikaži sve"}
                </button>
              </div>

              {showAllTables && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Pretraži po stolu, imenu ili telefonu..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>

                  {tableSearch && (
                    <p className="text-xs text-muted-foreground">
                      Pronađeno: {filteredTables.length} od {tableStats.tables.length} stolova
                    </p>
                  )}

                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Sto</TableHead>
                          <TableHead className="text-xs">Tip</TableHead>
                          <TableHead className="text-xs">Gost</TableHead>
                          <TableHead className="text-xs">Telefon</TableHead>
                          <TableHead className="text-xs text-right">Karata</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTables.length > 0 ? (
                          filteredTables.map((table, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/50">
                              <TableCell className="font-medium text-xs">{formatSeatDisplay(table.seatId)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{table.category}</TableCell>
                              <TableCell className="text-xs text-blue-600 font-medium">{table.customerName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{table.customerPhone}</TableCell>
                              <TableCell className="text-right text-xs font-semibold text-primary">
                                {table.tickets}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-4">
                              {tableSearch ? "Nema rezultata pretrage" : "Nema stolova"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tribune Detail Drawer */}
      <Drawer open={!!selectedCategory} onOpenChange={(open) => !open && setSelectedCategory(null)}>
        <DrawerContent>
          {selectedCategory &&
            (() => {
              const g = groupedStats.find((gs) => gs.group === selectedCategory);
              if (!g) return null;

              const gratisInGroup = gratisByCategory
                .filter((gr) => g.subcategories.includes(gr.category))
                .reduce((sum, gr) => sum + gr.count, 0);
              const savezInGrp = g.subcategories.reduce((sum, sub) => sum + (savezByCategory[sub] || 0), 0);
              const igraciInGrp = g.subcategories.reduce((sum, sub) => sum + (igraciByCategory[sub] || 0), 0);
              const groupAllocTotal = g.subcategories.reduce((sum, sub) => {
                return sum + calculateCategoryAllocations(allocations, sub).total;
              }, 0);
              const remaining = Math.max(0, g.capacity - g.count - groupAllocTotal);

              const gIndex = groupedStats.findIndex((gs) => gs.group === selectedCategory);
              const gColor = getCategoryColor(selectedCategory, gIndex);

              return (
                <>
                  <DrawerHeader className="text-center pb-2">
                    <DrawerTitle className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: gColor }} />
                      {selectedCategory}
                    </DrawerTitle>
                    <DrawerDescription>
                      {g.subcategories.length > 1
                        ? `Sadrži: ${g.subcategories.join(", ")}`
                        : "Detalji tribine"}
                    </DrawerDescription>
                  </DrawerHeader>

                  <div className="px-4 pb-6 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-success/10 rounded-lg p-3 text-center">
                        <Ticket className="w-5 h-5 mx-auto mb-1 text-success" />
                        <p className="text-xl font-bold text-success">{g.count - gratisInGroup - savezInGrp - igraciInGrp}</p>
                        <p className="text-[10px] text-muted-foreground">eTickets</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-500/10 rounded-lg p-3 text-center">
                        <Gift className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                        <p className="text-xl font-bold text-slate-600">{gratisInGroup}</p>
                        <p className="text-[10px] text-muted-foreground">Gratis</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-3 text-center">
                        <Target className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        <p className="text-xl font-bold text-green-600">{remaining}</p>
                        <p className="text-[10px] text-muted-foreground">Slobodno</p>
                      </div>
                    </div>
                    {(savezInGrp > 0 || igraciInGrp > 0 || groupAllocTotal > 0) && (
                      <div className="grid grid-cols-3 gap-2">
                        {savezInGrp > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                            <Building2 className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                            <p className="text-xl font-bold text-amber-600">{savezInGrp}</p>
                            <p className="text-[10px] text-muted-foreground">Savez</p>
                          </div>
                        )}
                        {igraciInGrp > 0 && (
                          <div className="bg-cyan-50 dark:bg-cyan-500/10 rounded-lg p-3 text-center">
                            <Users className="w-5 h-5 mx-auto mb-1 text-cyan-600" />
                            <p className="text-xl font-bold text-cyan-600">{igraciInGrp}</p>
                            <p className="text-[10px] text-muted-foreground">Igrači</p>
                          </div>
                        )}
                        {groupAllocTotal > 0 && (
                          <div className="bg-slate-100 rounded-lg p-3 text-center dark:bg-slate-800/50">
                            <ExternalLink className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                            <p className="text-xl font-bold text-slate-600 dark:text-slate-400">{groupAllocTotal}</p>
                            <p className="text-[10px] text-muted-foreground">Alocir.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Potkategorije - detalji */}
                    {g.subcategories.length > 1 && (
                      <div className="bg-muted/30 border rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Potkategorije:</p>
                        <div className="space-y-1.5 text-xs">
                          {g.subcategories.map((sub) => {
                            const subStat = categoryStats.find((c) => c.category === sub);
                            return (
                              <div key={sub} className="flex justify-between items-center">
                                <span className="text-foreground font-medium">{sub}</span>
                                <div className="flex gap-3">
                                  <span className="text-success font-semibold">{subStat?.count || 0}</span>
                                  <span className="text-muted-foreground">/ {subStat?.capacity || 0}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {g.capacity > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Popunjenost</span>
                          <span className="font-semibold">
                            {(((g.count + groupAllocTotal) / g.capacity) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={((g.count + groupAllocTotal) / g.capacity) * 100} className="h-2" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Prodaja po kanalima</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 bg-channel-online-bg/30 rounded-lg p-2">
                          <Globe className="w-4 h-4 text-channel-online" />
                          <div>
                            <p className="text-sm font-semibold text-channel-online">{g.online || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Online</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-channel-biletarnica-bg/30 rounded-lg p-2">
                          <Building2 className="w-4 h-4 text-channel-biletarnica" />
                          <div>
                            <p className="text-sm font-semibold text-channel-biletarnica">{g.biletarnica || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Biletarnica</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-channel-virman-bg/30 rounded-lg p-2">
                          <ShoppingCart className="w-4 h-4 text-channel-virman" />
                          <div>
                            <p className="text-sm font-semibold text-channel-virman">{g.virman || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Virman</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-channel-kartica-bg/30 rounded-lg p-2">
                          <CreditCard className="w-4 h-4 text-channel-kartica" />
                          <div>
                            <p className="text-sm font-semibold text-channel-kartica">{g.kartica || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Kartica</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-success/10 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Ukupan prihod</p>
                      <p className="text-2xl font-bold text-success">
                        {formatCurrencyNoDecimals(g.amount, currency, exchangeRate)}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
