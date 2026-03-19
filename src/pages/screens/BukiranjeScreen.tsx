import { useState, useMemo } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { formatCurrencyNoDecimals } from "@/lib/dashboard-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bookmark, Ticket, Banknote, UtensilsCrossed, Search, CalendarDays, TrendingUp, FileDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ═══════════════════════════════════════════════════════════════
// TIPOVI
// ═══════════════════════════════════════════════════════════════

interface RezervacijaStats {
  totalTickets: number;
  totalAmount: number;
  byDate: { date: string; count: number; amount: number }[];
  tables: {
    seatId: string;
    tickets: number;
    amount: number;
    category: string;
    customerName: string;
    customerPhone: string;
  }[];
  totalTables: number;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNKCIJE
// ═══════════════════════════════════════════════════════════════

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

function isTableSeat(seatId: string): boolean {
  if (!seatId) return false;
  const lowerName = seatId.toString().toLowerCase().trim();
  return TABLE_PREFIXES.some((prefix) => lowerName.startsWith(prefix));
}

function formatSeatDisplay(seatId: string): string {
  if (!seatId) return seatId;
  const match = seatId.match(/Sto\s*broj[- ]*(\d+)/i);
  if (match) {
    return `Sto broj ${match[1]}`;
  }
  return seatId;
}

function calculateRezervacijaStats(tickets: any[]): RezervacijaStats | null {
  if (!tickets || tickets.length === 0) return null;

  let totalAmount = 0;
  const dateMap: Record<string, { count: number; amount: number }> = {};
  const tableGroups: Record<
    string,
    { seatId: string; tickets: number; amount: number; category: string; customerName: string; customerPhone: string }
  > = {};

  tickets.forEach((ticket) => {
    const price = Number(ticket.price) || 0;
    totalAmount += price;

    const dateStr = ticket.purchaseDate ? new Date(ticket.purchaseDate).toLocaleDateString("sr-RS") : "Nepoznato";
    if (!dateMap[dateStr]) {
      dateMap[dateStr] = { count: 0, amount: 0 };
    }
    dateMap[dateStr].count++;
    dateMap[dateStr].amount += price;

    const seatId = ticket.seatId?.toString().trim().replace(/\s+/g, " ") || "Nepoznato";
    if (!tableGroups[seatId]) {
      tableGroups[seatId] = {
        seatId,
        tickets: 0,
        amount: 0,
        category: ticket.category || "Nepoznato",
        customerName: ticket.customerName || "Nepoznato",
        customerPhone: ticket.customerPhone || "-",
      };
    }
    tableGroups[seatId].tickets++;
    tableGroups[seatId].amount += price;
  });

  const byDate = Object.entries(dateMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => {
      if (a.date === "Nepoznato") return 1;
      if (b.date === "Nepoznato") return -1;
      const [dayA, monthA, yearA] = a.date.split(".").map(Number);
      const [dayB, monthB, yearB] = b.date.split(".").map(Number);
      return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
    });

  const tables = Object.values(tableGroups).sort((a, b) => {
    const aNum = parseInt(a.seatId.replace(/\D/g, "")) || 0;
    const bNum = parseInt(b.seatId.replace(/\D/g, "")) || 0;
    return aNum - bNum;
  });

  return {
    totalTickets: tickets.length,
    totalAmount,
    byDate,
    tables,
    totalTables: tables.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// PDF EXPORT - A4 FORMAT
// ═══════════════════════════════════════════════════════════════

function exportToPDF(
  tables: RezervacijaStats["tables"],
  eventName: string,
  currency: string,
  exchangeRate: number,
  totalTickets: number,
  totalAmount: number,
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Molimo dozvolite pop-up prozore za export PDF-a");
    return;
  }

  const formatAmount = (amount: number) => formatCurrencyNoDecimals(amount, currency, exchangeRate);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Rezervacije - ${eventName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 10mm;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 10px;
          line-height: 1.3;
          color: #1f2937;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
          padding-bottom: 12px;
          border-bottom: 3px solid #f97316;
        }
        .header h1 {
          font-size: 18px;
          font-weight: 700;
          color: #f97316;
          margin-bottom: 4px;
          letter-spacing: -0.5px;
        }
        .header .event-name {
          font-size: 13px;
          color: #4b5563;
          font-weight: 500;
        }
        .header .date {
          font-size: 9px;
          color: #9ca3af;
          margin-top: 4px;
        }
        .summary {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 15px;
        }
        .summary-box {
          flex: 0 1 120px;
          text-align: center;
          padding: 10px 8px;
          border-radius: 6px;
          border: 1px solid;
        }
        .summary-box.orange {
          background: #fff1f2;
          border-color: #fca5a5;
        }
        .summary-box.green { 
          background: #f0fdf4; 
          border-color: #86efac; 
        }
        .summary-box.blue { 
          background: #eff6ff; 
          border-color: #93c5fd; 
        }
        .summary-box .value {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.2;
        }
        .summary-box.orange .value { color: #C8102E; }
        .summary-box.green .value { color: #16a34a; }
        .summary-box.blue .value { color: #2563eb; }
        .summary-box .label {
          font-size: 8px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }
        thead {
          display: table-header-group;
        }
        th {
          background: #C8102E;
          color: white;
          padding: 8px 6px;
          text-align: left;
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        th:nth-child(4), th:nth-child(5) {
          text-align: right;
        }
        td {
          padding: 6px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: middle;
        }
        td:nth-child(4), td:nth-child(5) {
          text-align: right;
        }
        tr:nth-child(even) {
          background: #f9fafb;
        }
        .col-seat { width: 28%; }
        .col-guest { width: 25%; }
        .col-phone { width: 22%; }
        .col-tickets { width: 10%; }
        .col-amount { width: 15%; }
        .guest-name {
          color: #2563eb;
          font-weight: 600;
        }
        .phone {
          color: #6b7280;
          font-size: 9px;
        }
        .tickets {
          color: #1e293b;
          font-weight: 700;
        }
        .amount {
          color: #16a34a;
          font-weight: 700;
        }
        .footer-row {
          background: #f1f5f9 !important;
          border-top: 2px solid #C8102E;
        }
        .footer-row td {
          padding: 10px 6px;
          font-weight: 700;
        }
        .footer-row .label {
          color: #1e293b;
          font-size: 10px;
        }
        .footer-row .tickets {
          color: #1e293b;
          font-size: 11px;
        }
        .footer-row .amount {
          color: #16a34a;
          font-size: 11px;
        }
        .page-footer {
          margin-top: 15px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 8px;
          color: #9ca3af;
        }
        @media print {
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .no-break {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Rezervacije organizatora</h1>
        <div class="event-name">${eventName}</div>
        <div class="date">Datum exporta: ${new Date().toLocaleDateString("sr-RS")} u ${new Date().toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      <div class="summary">
        <div class="summary-box orange">
          <div class="value">${totalTickets}</div>
          <div class="label">Ukupno karata</div>
        </div>
        <div class="summary-box green">
          <div class="value">${formatAmount(totalAmount)}</div>
          <div class="label">Ukupan iznos</div>
        </div>
        <div class="summary-box blue">
          <div class="value">${tables.length}</div>
          <div class="label">Rezervacija</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="col-seat">Sto / Mjesto</th>
            <th class="col-guest">Gost</th>
            <th class="col-phone">Telefon</th>
            <th class="col-tickets">Karata</th>
            <th class="col-amount">Iznos</th>
          </tr>
        </thead>
        <tbody>
          ${tables
            .map(
              (t) => `
            <tr>
              <td class="col-seat">${formatSeatDisplay(t.seatId)}</td>
              <td class="col-guest guest-name">${t.customerName}</td>
              <td class="col-phone phone">${t.customerPhone}</td>
              <td class="col-tickets tickets">${t.tickets}</td>
              <td class="col-amount amount">${formatAmount(t.amount)}</td>
            </tr>
          `,
            )
            .join("")}
          <tr class="footer-row no-break">
            <td colspan="3" class="label">UKUPNO</td>
            <td class="tickets">${totalTickets}</td>
            <td class="amount">${formatAmount(totalAmount)}</td>
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function BukiranjeScreen() {
  const { selectedEvent, isLoading, exchangeRate } = useDashboard();
  const [tableSearch, setTableSearch] = useState("");
  const [showAllDates, setShowAllDates] = useState(false);

  const stats = useMemo(() => {
    if (!selectedEvent?.rezervacijaTickets || selectedEvent.rezervacijaTickets.length === 0) return null;
    return calculateRezervacijaStats(selectedEvent.rezervacijaTickets);
  }, [selectedEvent?.rezervacijaTickets]);

  const filteredTables = useMemo(() => {
    if (!stats?.tables) return [];
    if (!tableSearch.trim()) return stats.tables;

    const searchLower = tableSearch.toLowerCase().trim();
    return stats.tables.filter(
      (table) =>
        table.seatId.toLowerCase().includes(searchLower) ||
        table.customerName.toLowerCase().includes(searchLower) ||
        table.customerPhone.toLowerCase().includes(searchLower),
    );
  }, [stats?.tables, tableSearch]);

  const currency = selectedEvent?.currency || "EUR";
  const eventName = (selectedEvent as any)?.name || (selectedEvent as any)?.title || "Event";

  const handleExportPDF = () => {
    if (!stats || !selectedEvent) return;
    exportToPDF(stats.tables, eventName, currency, exchangeRate, stats.totalTickets, stats.totalAmount);
  };

  if (isLoading || !selectedEvent) {
    return <LoadingSkeleton />;
  }

  if (!stats) {
    return (
      <div className="p-6 text-center">
        <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground">Nema rezervacija za ovaj događaj</p>
      </div>
    );
  }

  const avgTicketValue = stats.totalTickets > 0 ? stats.totalAmount / stats.totalTickets : 0;

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 animate-slide-up">
      {/* Header info */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 dark:bg-slate-800/50 dark:border-slate-700">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Bookmark className="w-4 h-4" />
          <span className="text-sm font-medium">Rezervacije organizatora</span>
          <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded ml-auto">Bez provizije e-tickets</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="border-l-4 border-l-red-600">
          <CardContent className="p-3 text-center">
            <Ticket className="w-5 h-5 mx-auto mb-1 text-red-600" />
            <p className="text-xl font-bold text-red-600">{stats.totalTickets}</p>
            <p className="text-[10px] text-muted-foreground">Ukupno karata</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3 text-center">
            <Banknote className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-xl font-bold text-green-600">
              {formatCurrencyNoDecimals(stats.totalAmount, currency, exchangeRate)}
            </p>
            <p className="text-[10px] text-muted-foreground">Ukupan iznos</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 text-center">
            <UtensilsCrossed className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold text-blue-600">{stats.totalTables}</p>
            <p className="text-[10px] text-muted-foreground">Rezervacija</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-xl font-bold text-purple-600">
              {formatCurrencyNoDecimals(avgTicketValue, currency, exchangeRate)}
            </p>
            <p className="text-[10px] text-muted-foreground">Prosjek/karta</p>
          </CardContent>
        </Card>
      </div>

      {/* Po datumima */}
      {stats.byDate.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Po datumu rezervacije
              </div>
              {stats.byDate.length > 5 && (
                <button
                  onClick={() => setShowAllDates(!showAllDates)}
                  className="text-xs text-primary hover:underline font-normal"
                >
                  {showAllDates ? "Sakrij" : `Prikaži sve (${stats.byDate.length})`}
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-64 overflow-y-auto">
              {(showAllDates ? stats.byDate : stats.byDate.slice(0, 5)).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <p className="font-medium text-sm">{item.date}</p>
                  <div className="text-right">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{item.count} karata</p>
                    <p className="text-xs text-green-600">
                      {formatCurrencyNoDecimals(item.amount, currency, exchangeRate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stolovi / Rezervacije */}
      {stats.tables.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-slate-500" />
                Rezervacije ({stats.totalTables})
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-7 px-3 text-xs gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-red-600" />
                Export PDF
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                Pronađeno: {filteredTables.length} od {stats.tables.length}
              </p>
            )}

            <div className="max-h-80 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Sto/Mjesto</TableHead>
                    <TableHead className="text-xs">Gost</TableHead>
                    <TableHead className="text-xs">Telefon</TableHead>
                    <TableHead className="text-xs text-right">Karata</TableHead>
                    <TableHead className="text-xs text-right">Iznos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTables.length > 0 ? (
                    filteredTables.map((table, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-xs">{formatSeatDisplay(table.seatId)}</TableCell>
                        <TableCell className="text-xs text-blue-600 font-medium">{table.customerName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{table.customerPhone}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {table.tickets}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-green-600">
                          {formatCurrencyNoDecimals(table.amount, currency, exchangeRate)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-4">
                        {tableSearch ? "Nema rezultata pretrage" : "Nema rezervacija"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
              <span className="font-medium text-slate-700 dark:text-slate-300">Ukupno:</span>
              <div className="text-right">
                <span className="font-bold text-slate-800 dark:text-slate-200">{stats.totalTickets} karata</span>
                <span className="text-green-600 font-semibold ml-3">
                  {formatCurrencyNoDecimals(stats.totalAmount, currency, exchangeRate)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
