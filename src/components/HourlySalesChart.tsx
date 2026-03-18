import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Clock,
  TrendingUp,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Store,
  Users,
  Calendar as CalendarIcon,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  GitCompare,
  Trophy,
  Play,
  CreditCard,
  Globe,
  Building2,
  Download,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/DashboardContext";

// ═══════════════════════════════════════════════════════════════
// ADMIN EMAIL - samo ovaj korisnik vidi Cards tab
// ═══════════════════════════════════════════════════════════════
const ADMIN_EMAIL = "rade.milosevic87@gmail.com";

interface HourlyStatItem {
  hour: number;
  hourLabel: string;
  count: number;
  totalAmount: number;
}

interface ChannelData {
  hourlyStats: HourlyStatItem[];
  total: { count: number; amount: number };
  peak: { label: string; count: number; amount: number };
}

interface GenderStatItem {
  count: number;
  amount: number;
}

interface GenderChannelData {
  male: GenderStatItem;
  female: GenderStatItem;
  unknown: GenderStatItem;
  total: GenderStatItem;
}

interface GenderStats {
  online: GenderChannelData;
  biletarnica: GenderChannelData;
}

interface GenderSummary {
  totalMale: number;
  totalFemale: number;
  totalUnknown: number;
  totalTickets: number;
  maleAmount: number;
  femaleAmount: number;
  unknownAmount: number;
  malePercentage: number;
  femalePercentage: number;
}

// Card Statistics types
interface CardStat {
  name: string;
  count: number;
  amount: number;
  percentage: number;
}

interface HourlySalesChartProps {
  eventId: string;
  currency?: string;
  tickets?: any[]; // Dodato za card statistics
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE CONFIG - direktno čitanje iz QRKarte tabele
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://hvpytasddzeprgqkwlbu.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cHl0YXNkZHplcHJncWt3bGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDMyODQsImV4cCI6MjA4MjE3OTI4NH0.R1wPgBpyO7MHs0YL_pW0XBKkX8QweJ8MuhHUpuDSuKk";

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function supabaseQuery(table: string, params: string = ""): Promise<any[]> {
  const allData: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}&limit=${limit}&offset=${offset}`;
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

const GENDER_COLORS = {
  male: "#3b82f6",
  female: "#ec4899",
  unknown: "#9ca3af",
};

const HourlySalesChart: React.FC<HourlySalesChartProps> = ({ eventId, currency = "EUR", tickets = [] }) => {
  const { user } = useAuth();

  // Check if current user is admin
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Hourly stats state
  const [onlineData, setOnlineData] = useState<ChannelData | null>(null);
  const [biletarnicaData, setBiletarnicaData] = useState<ChannelData | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [groupBy, setGroupBy] = useState<"hour" | "2hours">("hour");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Comparison state
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [period1Range, setPeriod1Range] = useState<DateRange | undefined>(undefined);
  const [period2Range, setPeriod2Range] = useState<DateRange | undefined>(undefined);
  const [period1Data, setPeriod1Data] = useState<{
    online: ChannelData | null;
    biletarnica: ChannelData | null;
    total: number;
  } | null>(null);
  const [period2Data, setPeriod2Data] = useState<{
    online: ChannelData | null;
    biletarnica: ChannelData | null;
    total: number;
  } | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonLoaded, setComparisonLoaded] = useState(false);

  // Gender stats state
  const [genderStats, setGenderStats] = useState<GenderStats | null>(null);
  const [genderSummary, setGenderSummary] = useState<GenderSummary | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"hourly" | "gender" | "cards">("hourly");
  const [cardSubTab, setCardSubTab] = useState<"brand" | "country" | "issuer" | "type">("brand");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [period1PickerOpen, setPeriod1PickerOpen] = useState(false);
  const [period2PickerOpen, setPeriod2PickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"count" | "amount">("count");

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZACIJA TIPOVA KARTICA
  // ═══════════════════════════════════════════════════════════════
  const normalizeCardType = (cardType: string): string => {
    if (!cardType) return "Unknown";

    const upper = cardType.toUpperCase().trim();

    // VISA tipovi
    if (upper.includes("VISA")) {
      if (upper.includes("INFINITE")) return "Visa Infinite";
      if (upper.includes("SIGNATURE")) return "Visa Signature";
      if (upper.includes("PLATINUM")) return "Visa Platinum";
      if (upper.includes("GOLD")) return "Visa Gold";
      if (upper.includes("BUSINESS")) return "Visa Business";
      if (upper.includes("ELECTRON")) return "Visa Electron";
      if (upper.includes("CLASSIC")) return "Visa Classic";
      if (upper.includes("DEBIT")) return "Visa Debit";
      return "Visa";
    }

    // MASTERCARD tipovi
    if (upper.includes("MASTERCARD") || upper.includes("MASTER CARD")) {
      if (upper.includes("WORLD ELITE")) return "MasterCard World Elite";
      if (upper.includes("WORLD")) return "MasterCard World";
      if (upper.includes("PLATINUM") && upper.includes("DEBIT")) return "MasterCard Platinum Debit";
      if (upper.includes("PLATINUM")) return "MasterCard Platinum";
      if (upper.includes("GOLD")) return "MasterCard Gold";
      if (upper.includes("DEBIT")) return "MasterCard Debit";
      if (upper.includes("BUSINESS")) return "MasterCard Business";
      if (upper.includes("STANDARD")) return "MasterCard Standard";
      return "MasterCard";
    }

    // Maestro
    if (upper.includes("MAESTRO")) {
      return "Maestro";
    }

    // American Express
    if (upper.includes("AMEX") || upper.includes("AMERICAN EXPRESS")) {
      if (upper.includes("PLATINUM")) return "Amex Platinum";
      if (upper.includes("GOLD")) return "Amex Gold";
      return "American Express";
    }

    // Diners
    if (upper.includes("DINERS")) {
      return "Diners Club";
    }

    // Title case za nepoznate
    return cardType
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZACIJA IMENA BANAKA - spaja varijante u jedno ime
  // ═══════════════════════════════════════════════════════════════
  const normalizeIssuerName = (issuer: string): string => {
    if (!issuer) return "Unknown";

    // Pretvori u uppercase za poređenje
    const upper = issuer.toUpperCase().trim();

    // AGRESIVNO MAPIRANJE - traži ključne riječi
    // Redoslijed je bitan - specifičniji prvo!

    // CKB - Crnogorska Komercijalna Banka
    if (upper.includes("CRNOGORSKA KOMERCIJALNA") || upper.includes("CKB")) {
      return "CKB";
    }

    // Hipotekarna
    if (upper.includes("HIPOTEKARNA")) {
      return "Hipotekarna Banka";
    }

    // NLB - ali NE NLB Komercijalna (to je druga banka)
    if (upper.includes("NLB KOMERCIJALNA")) {
      return "NLB Komercijalna Banka";
    }
    if (upper.includes("NLB BANKA") && upper.includes("SKOPJE")) {
      return "NLB Banka Skopje";
    }
    if (upper.includes("NLB")) {
      return "NLB Banka";
    }

    // Erste
    if (upper.includes("ERSTE")) {
      return "Erste Bank";
    }

    // Prva Banka CG
    if (upper.includes("PRVA BANKA")) {
      return "Prva Banka CG";
    }

    // Addiko
    if (upper.includes("ADDIKO")) {
      return "Addiko Bank";
    }

    // Lovćen
    if (upper.includes("LOVCEN") || upper.includes("LOVĆEN")) {
      return "Lovćen Banka";
    }

    // Adriatic
    if (upper.includes("ADRIATIC")) {
      return "Adriatic Bank";
    }

    // Intesa - razlikuj Srbija vs Albania
    if (upper.includes("INTESA") && upper.includes("ALBANIA")) {
      return "Intesa Sanpaolo Albania";
    }
    if (upper.includes("INTESA") || upper.includes("BANCA INTESA")) {
      return "Banca Intesa";
    }

    // Raiffeisen
    if (upper.includes("RAIFFEISEN")) {
      return "Raiffeisen Bank";
    }

    // UniCredit
    if (upper.includes("UNICREDIT")) {
      return "UniCredit Bank";
    }

    // OTP
    if (upper.includes("OTP") && upper.includes("SRBIJA")) {
      return "OTP Banka Srbija";
    }
    if (upper.includes("OTP")) {
      return "OTP Banka";
    }

    // Revolut
    if (upper.includes("REVOLUT")) {
      return "Revolut";
    }

    // Yettel
    if (upper.includes("YETTEL")) {
      return "Yettel Bank";
    }

    // UN Federal Credit Union
    if (upper.includes("UNITED NATIONS") || upper.includes("UN FEDERAL")) {
      return "UN Federal Credit Union";
    }

    // Bank of America
    if (upper.includes("BANK OF AMERICA")) {
      return "Bank of America";
    }

    // PSA Payment
    if (upper.includes("PSA PAYMENT")) {
      return "PSA Payment Services";
    }

    // BCEE Luxembourg
    if (upper.includes("BCEE") || upper.includes("CAISSE D'EPARGNE")) {
      return "BCEE Luxembourg";
    }

    // United Bulgarian Bank
    if (upper.includes("BULGARIAN BANK")) {
      return "United Bulgarian Bank";
    }

    // AIK Banka
    if (upper.includes("AGROINDUSTRIJ") || upper.includes("AIK")) {
      return "AIK Banka";
    }

    // Ako nema mapiranja, očisti i vrati
    let cleaned = upper
      .replace(/,?\s*JOINT STOCK COMPANY.*$/i, "")
      .replace(/\s*-\s*FOUNDED IN \d+$/i, "")
      .replace(/\s*-\s*PODGORICA$/i, "")
      .replace(/\s*-\s*BEOGRAD$/i, "")
      .replace(/\s+AD\s+PODGORICA$/i, "")
      .replace(/\s+A\.?D\.?\s*,?\s*PODGORICA$/i, "")
      .replace(/\s+AD\s+BEOGRAD$/i, "")
      .replace(/\s+A\.?D\.?,?\s*BEOGRAD$/i, "")
      .replace(/\s+AD\s+NOVI SAD$/i, "")
      .replace(/\s+D\.?D\.?$/i, "")
      .replace(/\s+AD$/i, "")
      .replace(/\s+A\.D\.?$/i, "")
      .replace(/\s+LTD\.?$/i, "")
      .replace(/\s+PLC\.?$/i, "")
      .replace(/\s+UAB$/i, "")
      .replace(/["']/g, "")
      .trim();

    // Title case
    return cleaned
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // ═══════════════════════════════════════════════════════════════
  // CARD STATISTICS - UNIKATNE TRANSAKCIJE PO SESIJI
  // ═══════════════════════════════════════════════════════════════
  const cardStats = useMemo(() => {
    // Filtriraj samo online karte sa card podacima
    const cardTickets = tickets
      .filter((t: any) => {
        const channel = (t.salesChannel || "").toLowerCase();
        return (channel === "online" || channel === "website") && t.cardBrand;
      })
      .map((t: any) => ({
        ticketId: t.ticketId || "",
        sessionId: t.sessionId || t.orderId || t.transactionId || "", // za unikatne transakcije
        cardBrand: t.cardBrand || "Unknown",
        cardCountry: t.cardCountry || "Unknown",
        cardDescription: t.cardDescription || "Unknown",
        cardIssuer: t.cardIssuer || "Unknown",
        price: Number(t.price) || 0,
        purchaseDate: t.purchaseDate || "",
        customerName: t.customerName || "",
        customerEmail: t.customerEmail || "",
      }));

    // ═══════════════════════════════════════════════════════════════
    // GRUPIŠI PO SESIJI - jedna kupovina = jedna transakcija
    // ═══════════════════════════════════════════════════════════════
    const sessionMap = new Map<
      string,
      {
        sessionId: string;
        cardBrand: string;
        cardCountry: string;
        cardDescription: string;
        cardIssuer: string;
        totalAmount: number;
        ticketCount: number;
        customerName: string;
        customerEmail: string;
        purchaseDate: string;
      }
    >();

    cardTickets.forEach((ticket) => {
      // Ako nema sessionId, koristi kombinaciju email + datum + brand kao fallback
      const sessionKey =
        ticket.sessionId || `${ticket.customerEmail}_${ticket.purchaseDate}_${ticket.cardBrand}_${ticket.cardIssuer}`;

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          sessionId: sessionKey,
          cardBrand: ticket.cardBrand,
          cardCountry: ticket.cardCountry,
          cardDescription: ticket.cardDescription,
          cardIssuer: ticket.cardIssuer,
          totalAmount: 0,
          ticketCount: 0,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          purchaseDate: ticket.purchaseDate,
        });
      }

      const session = sessionMap.get(sessionKey)!;
      session.totalAmount += ticket.price;
      session.ticketCount++;
    });

    const uniqueTransactions = Array.from(sessionMap.values());

    const brandMap = new Map<string, { count: number; amount: number }>();
    const countryMap = new Map<string, { count: number; amount: number }>();
    const issuerMap = new Map<string, { count: number; amount: number }>();
    const descriptionMap = new Map<string, { count: number; amount: number }>();

    let totalTransactions = 0;
    let totalAmount = 0;

    uniqueTransactions.forEach((transaction) => {
      totalTransactions++;
      totalAmount += transaction.totalAmount;

      // Brand
      const brand = transaction.cardBrand.toUpperCase();
      if (!brandMap.has(brand)) brandMap.set(brand, { count: 0, amount: 0 });
      brandMap.get(brand)!.count++;
      brandMap.get(brand)!.amount += transaction.totalAmount;

      // Country
      const country = transaction.cardCountry.toUpperCase();
      if (!countryMap.has(country)) countryMap.set(country, { count: 0, amount: 0 });
      countryMap.get(country)!.count++;
      countryMap.get(country)!.amount += transaction.totalAmount;

      // Issuer - NORMALIZOVANO!
      const issuer = normalizeIssuerName(transaction.cardIssuer);
      if (!issuerMap.has(issuer)) issuerMap.set(issuer, { count: 0, amount: 0 });
      issuerMap.get(issuer)!.count++;
      issuerMap.get(issuer)!.amount += transaction.totalAmount;

      // Description - NORMALIZOVANO!
      const desc = normalizeCardType(transaction.cardDescription);
      if (!descriptionMap.has(desc)) descriptionMap.set(desc, { count: 0, amount: 0 });
      descriptionMap.get(desc)!.count++;
      descriptionMap.get(desc)!.amount += transaction.totalAmount;
    });

    const mapToArray = (map: Map<string, { count: number; amount: number }>): CardStat[] => {
      return Array.from(map.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          amount: data.amount,
          percentage: totalTransactions > 0 ? (data.count / totalTransactions) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      totalCount: totalTransactions, // Broj unikatnih transakcija
      totalAmount,
      totalTickets: cardTickets.length, // Ukupan broj karata
      byBrand: mapToArray(brandMap),
      byCountry: mapToArray(countryMap),
      byIssuer: mapToArray(issuerMap),
      byDescription: mapToArray(descriptionMap),
      tickets: cardTickets, // Za export - sve karte
      transactions: uniqueTransactions, // Unikatne transakcije
    };
  }, [tickets]);

  // ═══════════════════════════════════════════════════════════════
  // CARD HELPERS
  // ═══════════════════════════════════════════════════════════════
  const getBrandColor = (brand: string) => {
    const colors: Record<string, string> = {
      VISA: "bg-blue-500",
      MASTERCARD: "bg-orange-500",
      AMEX: "bg-blue-700",
      DISCOVER: "bg-orange-600",
      DINERS: "bg-gray-600",
    };
    return colors[brand.toUpperCase()] || "bg-gray-500";
  };

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      US: "🇺🇸",
      ME: "🇲🇪",
      RS: "🇷🇸",
      HR: "🇭🇷",
      BA: "🇧🇦",
      SI: "🇸🇮",
      MK: "🇲🇰",
      AL: "🇦🇱",
      DE: "🇩🇪",
      AT: "🇦🇹",
      IT: "🇮🇹",
      GB: "🇬🇧",
      FR: "🇫🇷",
      CH: "🇨🇭",
      NL: "🇳🇱",
      BE: "🇧🇪",
      ES: "🇪🇸",
      PL: "🇵🇱",
      CZ: "🇨🇿",
      SK: "🇸🇰",
      HU: "🇭🇺",
      RO: "🇷🇴",
      BG: "🇧🇬",
      GR: "🇬🇷",
      TR: "🇹🇷",
      RU: "🇷🇺",
      UA: "🇺🇦",
      AU: "🇦🇺",
      CA: "🇨🇦",
    };
    return flags[code.toUpperCase()] || "🏳️";
  };

  const handleExportCardStats = () => {
    const exportData = cardStats.tickets.map((t) => ({
      TicketID: t.ticketId,
      Datum: t.purchaseDate,
      Kupac: t.customerName,
      Email: t.customerEmail,
      CardBrand: t.cardBrand,
      CardCountry: t.cardCountry,
      CardType: t.cardDescription,
      CardIssuer: t.cardIssuer,
      Iznos: t.price,
    }));

    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers
          .map((h) => {
            const val = (row as any)[h];
            return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `card-stats-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Izračunaj hourly statistiku iz niza tiketa
  // ═══════════════════════════════════════════════════════════════
  const computeChannelData = (tickets: any[]): ChannelData | null => {
    if (!tickets.length) return null;

    const hourMap = new Map<number, { count: number; totalAmount: number }>();

    // Inicijalizuj sve sate
    const totalHours = groupBy === "2hours" ? 12 : 24;
    const step = groupBy === "2hours" ? 2 : 1;
    for (let h = 0; h < 24; h += step) {
      hourMap.set(h, { count: 0, totalAmount: 0 });
    }

    tickets.forEach((t: any) => {
      const timeStr = t.purchaseTime || "";
      let hour = 0;
      if (timeStr) {
        const parts = timeStr.split(":");
        hour = parseInt(parts[0]) || 0;
      }
      if (groupBy === "2hours") {
        hour = Math.floor(hour / 2) * 2;
      }
      const entry = hourMap.get(hour) || { count: 0, totalAmount: 0 };
      entry.count++;
      entry.totalAmount += parseFloat(t.price || "0");
      hourMap.set(hour, entry);
    });

    const hourlyStats: HourlyStatItem[] = [];
    let peakHour = { label: "N/A", count: 0, amount: 0 };
    let totalCount = 0;
    let totalAmount = 0;

    for (let h = 0; h < 24; h += step) {
      const entry = hourMap.get(h) || { count: 0, totalAmount: 0 };
      const endH = groupBy === "2hours" ? h + 2 : h + 1;
      const label = `${String(h).padStart(2, "0")}:00 - ${String(endH).padStart(2, "0")}:00`;

      hourlyStats.push({
        hour: h,
        hourLabel: label,
        count: entry.count,
        totalAmount: entry.totalAmount,
      });

      totalCount += entry.count;
      totalAmount += entry.totalAmount;

      if (entry.count > peakHour.count) {
        peakHour = { label, count: entry.count, amount: entry.totalAmount };
      }
    }

    return {
      hourlyStats,
      total: { count: totalCount, amount: totalAmount },
      peak: peakHour,
    };
  };

  const fetchHourlyStats = async (
    range?: DateRange,
  ): Promise<{ online: ChannelData | null; biletarnica: ChannelData | null; total: number }> => {
    if (!eventId) return { online: null, biletarnica: null, total: 0 };

    try {
      // Građenje query parametara za Supabase
      let params = `eventId=eq.${eventId}&select=purchaseTime,salesChannel,price,Purchasedate,Hide,manualHide,status`;

      // Datumski filteri se primjenjuju lokalno jer Supabase OR sa nepostojećim
      // poljima daje 400 error - sve podatke učitamo pa filtriramo client-side

      const allTickets = await supabaseQuery("QRKarte", params);

      // Filtriraj vidljive karte (isto kao dashboardApi)
      const visibleTickets = allTickets.filter((t: any) => {
        if (t.Hide === true || t.Hide === "true") return false;
        if (t.manualHide === true || t.manualHide === "true") return false;
        if (t.status === "refunded") return false;
        const channel = (t.salesChannel || "").toLowerCase();
        if (channel === "rezervacija" || channel.includes("bukiranje")) return false;
        return true;
      });

      // Filtriraj po datumu lokalno (jer OR filteri mogu biti kompleksni)
      const dateFiltered = visibleTickets.filter((t: any) => {
        const ticketDate = t.Purchasedate || "";
        if (!ticketDate) return true; // zadrži ako nema datuma
        if (range?.from) {
          const startDate = format(range.from, "yyyy-MM-dd");
          if (ticketDate < startDate) return false;
        }
        if (range?.to) {
          const endDate = format(range.to, "yyyy-MM-dd");
          if (ticketDate > endDate) return false;
        }
        return true;
      });

      // Razdvoji na online i biletarnica kanale
      const onlineTickets = dateFiltered.filter((t: any) => {
        const ch = (t.salesChannel || "").toLowerCase();
        return ch === "online" || ch === "website" || ch === "";
      });

      const biletarnicaTickets = dateFiltered.filter((t: any) => {
        const ch = (t.salesChannel || "").toLowerCase();
        return ch.includes("gotovina") || ch.includes("biletarnica") || ch.includes("kartica");
      });

      return {
        online: computeChannelData(onlineTickets),
        biletarnica: computeChannelData(biletarnicaTickets),
        total: dateFiltered.length,
      };
    } catch (err) {
      console.error("Hourly stats error:", err);
    }
    return { online: null, biletarnica: null, total: 0 };
  };

  const fetchGenderStats = async () => {
    if (!eventId) return;

    try {
      const params = `eventId=eq.${eventId}&select=salesChannel,price,customerGender,customerName,Hide,manualHide,status`;
      const allTickets = await supabaseQuery("QRKarte", params);

      // Filtriraj vidljive
      const visibleTickets = allTickets.filter((t: any) => {
        if (t.Hide === true || t.Hide === "true") return false;
        if (t.manualHide === true || t.manualHide === "true") return false;
        if (t.status === "refunded") return false;
        const channel = (t.salesChannel || "").toLowerCase();
        if (channel === "rezervacija" || channel.includes("bukiranje")) return false;
        return true;
      });

      // Funkcija za određivanje pola - koristi customerGender polje iz QRKarte
      // Vrijednosti u bazi: "M" = muško, "Z" = žensko
      const detectGender = (ticket: any): "male" | "female" | "unknown" => {
        const g = (ticket.customerGender || "").toUpperCase().trim();
        if (g === "M" || g === "MALE" || g === "MUŠKO" || g === "MUSKI") return "male";
        if (g === "Z" || g === "F" || g === "FEMALE" || g === "ŽENSKO" || g === "ZENSKO" || g === "ŽENSKI") return "female";
        return "unknown";
      };

      const createEmptyGenderChannel = (): GenderChannelData => ({
        male: { count: 0, amount: 0 },
        female: { count: 0, amount: 0 },
        unknown: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 },
      });

      const onlineGender = createEmptyGenderChannel();
      const biletarnicaGender = createEmptyGenderChannel();

      let totalMale = 0, totalFemale = 0, totalUnknown = 0;
      let maleAmount = 0, femaleAmount = 0, unknownAmount = 0;

      visibleTickets.forEach((t: any) => {
        const ch = (t.salesChannel || "").toLowerCase();
        const isOnline = ch === "online" || ch === "website" || ch === "";
        const gender = detectGender(t);
        const price = parseFloat(t.price || "0");

        const channelData = isOnline ? onlineGender : biletarnicaGender;

        channelData[gender].count++;
        channelData[gender].amount += price;
        channelData.total.count++;
        channelData.total.amount += price;

        if (gender === "male") { totalMale++; maleAmount += price; }
        else if (gender === "female") { totalFemale++; femaleAmount += price; }
        else { totalUnknown++; unknownAmount += price; }
      });

      const totalTickets = totalMale + totalFemale + totalUnknown;
      const knownTotal = totalMale + totalFemale;

      setGenderStats({
        online: onlineGender,
        biletarnica: biletarnicaGender,
      });

      setGenderSummary({
        totalMale,
        totalFemale,
        totalUnknown,
        totalTickets,
        maleAmount,
        femaleAmount,
        unknownAmount,
        malePercentage: knownTotal > 0 ? Math.round((totalMale / knownTotal) * 100) : 0,
        femalePercentage: knownTotal > 0 ? Math.round((totalFemale / knownTotal) * 100) : 0,
      });
    } catch (err) {
      console.error("Gender stats error:", err);
    }
  };

  const fetchMainData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [hourlyResult] = await Promise.all([fetchHourlyStats(dateRange), fetchGenderStats()]);

      setOnlineData(hourlyResult.online);
      setBiletarnicaData(hourlyResult.biletarnica);
      setTotalTickets(hourlyResult.total);
    } catch (err) {
      setError("Greška pri učitavanju podataka");
    } finally {
      setLoading(false);
    }
  };

  const runComparison = async () => {
    if (!period1Range?.from || !period2Range?.from) return;

    setComparisonLoading(true);
    setComparisonLoaded(false);

    try {
      const [p1Result, p2Result] = await Promise.all([fetchHourlyStats(period1Range), fetchHourlyStats(period2Range)]);

      setPeriod1Data(p1Result);
      setPeriod2Data(p2Result);
      setComparisonLoaded(true);
    } catch (err) {
      console.error("Comparison error:", err);
    } finally {
      setComparisonLoading(false);
    }
  };

  const resetComparison = () => {
    setComparisonLoaded(false);
    setPeriod1Data(null);
    setPeriod2Data(null);
  };

  useEffect(() => {
    if (eventId) {
      fetchMainData();
    }
  }, [eventId, groupBy, dateRange]);

  useEffect(() => {
    resetComparison();
  }, [period1Range, period2Range]);

  const formatCurrency = (amount: number) => {
    return (
      new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount) +
      " " +
      currency
    );
  };

  const formatDateLabel = (range: DateRange | undefined) => {
    if (!range?.from) return "Nije izabrano";
    if (range.to && range.from.getTime() !== range.to.getTime()) {
      return `${format(range.from, "dd.MM.yyyy")} - ${format(range.to, "dd.MM.yyyy")}`;
    }
    return format(range.from, "dd.MM.yyyy");
  };

  const formatHourLabel = (label: string) => {
    return label.split(":")[0];
  };

  const prepareChartData = (stats: HourlyStatItem[]) => {
    return stats.map((item) => ({
      name: formatHourLabel(item.hourLabel),
      fullLabel: item.hourLabel,
      value: viewMode === "count" ? item.count : item.totalAmount,
      count: item.count,
      amount: item.totalAmount,
    }));
  };

  const prepareGenderPieData = (channelData: GenderChannelData) => {
    const data = [
      {
        name: "Muškarci",
        value: viewMode === "count" ? channelData.male.count : channelData.male.amount,
        color: GENDER_COLORS.male,
      },
      {
        name: "Žene",
        value: viewMode === "count" ? channelData.female.count : channelData.female.amount,
        color: GENDER_COLORS.female,
      },
      {
        name: "Nepoznato",
        value: viewMode === "count" ? channelData.unknown.count : channelData.unknown.amount,
        color: GENDER_COLORS.unknown,
      },
    ];
    return data.filter((d) => d.value > 0);
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{data.fullLabel || data.name}</p>
          {data.count !== undefined && (
            <p className="text-sm text-gray-600">
              Karte: <span className="font-medium">{data.count}</span>
            </p>
          )}
          {data.amount !== undefined && (
            <p className="text-sm text-gray-600">
              Prihod: <span className="font-medium">{formatCurrency(data.amount)}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // ═══════════════════════════════════════════════════════════════
  // HOURLY CHART COMPONENT
  // ═══════════════════════════════════════════════════════════════
  const HourlyChannelChart = ({
    title,
    icon: Icon,
    color,
    data,
    bgColor,
  }: {
    title: string;
    icon: React.ElementType;
    color: string;
    data: ChannelData | null;
    bgColor: string;
  }) => {
    if (!data || data.total.count === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="h-5 w-5" style={{ color }} />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-400 py-8">Nema podataka sa vremenom kupovine</div>
          </CardContent>
        </Card>
      );
    }

    const chartData = prepareChartData(data.hourlyStats);

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5" style={{ color }} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg p-3" style={{ backgroundColor: bgColor }}>
              <p className="text-xs text-gray-500 uppercase">Ukupno karata</p>
              <p className="text-2xl font-bold" style={{ color }}>
                {data.total.count}
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: bgColor }}>
              <p className="text-xs text-gray-500 uppercase">Ukupan prihod</p>
              <p className="text-xl font-bold" style={{ color }}>
                {formatCurrency(data.total.amount)}
              </p>
            </div>
          </div>

          {data.peak.label !== "N/A" && (
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg" style={{ backgroundColor: bgColor }}>
              <TrendingUp className="h-4 w-4" style={{ color }} />
              <span className="text-sm">
                <strong>Peak:</strong> {data.peak.label} ({data.peak.count} karata, {formatCurrency(data.peak.amount)})
              </span>
            </div>
          )}

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={groupBy === "2hours" ? 0 : "preserveStartEnd"}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // GENDER CHART COMPONENT
  // ═══════════════════════════════════════════════════════════════
  const GenderChannelChart = ({
    title,
    icon: Icon,
    data,
    accentColor,
    bgColor,
  }: {
    title: string;
    icon: React.ElementType;
    data: GenderChannelData | null;
    accentColor: string;
    bgColor: string;
  }) => {
    if (!data || data.total.count === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="h-5 w-5" style={{ color: accentColor }} />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-400 py-8">Nema podataka</div>
          </CardContent>
        </Card>
      );
    }

    const pieData = prepareGenderPieData(data);
    const knownCount = data.male.count + data.female.count;
    const malePercent = knownCount > 0 ? Math.round((data.male.count / knownCount) * 100) : 0;
    const femalePercent = knownCount > 0 ? Math.round((data.female.count / knownCount) * 100) : 0;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5" style={{ color: accentColor }} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg p-3 bg-blue-50 text-center">
              <p className="text-xs text-gray-500 uppercase">Muškarci</p>
              <p className="text-xl font-bold text-blue-600">{data.male.count}</p>
              <p className="text-xs text-gray-500">{malePercent}%</p>
            </div>
            <div className="rounded-lg p-3 bg-pink-50 text-center">
              <p className="text-xs text-gray-500 uppercase">Žene</p>
              <p className="text-xl font-bold text-pink-500">{data.female.count}</p>
              <p className="text-xs text-gray-500">{femalePercent}%</p>
            </div>
            <div className="rounded-lg p-3 bg-gray-100 text-center">
              <p className="text-xs text-gray-500 uppercase">Nepoznato</p>
              <p className="text-xl font-bold text-gray-500">{data.unknown.count}</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-xs text-gray-500">M prihod</p>
              <p className="text-sm font-semibold text-blue-600">{formatCurrency(data.male.amount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Ž prihod</p>
              <p className="text-sm font-semibold text-pink-500">{formatCurrency(data.female.amount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">? prihod</p>
              <p className="text-sm font-semibold text-gray-500">{formatCurrency(data.unknown.amount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // GENDER SUMMARY CARD
  // ═══════════════════════════════════════════════════════════════
  const GenderSummaryCard = () => {
    if (!genderSummary) return null;

    return (
      <Card className="bg-gradient-to-r from-blue-50 to-pink-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Ukupna statistika po polu</p>
                <p className="text-2xl font-bold">
                  <span className="text-blue-600">{genderSummary.malePercentage}% M</span>
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-pink-500">{genderSummary.femalePercentage}% Ž</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Poznati pol</p>
              <p className="text-lg font-semibold">
                {genderSummary.totalMale + genderSummary.totalFemale} / {genderSummary.totalTickets}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // CARD STATS LIST COMPONENT - MOBILE OPTIMIZED
  // ═══════════════════════════════════════════════════════════════
  const CardStatsList = ({ items, type }: { items: CardStat[]; type: "brand" | "country" | "issuer" | "type" }) => (
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <div
          key={item.name}
          className="flex items-center gap-2 p-2 md:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {/* Rank */}
          <span className="text-sm md:text-lg font-bold text-gray-400 w-5 md:w-6 flex-shrink-0">{index + 1}</span>

          {/* Icon/Badge */}
          <div className="flex-shrink-0">
            {type === "brand" && (
              <div
                className={`w-8 md:w-10 h-5 md:h-6 rounded ${getBrandColor(item.name)} flex items-center justify-center`}
              >
                <span className="text-white text-[10px] md:text-xs font-bold">{item.name.substring(0, 4)}</span>
              </div>
            )}
            {type === "country" && <span className="text-xl md:text-2xl">{getCountryFlag(item.name)}</span>}
            {type === "issuer" && <Building2 className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />}
            {type === "type" && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />}
          </div>

          {/* Name & Count */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm md:text-base truncate">{item.name}</p>
            <p className="text-[10px] md:text-xs text-gray-500">{item.count} trans.</p>
          </div>

          {/* Amount & Percentage */}
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-gray-900 text-sm md:text-base">{formatCurrency(item.amount)}</p>
            <p className="text-[10px] md:text-xs text-gray-500">{item.percentage.toFixed(1)}%</p>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-center text-gray-500 py-4">Nema podataka</p>}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // COMPARISON TABLE
  // ═══════════════════════════════════════════════════════════════
  const ComparisonResultsTable = () => {
    if (!period1Data || !period2Data) return null;

    const p1Label = formatDateLabel(period1Range);
    const p2Label = formatDateLabel(period2Range);

    const p1OnlineCount = period1Data.online?.total.count || 0;
    const p1OnlineAmount = period1Data.online?.total.amount || 0;
    const p1BiletarnicaCount = period1Data.biletarnica?.total.count || 0;
    const p1BiletarnicaAmount = period1Data.biletarnica?.total.amount || 0;
    const p1TotalCount = p1OnlineCount + p1BiletarnicaCount;
    const p1TotalAmount = p1OnlineAmount + p1BiletarnicaAmount;

    const p2OnlineCount = period2Data.online?.total.count || 0;
    const p2OnlineAmount = period2Data.online?.total.amount || 0;
    const p2BiletarnicaCount = period2Data.biletarnica?.total.count || 0;
    const p2BiletarnicaAmount = period2Data.biletarnica?.total.amount || 0;
    const p2TotalCount = p2OnlineCount + p2BiletarnicaCount;
    const p2TotalAmount = p2OnlineAmount + p2BiletarnicaAmount;

    const calculateDiff = (val1: number, val2: number) => {
      if (val2 === 0) return val1 > 0 ? 100 : 0;
      return ((val1 - val2) / val2) * 100;
    };

    const getWinner = (val1: number, val2: number): 1 | 2 | 0 => {
      if (val1 > val2) return 1;
      if (val2 > val1) return 2;
      return 0;
    };

    const DiffCell = ({ val1, val2, isAmount = false }: { val1: number; val2: number; isAmount?: boolean }) => {
      const diff = val1 - val2;
      const percent = calculateDiff(val1, val2);
      if (diff === 0)
        return (
          <div className="text-center text-gray-500">
            <Minus className="h-4 w-4 inline" />
            <span className="ml-1">0</span>
          </div>
        );
      const isPositive = diff > 0;
      return (
        <div className={cn("text-center font-medium", isPositive ? "text-green-600" : "text-red-600")}>
          <div className="flex items-center justify-center gap-1">
            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            <span>
              {isPositive ? "+" : ""}
              {isAmount ? formatCurrency(diff) : diff}
            </span>
          </div>
          <div className="text-xs opacity-75">
            ({isPositive ? "+" : ""}
            {percent.toFixed(1)}%)
          </div>
        </div>
      );
    };

    const WinnerBadge = ({ winner }: { winner: 1 | 2 | 0 }) => {
      if (winner === 0) return <Badge variant="secondary">Izjednačeno</Badge>;
      return (
        <Badge
          className={cn("gap-1", winner === 1 ? "bg-blue-500 hover:bg-blue-600" : "bg-purple-500 hover:bg-purple-600")}
        >
          <Trophy className="h-3 w-3" />
          Period {winner}
        </Badge>
      );
    };

    const rows = [
      {
        label: "Online karte",
        icon: ShoppingCart,
        iconColor: "text-indigo-500",
        p1: p1OnlineCount,
        p2: p2OnlineCount,
        isAmount: false,
      },
      {
        label: "Online prihod",
        icon: ShoppingCart,
        iconColor: "text-indigo-500",
        p1: p1OnlineAmount,
        p2: p2OnlineAmount,
        isAmount: true,
      },
      {
        label: "Biletarnica karte",
        icon: Store,
        iconColor: "text-pink-500",
        p1: p1BiletarnicaCount,
        p2: p2BiletarnicaCount,
        isAmount: false,
      },
      {
        label: "Biletarnica prihod",
        icon: Store,
        iconColor: "text-pink-500",
        p1: p1BiletarnicaAmount,
        p2: p2BiletarnicaAmount,
        isAmount: true,
      },
    ];

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="h-5 w-5 text-primary" />
            Rezultati poređenja
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-blue-50 border-2 border-blue-200">
              <div className="text-xs text-blue-600 font-medium uppercase">Period 1</div>
              <div className="text-lg font-bold text-blue-800">{p1Label}</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border-2 border-purple-200">
              <div className="text-xs text-purple-600 font-medium uppercase">Period 2</div>
              <div className="text-lg font-bold text-purple-800">{p2Label}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Metrika</TableHead>
                  <TableHead className="text-center bg-blue-50">Period 1</TableHead>
                  <TableHead className="text-center bg-purple-50">Period 2</TableHead>
                  <TableHead className="text-center">Razlika</TableHead>
                  <TableHead className="text-center">Bolji</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <row.icon className={cn("h-4 w-4", row.iconColor)} />
                        {row.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold bg-blue-50/50">
                      {row.isAmount ? formatCurrency(row.p1) : row.p1}
                    </TableCell>
                    <TableCell className="text-center font-semibold bg-purple-50/50">
                      {row.isAmount ? formatCurrency(row.p2) : row.p2}
                    </TableCell>
                    <TableCell>
                      <DiffCell val1={row.p1} val2={row.p2} isAmount={row.isAmount} />
                    </TableCell>
                    <TableCell className="text-center">
                      <WinnerBadge winner={getWinner(row.p1, row.p2)} />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-100 font-bold border-t-2">
                  <TableCell className="font-bold text-lg">UKUPNO KARTE</TableCell>
                  <TableCell className="text-center font-bold text-xl bg-blue-100">{p1TotalCount}</TableCell>
                  <TableCell className="text-center font-bold text-xl bg-purple-100">{p2TotalCount}</TableCell>
                  <TableCell>
                    <DiffCell val1={p1TotalCount} val2={p2TotalCount} />
                  </TableCell>
                  <TableCell className="text-center">
                    <WinnerBadge winner={getWinner(p1TotalCount, p2TotalCount)} />
                  </TableCell>
                </TableRow>
                <TableRow className="bg-gray-100 font-bold">
                  <TableCell className="font-bold text-lg">UKUPNO PRIHOD</TableCell>
                  <TableCell className="text-center font-bold text-lg bg-blue-100">
                    {formatCurrency(p1TotalAmount)}
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg bg-purple-100">
                    {formatCurrency(p2TotalAmount)}
                  </TableCell>
                  <TableCell>
                    <DiffCell val1={p1TotalAmount} val2={p2TotalAmount} isAmount />
                  </TableCell>
                  <TableCell className="text-center">
                    <WinnerBadge winner={getWinner(p1TotalAmount, p2TotalAmount)} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════
  if (!eventId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">Izaberite događaj za prikaz analize</CardContent>
      </Card>
    );
  }

  const canRunComparison = period1Range?.from && period2Range?.from;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border overflow-hidden mr-4">
                <Button
                  variant={activeTab === "hourly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("hourly")}
                  className="rounded-none gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Po satima
                </Button>
                <Button
                  variant={activeTab === "gender" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("gender")}
                  className="rounded-none gap-2"
                >
                  <Users className="h-4 w-4" />
                  Po polu
                </Button>
                {/* ADMIN ONLY - Cards Tab */}
                {isAdmin && (
                  <Button
                    variant={activeTab === "cards" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("cards")}
                    className="rounded-none gap-2 border-l border-red-300"
                  >
                    <CreditCard className="h-4 w-4" />
                    Cards
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">
                      ADMIN
                    </Badge>
                  </Button>
                )}
              </div>
              {totalTickets > 0 && <span className="text-sm text-gray-500">({totalTickets} karata ukupno)</span>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={fetchMainData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>

              {activeTab === "hourly" && (
                <div className="flex rounded-lg border overflow-hidden">
                  <Button
                    variant={groupBy === "hour" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGroupBy("hour")}
                    className="rounded-none"
                  >
                    1h
                  </Button>
                  <Button
                    variant={groupBy === "2hours" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGroupBy("2hours")}
                    className="rounded-none"
                  >
                    2h
                  </Button>
                </div>
              )}

              {activeTab !== "cards" && (
                <div className="flex rounded-lg border overflow-hidden">
                  <Button
                    variant={viewMode === "count" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("count")}
                    className="rounded-none"
                  >
                    Karte
                  </Button>
                  <Button
                    variant={viewMode === "amount" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("amount")}
                    className="rounded-none"
                  >
                    Prihod
                  </Button>
                </div>
              )}

              {/* Export button for Cards tab */}
              {activeTab === "cards" && cardStats.totalCount > 0 && (
                <Button variant="default" size="sm" onClick={handleExportCardStats} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center h-48 text-red-500">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchMainData} className="mt-4">
                Pokušaj ponovo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* HOURLY TAB */}
          {activeTab === "hourly" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Filter:</span>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-start text-left font-normal h-8",
                            !dateRange && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? formatDateLabel(dateRange) : <span>Svi podaci</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    {dateRange && (
                      <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} className="h-8 px-2">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <HourlyChannelChart
                  title="Online prodaja"
                  icon={ShoppingCart}
                  color="#6366f1"
                  bgColor="#eef2ff"
                  data={onlineData}
                />
                <HourlyChannelChart
                  title="Biletarnica (Gotovina + Kartica)"
                  icon={Store}
                  color="#ec4899"
                  bgColor="#fdf2f8"
                  data={biletarnicaData}
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GitCompare className="h-5 w-5" />
                    Uporedi periode
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-500">Period 1</Badge>
                      </div>
                      <Popover open={period1PickerOpen} onOpenChange={setPeriod1PickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !period1Range && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {period1Range?.from ? formatDateLabel(period1Range) : <span>Izaberi datum...</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={period1Range?.from}
                            selected={period1Range}
                            onSelect={setPeriod1Range}
                            numberOfMonths={2}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      {period1Range && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPeriod1Range(undefined)}
                          className="mt-2 h-8 px-2"
                        >
                          <X className="h-4 w-4 mr-1" /> Poništi
                        </Button>
                      )}
                    </div>
                    <div className="p-3 rounded-lg border-2 border-purple-200 bg-purple-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-purple-500">Period 2</Badge>
                      </div>
                      <Popover open={period2PickerOpen} onOpenChange={setPeriod2PickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !period2Range && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {period2Range?.from ? formatDateLabel(period2Range) : <span>Izaberi datum...</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={period2Range?.from}
                            selected={period2Range}
                            onSelect={setPeriod2Range}
                            numberOfMonths={2}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      {period2Range && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPeriod2Range(undefined)}
                          className="mt-2 h-8 px-2"
                        >
                          <X className="h-4 w-4 mr-1" /> Poništi
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      onClick={runComparison}
                      disabled={!canRunComparison || comparisonLoading}
                      className="gap-2"
                      size="lg"
                    >
                      {comparisonLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {comparisonLoading ? "Učitavanje..." : "Uporedi periode"}
                    </Button>
                  </div>
                  {!canRunComparison && (
                    <p className="text-center text-sm text-muted-foreground">Izaberite oba perioda za poređenje</p>
                  )}
                </CardContent>
              </Card>

              {comparisonLoaded && <ComparisonResultsTable />}
            </div>
          )}

          {/* GENDER TAB */}
          {activeTab === "gender" && (
            <div className="space-y-4">
              <GenderSummaryCard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GenderChannelChart
                  title="Online prodaja"
                  icon={ShoppingCart}
                  accentColor="#6366f1"
                  bgColor="#eef2ff"
                  data={genderStats?.online || null}
                />
                <GenderChannelChart
                  title="Biletarnica"
                  icon={Store}
                  accentColor="#ec4899"
                  bgColor="#fdf2f8"
                  data={genderStats?.biletarnica || null}
                />
              </div>
            </div>
          )}

          {/* CARDS TAB - ADMIN ONLY */}
          {activeTab === "cards" && isAdmin && (
            <div className="space-y-3 md:space-y-4">
              {/* Summary Cards - 2x2 grid na mobilnom */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <Card className="bg-white border-l-4 border-l-blue-500">
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-center gap-1.5 text-gray-600 mb-0.5">
                      <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="text-[10px] md:text-xs font-medium">Transakcije</span>
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{cardStats.totalCount}</p>
                    <p className="text-[10px] text-gray-500">{cardStats.totalTickets} karata</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-emerald-500">
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-center gap-1.5 text-gray-600 mb-0.5">
                      <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="text-[10px] md:text-xs font-medium">Promet</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold text-gray-900">
                      {formatCurrency(cardStats.totalAmount)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-purple-500">
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-center gap-1.5 text-gray-600 mb-0.5">
                      <Globe className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="text-[10px] md:text-xs font-medium">Država</span>
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{cardStats.byCountry.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-orange-500">
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-center gap-1.5 text-gray-600 mb-0.5">
                      <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="text-[10px] md:text-xs font-medium">Banaka</span>
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{cardStats.byIssuer.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Sub-tabs - scrollable na mobilnom */}
              <Card>
                <CardHeader className="pb-2 px-3 md:px-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                      Statistika
                    </CardTitle>
                    {/* Scrollable tabs na mobilnom */}
                    <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
                      <div className="flex rounded-lg border overflow-hidden w-max md:w-auto">
                        <Button
                          variant={cardSubTab === "brand" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCardSubTab("brand")}
                          className="rounded-none text-xs px-3 md:px-4 h-8"
                        >
                          Brand
                        </Button>
                        <Button
                          variant={cardSubTab === "country" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCardSubTab("country")}
                          className="rounded-none text-xs px-3 md:px-4 h-8"
                        >
                          Država
                        </Button>
                        <Button
                          variant={cardSubTab === "issuer" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCardSubTab("issuer")}
                          className="rounded-none text-xs px-3 md:px-4 h-8"
                        >
                          Banka
                        </Button>
                        <Button
                          variant={cardSubTab === "type" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCardSubTab("type")}
                          className="rounded-none text-xs px-3 md:px-4 h-8"
                        >
                          Tip
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 md:px-6">
                  {cardSubTab === "brand" && <CardStatsList items={cardStats.byBrand} type="brand" />}
                  {cardSubTab === "country" && <CardStatsList items={cardStats.byCountry} type="country" />}
                  {cardSubTab === "issuer" && <CardStatsList items={cardStats.byIssuer} type="issuer" />}
                  {cardSubTab === "type" && <CardStatsList items={cardStats.byDescription} type="type" />}
                </CardContent>
              </Card>

              {/* Top 5 Quick View - stack na mobilnom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white">
                  <CardHeader className="pb-1 md:pb-2 px-3 md:px-6">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-blue-600" />
                      Top 5 Brandova
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 md:space-y-2 px-3 md:px-6">
                    {cardStats.byBrand.slice(0, 5).map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                          <div
                            className={`w-7 h-4 md:w-8 md:h-5 rounded ${getBrandColor(item.name)} flex items-center justify-center`}
                          >
                            <span className="text-white text-[8px] md:text-[10px] font-bold">
                              {item.name.substring(0, 4)}
                            </span>
                          </div>
                          <span className="text-xs md:text-sm font-medium">{item.name}</span>
                        </div>
                        <span className="text-xs md:text-sm font-bold">{item.percentage.toFixed(0)}%</span>
                      </div>
                    ))}
                    {cardStats.byBrand.length === 0 && (
                      <p className="text-center text-gray-500 py-2 text-sm">Nema podataka</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader className="pb-1 md:pb-2 px-3 md:px-6">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      Top 5 Država
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 md:space-y-2 px-3 md:px-6">
                    {cardStats.byCountry.slice(0, 5).map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                          <span className="text-base md:text-lg">{getCountryFlag(item.name)}</span>
                          <span className="text-xs md:text-sm font-medium">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs md:text-sm font-bold">{formatCurrency(item.amount)}</span>
                          <span className="text-[10px] md:text-xs text-gray-500 ml-1">
                            ({item.percentage.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                    {cardStats.byCountry.length === 0 && (
                      <p className="text-center text-gray-500 py-2 text-sm">Nema podataka</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HourlySalesChart;
