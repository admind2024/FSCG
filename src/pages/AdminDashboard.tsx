// src/pages/AdminDashboard.tsx
// ADMIN ZBIRNI IZVJEŠTAJ - KOMPAKTAN DIZAJN ZA MOBILE + CARD STATISTICS

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/DashboardContext";
import {
  BarChart3,
  TrendingUp,
  Ticket,
  Euro,
  EyeOff,
  FileCheck,
  FileX,
  Download,
  RefreshCw,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  Gift,
  CreditCard,
  Building2,
  Banknote,
  Globe,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Menu,
  X,
  Receipt,
  Wallet,
  PiggyBank,
  Info,
  Trophy,
} from "lucide-react";

const ADMIN_EMAIL = "rade.milosevic87@gmail.com";
const SUPABASE_URL = "https://hvpytasddzeprgqkwlbu.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cHl0YXNkZHplcHJncWt3bGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDMyODQsImV4cCI6MjA4MjE3OTI4NH0.R1wPgBpyO7MHs0YL_pW0XBKkX8QweJ8MuhHUpuDSuKk";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const CUSTOMER_SERVICE_FEE_PERCENT = 5;
const BANK_FEE_PERCENT = 3.25;

interface Deduction {
  id: string;
  name: string;
  amount: number;
}

interface EventSummary {
  eventId: string;
  eventName: string;
  venue: string;
  date: string;
  currency: string;
  paidTickets: number;
  gratisTickets: number;
  hiddenTickets: number;
  totalRevenue: number;
  eticketsFee: number;
  forPayout: number;
  finalPayout: number;
  deductions: Deduction[];
  totalDeductions: number;
  fiscalized: number;
  notFiscalized: number;
  fiscalizedValue: number;
  notFiscalizedValue: number;
  onlineCount: number;
  onlineAmount: number;
  biletarnicaCount: number;
  biletarnicaAmount: number;
  virmanCount: number;
  virmanAmount: number;
  karticaCount: number;
  karticaAmount: number;
  serviceFeePercentage: number;
  biletarnicaFee: number;
  virmanFee: number;
  pdvPercentage: number;
  hiddenValue: number;
  isPast: boolean;
  onlineTurnover: number;
  customerServiceFee: number;
  totalCharged: number;
  bankFee: number;
  afterBank: number;
  serviceFeeAfterBank: number;
  netProfit: number;
}

interface AdminTotals {
  totalEvents: number;
  activeEvents: number;
  totalPaid: number;
  totalGratis: number;
  totalHidden: number;
  totalRevenue: number;
  totalEticketsFee: number;
  totalForPayout: number;
  totalDeductions: number;
  totalFinalPayout: number;
  totalFiscalized: number;
  totalNotFiscalized: number;
  totalFiscalizedValue: number;
  totalNotFiscalizedValue: number;
  totalHiddenValue: number;
  onlineTurnover: number;
  customerServiceFee: number;
  totalCharged: number;
  bankFee: number;
  afterBank: number;
  serviceFeeAfterBank: number;
  netProfit: number;
}

// Card Statistics types
interface CardStat {
  name: string;
  count: number;
  amount: number;
  percentage: number;
}

interface CardStatistics {
  totalCount: number;
  totalAmount: number;
  totalTickets: number;
  byBrand: CardStat[];
  byCountry: CardStat[];
  byIssuer: CardStat[];
  byType: CardStat[];
}

async function supabaseQuery(table: string, params: string = ""): Promise<any[]> {
  const allData: any[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&limit=1000&offset=${offset}`, { headers });
    if (!res.ok) throw new Error(`Query failed`);
    const data = await res.json();
    allData.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return allData;
}

async function fetchDeductions(eventId: string): Promise<Deduction[]> {
  try {
    const data = await supabaseQuery("EventDeductions", `eventId=eq.${encodeURIComponent(eventId)}&limit=1`);
    if (!data.length || !data[0].deductions) return [];
    const parsed = typeof data[0].deductions === "string" ? JSON.parse(data[0].deductions) : data[0].deductions;
    return Array.isArray(parsed)
      ? parsed
          .filter((d: any) => d.amount > 0)
          .map((d: any, i: number) => ({
            id: `${eventId}-${i}`,
            name: d.name || "Odbitak",
            amount: parseFloat(d.amount) || 0,
          }))
      : [];
  } catch {
    return [];
  }
}

function normalizeSalesChannel(ch: string | null): string {
  if (!ch) return "Online";
  const c = ch.trim().toLowerCase();
  if (c.includes("gotovina") || c.includes("biletarnica")) return "Biletarnica";
  if (c.includes("virman") || c.includes("bank") || c.includes("transfer")) return "Virman";
  if (c.includes("kartica")) return "Online-Kartica";
  if (c === "savez") return "Savez";
  if (c === "igraci") return "Igraci";
  return "Online";
}

function isHidden(t: any): boolean {
  return t.Hide === true || t.manualHide === true || t.Hide === "true" || t.manualHide === "true";
}
function isReservation(t: any): boolean {
  const c = (t.salesChannel || "").toLowerCase();
  return c === "rezervacija" || c.includes("bukiranje");
}
function isExcludedChannel(t: any): boolean {
  const c = (t.salesChannel || "").toLowerCase();
  return c === "savez" || c === "igraci";
}
function formatCurrency(a: number, c: string = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: c }).format(a);
}
function parseDate(d: string): Date | null {
  if (!d) return null;
  if (d.includes(".")) {
    const [day, mon, yr] = d.split(".");
    return new Date(+yr, +mon - 1, +day);
  }
  return new Date(d);
}
function isPast(d: string): boolean {
  const ed = parseDate(d);
  if (!ed) return false;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return ed < t;
}

// ═══════════════════════════════════════════════════════════════
// CARD NORMALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════
const normalizeCardType = (cardType: string): string => {
  if (!cardType) return "Unknown";
  const upper = cardType.toUpperCase().trim();

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

  if (upper.includes("MASTERCARD") || upper.includes("MASTER CARD")) {
    if (upper.includes("WORLD ELITE")) return "MC World Elite";
    if (upper.includes("WORLD")) return "MC World";
    if (upper.includes("PLATINUM") && upper.includes("DEBIT")) return "MC Platinum Debit";
    if (upper.includes("PLATINUM")) return "MC Platinum";
    if (upper.includes("GOLD")) return "MC Gold";
    if (upper.includes("DEBIT")) return "MC Debit";
    if (upper.includes("BUSINESS")) return "MC Business";
    if (upper.includes("STANDARD")) return "MC Standard";
    return "MasterCard";
  }

  if (upper.includes("MAESTRO")) return "Maestro";
  if (upper.includes("AMEX") || upper.includes("AMERICAN EXPRESS")) {
    if (upper.includes("PLATINUM")) return "Amex Platinum";
    if (upper.includes("GOLD")) return "Amex Gold";
    return "Amex";
  }
  if (upper.includes("DINERS")) return "Diners";

  return cardType
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const normalizeIssuerName = (issuer: string): string => {
  if (!issuer) return "Unknown";
  const upper = issuer.toUpperCase().trim();

  if (upper.includes("CRNOGORSKA KOMERCIJALNA") || upper.includes("CKB")) return "CKB";
  if (upper.includes("HIPOTEKARNA")) return "Hipotekarna";
  if (upper.includes("NLB KOMERCIJALNA")) return "NLB Komercijalna";
  if (upper.includes("NLB BANKA") && upper.includes("SKOPJE")) return "NLB Skopje";
  if (upper.includes("NLB")) return "NLB";
  if (upper.includes("ERSTE")) return "Erste";
  if (upper.includes("PRVA BANKA")) return "Prva Banka CG";
  if (upper.includes("ADDIKO")) return "Addiko";
  if (upper.includes("LOVCEN") || upper.includes("LOVĆEN")) return "Lovćen";
  if (upper.includes("ADRIATIC")) return "Adriatic";
  if (upper.includes("INTESA") && upper.includes("ALBANIA")) return "Intesa Albania";
  if (upper.includes("INTESA") || upper.includes("BANCA INTESA")) return "Banca Intesa";
  if (upper.includes("RAIFFEISEN")) return "Raiffeisen";
  if (upper.includes("UNICREDIT")) return "UniCredit";
  if (upper.includes("OTP") && upper.includes("SRBIJA")) return "OTP Srbija";
  if (upper.includes("OTP")) return "OTP";
  if (upper.includes("REVOLUT")) return "Revolut";
  if (upper.includes("YETTEL")) return "Yettel";
  if (upper.includes("UNITED NATIONS") || upper.includes("UN FEDERAL")) return "UN FCU";
  if (upper.includes("BANK OF AMERICA")) return "Bank of America";
  if (upper.includes("PSA PAYMENT")) return "PSA Payment";
  if (upper.includes("BCEE") || upper.includes("CAISSE D'EPARGNE")) return "BCEE";
  if (upper.includes("BULGARIAN BANK")) return "UBB Bulgaria";
  if (upper.includes("AGROINDUSTRIJ") || upper.includes("AIK")) return "AIK Banka";

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

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getBrandColor = (brand: string): string => {
  const colors: Record<string, string> = {
    VISA: "from-blue-600 to-blue-500",
    MASTERCARD: "from-orange-600 to-red-500",
    AMEX: "from-blue-800 to-blue-600",
    MAESTRO: "from-red-600 to-blue-600",
    DINERS: "from-gray-700 to-gray-600",
  };
  return colors[brand.toUpperCase()] || "from-slate-600 to-slate-500";
};

const getCountryFlag = (code: string): string => {
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
    XK: "🇽🇰",
  };
  return flags[code.toUpperCase()] || "🏳️";
};

interface Props {
  onSwitchToOrganizer?: () => void;
}

export default function AdminDashboard({ onSwitchToOrganizer }: Props) {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "revenue" | "sold">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfitDetails, setShowProfitDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "cards">("events");
  const [cardSubTab, setCardSubTab] = useState<"brand" | "country" | "issuer" | "type">("brand");

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const loadAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const aboutEvents = await supabaseQuery("AboutEvents", "");
      const summaries: EventSummary[] = [];
      const allTicketsCollected: any[] = [];

      for (const ev of aboutEvents) {
        const eventId = ev.eventKey;
        if (!eventId) continue;
        const tickets = await supabaseQuery("QRKarte", `eventId=eq.${eventId}`);

        // Collect all tickets for card statistics
        tickets.forEach((t) => {
          allTicketsCollected.push({ ...t, eventName: ev.name, eventDate: ev.date });
        });

        const deductions = await fetchDeductions(eventId);

        const serviceFee = parseFloat(ev.serviceFeePercentage || "0");
        const pdvPct = parseFloat(ev.pdvPercentage || "21");
        const biletFee = parseFloat(ev.biletarnicaFee || "0");
        let virmanFee = parseFloat(ev.virmanFee || "0");
        if (!virmanFee && ev.description) {
          try {
            const d = JSON.parse(ev.description);
            if (d?.virmanFee) virmanFee = parseFloat(d.virmanFee);
          } catch {}
        }
        const currency = ev.currency || "EUR";
        const perTicket = currency === "RSD" ? 35 : 0.3;

        const hidden = tickets.filter(isHidden);
        const visible = tickets.filter((t: any) => !isHidden(t) && !isReservation(t) && !isExcludedChannel(t) && t.status !== "refunded");
        const gratis = visible.filter((t: any) => parseFloat(t.price || "0") === 0);
        const paid = visible.filter((t: any) => parseFloat(t.price || "0") > 0);

        let totalRevenue = 0,
          eticketsFee = 0,
          hiddenValue = 0;
        let fiscalized = 0,
          notFiscalized = 0,
          fiscalizedValue = 0,
          notFiscalizedValue = 0;
        let onlineCount = 0,
          onlineAmount = 0,
          biletCount = 0,
          biletAmount = 0;
        let virmanCount = 0,
          virmanAmount = 0,
          karticaCount = 0,
          karticaAmount = 0;

        for (const t of paid) {
          const price = parseFloat(t.price || "0");
          const ch = normalizeSalesChannel(t.salesChannel);
          totalRevenue += price;

          let feeP =
            ch === "Biletarnica" || ch === "Online-Kartica" ? biletFee : ch === "Virman" ? virmanFee : serviceFee;
          const fee = (price * feeP) / 100;
          const pdv = (fee * pdvPct) / 100;
          let ticketFee = fee + pdv;
          if (ch === "Online") {
            ticketFee += perTicket;
            onlineCount++;
            onlineAmount += price;
          } else if (ch === "Biletarnica") {
            biletCount++;
            biletAmount += price;
          } else if (ch === "Virman") {
            virmanCount++;
            virmanAmount += price;
          } else {
            karticaCount++;
            karticaAmount += price;
          }
          eticketsFee += ticketFee;

          if (t.isFiscalized === true || t.isFiscalized === "true") {
            fiscalized++;
            fiscalizedValue += price;
          } else {
            notFiscalized++;
            notFiscalizedValue += price;
          }
        }

        for (const t of hidden) hiddenValue += parseFloat(t.price || "0");

        const forPayout = totalRevenue - eticketsFee;
        const totalDed = deductions.reduce((s, d) => s + d.amount, 0);
        const finalPayout = forPayout - totalDed;

        const onlineTurnover = onlineAmount + karticaAmount;
        const customerServiceFeeAmount = (onlineTurnover * CUSTOMER_SERVICE_FEE_PERCENT) / 100;
        const totalChargedAmount = onlineTurnover + customerServiceFeeAmount;
        const bankFeeAmount = (totalChargedAmount * BANK_FEE_PERCENT) / 100;
        const afterBankAmount = totalChargedAmount - bankFeeAmount;
        const serviceFeeAfterBankAmount = afterBankAmount - onlineTurnover;
        const netProfitAmount = serviceFeeAfterBankAmount + eticketsFee;

        summaries.push({
          eventId,
          eventName: ev.name || "?",
          venue: ev.venue || "",
          date: ev.date || "",
          currency,
          paidTickets: paid.length,
          gratisTickets: gratis.length,
          hiddenTickets: hidden.length,
          totalRevenue,
          eticketsFee,
          forPayout,
          finalPayout,
          deductions,
          totalDeductions: totalDed,
          fiscalized,
          notFiscalized,
          fiscalizedValue,
          notFiscalizedValue,
          onlineCount,
          onlineAmount,
          biletarnicaCount: biletCount,
          biletarnicaAmount: biletAmount,
          virmanCount,
          virmanAmount,
          karticaCount,
          karticaAmount,
          serviceFeePercentage: serviceFee,
          biletarnicaFee: biletFee,
          virmanFee,
          pdvPercentage: pdvPct,
          hiddenValue,
          isPast: isPast(ev.date),
          onlineTurnover,
          customerServiceFee: customerServiceFeeAmount,
          totalCharged: totalChargedAmount,
          bankFee: bankFeeAmount,
          afterBank: afterBankAmount,
          serviceFeeAfterBank: serviceFeeAfterBankAmount,
          netProfit: netProfitAmount,
        });
      }
      setEvents(summaries);
      setAllTickets(allTicketsCollected);
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let r = [...events];
    if (!showPast) r = r.filter((e) => !e.isPast);
    r.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0);
      else if (sortBy === "revenue") cmp = a.totalRevenue - b.totalRevenue;
      else cmp = a.paidTickets - b.paidTickets;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [events, showPast, sortBy, sortDir]);

  // ═══════════════════════════════════════════════════════════════
  // CARD STATISTICS - computed from filtered events' tickets
  // ═══════════════════════════════════════════════════════════════
  const cardStats: CardStatistics = useMemo(() => {
    const filteredEventIds = new Set(filtered.map((e) => e.eventId));

    // Filter tickets from filtered events, online only, with card data
    const cardTickets = allTickets.filter((t: any) => {
      if (!filteredEventIds.has(t.eventId)) return false;
      const channel = (t.salesChannel || "").toLowerCase();
      return (channel === "online" || channel === "website" || channel === "") && t.cardBrand;
    });

    // Group by session for unique transactions
    const sessionMap = new Map<
      string,
      {
        cardBrand: string;
        cardCountry: string;
        cardDescription: string;
        cardIssuer: string;
        totalAmount: number;
        ticketCount: number;
      }
    >();

    cardTickets.forEach((ticket: any) => {
      const sessionKey =
        ticket.sessionId ||
        ticket.orderId ||
        `${ticket.customerEmail}_${ticket.purchaseDate}_${ticket.cardBrand}_${ticket.cardIssuer}`;

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          cardBrand: ticket.cardBrand || "Unknown",
          cardCountry: ticket.cardCountry || "Unknown",
          cardDescription: ticket.cardDescription || "Unknown",
          cardIssuer: ticket.cardIssuer || "Unknown",
          totalAmount: 0,
          ticketCount: 0,
        });
      }

      const session = sessionMap.get(sessionKey)!;
      // Koristi totalPrice (što kupac plati) umjesto price (cijena karte)
      session.totalAmount += Number(ticket.totalPrice) || Number(ticket.price) || 0;
      session.ticketCount++;
    });

    const uniqueTransactions = Array.from(sessionMap.values());

    const brandMap = new Map<string, { count: number; amount: number }>();
    const countryMap = new Map<string, { count: number; amount: number }>();
    const issuerMap = new Map<string, { count: number; amount: number }>();
    const typeMap = new Map<string, { count: number; amount: number }>();

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

      // Issuer - normalized
      const issuer = normalizeIssuerName(transaction.cardIssuer);
      if (!issuerMap.has(issuer)) issuerMap.set(issuer, { count: 0, amount: 0 });
      issuerMap.get(issuer)!.count++;
      issuerMap.get(issuer)!.amount += transaction.totalAmount;

      // Type - normalized
      const cardType = normalizeCardType(transaction.cardDescription);
      if (!typeMap.has(cardType)) typeMap.set(cardType, { count: 0, amount: 0 });
      typeMap.get(cardType)!.count++;
      typeMap.get(cardType)!.amount += transaction.totalAmount;
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
      totalCount: totalTransactions,
      totalAmount,
      totalTickets: cardTickets.length,
      byBrand: mapToArray(brandMap),
      byCountry: mapToArray(countryMap),
      byIssuer: mapToArray(issuerMap),
      byType: mapToArray(typeMap),
    };
  }, [allTickets, filtered]);

  const totals: AdminTotals = useMemo(() => {
    const totalRevenue = filtered.reduce((s, e) => s + e.totalRevenue, 0);
    const totalEticketsFee = filtered.reduce((s, e) => s + e.eticketsFee, 0);
    const onlineTurnover = filtered.reduce((s, e) => s + e.onlineTurnover, 0);
    const customerServiceFee = (onlineTurnover * CUSTOMER_SERVICE_FEE_PERCENT) / 100;
    const totalCharged = onlineTurnover + customerServiceFee;
    const bankFee = (totalCharged * BANK_FEE_PERCENT) / 100;
    const afterBank = totalCharged - bankFee;
    const serviceFeeAfterBank = afterBank - onlineTurnover;
    const netProfit = serviceFeeAfterBank + totalEticketsFee;

    return {
      totalEvents: filtered.length,
      activeEvents: filtered.filter((e) => !e.isPast).length,
      totalPaid: filtered.reduce((s, e) => s + e.paidTickets, 0),
      totalGratis: filtered.reduce((s, e) => s + e.gratisTickets, 0),
      totalHidden: filtered.reduce((s, e) => s + e.hiddenTickets, 0),
      totalRevenue,
      totalEticketsFee,
      totalForPayout: filtered.reduce((s, e) => s + e.forPayout, 0),
      totalDeductions: filtered.reduce((s, e) => s + e.totalDeductions, 0),
      totalFinalPayout: filtered.reduce((s, e) => s + e.finalPayout, 0),
      totalFiscalized: filtered.reduce((s, e) => s + e.fiscalized, 0),
      totalNotFiscalized: filtered.reduce((s, e) => s + e.notFiscalized, 0),
      totalFiscalizedValue: filtered.reduce((s, e) => s + e.fiscalizedValue, 0),
      totalNotFiscalizedValue: filtered.reduce((s, e) => s + e.notFiscalizedValue, 0),
      totalHiddenValue: filtered.reduce((s, e) => s + e.hiddenValue, 0),
      onlineTurnover,
      customerServiceFee,
      totalCharged,
      bankFee,
      afterBank,
      serviceFeeAfterBank,
      netProfit,
    };
  }, [filtered]);

  const exportCSV = () => {
    const h = ["Događaj", "Datum", "Prodato", "Online", "Naplaćeno", "Banka", "Razlika", "E-fee", "ZARADA"];
    const rows = filtered.map((e) => [
      e.eventName,
      e.date,
      e.paidTickets,
      e.onlineTurnover.toFixed(2),
      e.totalCharged.toFixed(2),
      e.bankFee.toFixed(2),
      e.serviceFeeAfterBank.toFixed(2),
      e.eticketsFee.toFixed(2),
      e.netProfit.toFixed(2),
    ]);
    rows.push([
      "UKUPNO",
      "",
      totals.totalPaid,
      totals.onlineTurnover.toFixed(2),
      totals.totalCharged.toFixed(2),
      totals.bankFee.toFixed(2),
      totals.serviceFeeAfterBank.toFixed(2),
      totals.totalEticketsFee.toFixed(2),
      totals.netProfit.toFixed(2),
    ]);
    const csv = [h.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `admin-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportCardCSV = () => {
    const filteredEventIds = new Set(filtered.map((e) => e.eventId));
    const cardTickets = allTickets.filter((t: any) => {
      if (!filteredEventIds.has(t.eventId)) return false;
      const channel = (t.salesChannel || "").toLowerCase();
      return (channel === "online" || channel === "website" || channel === "") && t.cardBrand;
    });

    const h = [
      "Event",
      "Datum",
      "TicketID",
      "Kupac",
      "Email",
      "Brand",
      "Country",
      "Type",
      "Issuer",
      "Cijena",
      "Naplaceno",
    ];
    const rows = cardTickets.map((t: any) => [
      `"${t.eventName || ""}"`,
      t.eventDate || "",
      t.ticketId || "",
      `"${t.customerName || ""}"`,
      t.customerEmail || "",
      t.cardBrand || "",
      t.cardCountry || "",
      t.cardDescription || "",
      `"${t.cardIssuer || ""}"`,
      t.price || 0,
      t.totalPrice || t.price || 0,
    ]);

    const csv = [h.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `card-stats-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const toggleSort = (f: "date" | "revenue" | "sold") => {
    if (sortBy === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(f);
      setSortDir("asc");
    }
  };

  if (!isAdmin)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-red-400 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Pristup odbijen</h2>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <header
        className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base lg:text-xl font-bold text-white">Admin</h1>
              {lastUpdate && (
                <p className="text-[10px] lg:text-xs text-slate-400">
                  {lastUpdate.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={isLoading} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg">
              <RefreshCw className={`w-5 h-5 text-white ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 bg-slate-800 rounded-lg lg:hidden">
              {menuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>
            <div className="hidden lg:flex gap-2">
              <button
                onClick={activeTab === "cards" ? exportCardCSV : exportCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              {onSwitchToOrganizer && (
                <button
                  onClick={onSwitchToOrganizer}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2"
                >
                  <Ticket className="w-4 h-4" /> Događaji
                </button>
              )}
              <button onClick={logout} className="p-2 text-slate-400 hover:text-white">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden px-4 pb-3 space-y-2 border-t border-slate-800 pt-3">
            <button
              onClick={() => {
                activeTab === "cards" ? exportCardCSV() : exportCSV();
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-600/20 text-emerald-400 rounded-xl"
            >
              <Download className="w-5 h-5" /> Export CSV
            </button>
            {onSwitchToOrganizer && (
              <button
                onClick={() => {
                  onSwitchToOrganizer();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/20 text-blue-400 rounded-xl"
              >
                <Ticket className="w-5 h-5" /> Moji događaji
              </button>
            )}
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/50 text-slate-400 rounded-xl"
            >
              <LogOut className="w-5 h-5" /> Odjava
            </button>
          </div>
        )}
      </header>

      <main
        className="max-w-7xl mx-auto px-4 lg:px-8 py-4 lg:py-6 space-y-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* TAB SWITCHER */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("events")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "events"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-slate-800/50 text-slate-400 border border-slate-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Događaji
          </button>
          <button
            onClick={() => setActiveTab("cards")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "cards"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-slate-800/50 text-slate-400 border border-slate-700"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Kartice
          </button>
        </div>

        {/* EVENTS TAB */}
        {activeTab === "events" && (
          <>
            {/* ZARADA - KOMPAKTAN BOX */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl p-3 lg:p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <PiggyBank className="w-5 h-5 text-emerald-100" />
                    <span className="text-emerald-100 text-sm font-medium">ZARADA</span>
                    <button
                      onClick={() => setShowProfitDetails(!showProfitDetails)}
                      className="text-emerald-200 hover:text-white ml-1"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-3xl lg:text-4xl font-bold text-white">{formatCurrency(totals.netProfit)}</div>
                </div>
                <div className="text-right text-emerald-200 text-xs lg:text-sm">
                  <div>{totals.activeEvents} događaja</div>
                  <div>{totals.totalPaid.toLocaleString()} karata</div>
                </div>
              </div>

              {showProfitDetails && (
                <div className="mt-3 pt-3 border-t border-emerald-500/50 grid grid-cols-2 gap-x-4 gap-y-1 text-xs lg:text-sm">
                  <span className="text-emerald-200">Online promet</span>
                  <span className="text-right text-white font-mono">{formatCurrency(totals.onlineTurnover)}</span>
                  <span className="text-emerald-200">+ Service fee (5%)</span>
                  <span className="text-right text-emerald-300 font-mono">
                    +{formatCurrency(totals.customerServiceFee)}
                  </span>
                  <span className="text-emerald-100 font-medium">= Naplaćeno</span>
                  <span className="text-right text-white font-mono font-medium">
                    {formatCurrency(totals.totalCharged)}
                  </span>
                  <span className="text-emerald-200">− Banka (3.25%)</span>
                  <span className="text-right text-red-300 font-mono">−{formatCurrency(totals.bankFee)}</span>
                  <span className="text-emerald-200">= Razlika</span>
                  <span className="text-right text-white font-mono">{formatCurrency(totals.serviceFeeAfterBank)}</span>
                  <span className="text-emerald-200">+ E-tickets fee</span>
                  <span className="text-right text-pink-300 font-mono">+{formatCurrency(totals.totalEticketsFee)}</span>
                  <span className="text-white font-bold pt-1 border-t border-emerald-500/50">= ZARADA</span>
                  <span className="text-right text-white font-mono font-bold pt-1 border-t border-emerald-500/50">
                    {formatCurrency(totals.netProfit)}
                  </span>
                </div>
              )}
            </div>

            {/* TABELA STATISTIKA */}
            <div className="bg-slate-800/50 rounded-xl overflow-hidden">
              <table className="w-full text-xs lg:text-sm">
                <tbody className="divide-y divide-slate-700/50">
                  <tr>
                    <td className="px-3 py-2 text-slate-400">Prodato</td>
                    <td className="px-3 py-2 text-right text-white font-semibold">
                      {totals.totalPaid.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-slate-400">Gratis</td>
                    <td className="px-3 py-2 text-right text-purple-400 font-semibold">{totals.totalGratis}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-400">Online promet</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-semibold">
                      {formatCurrency(totals.onlineTurnover)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">E-tickets fee</td>
                    <td className="px-3 py-2 text-right text-pink-400 font-semibold">
                      {formatCurrency(totals.totalEticketsFee)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-400">Za isplatu</td>
                    <td className="px-3 py-2 text-right text-cyan-400 font-semibold">
                      {formatCurrency(totals.totalForPayout)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">Ukupan promet</td>
                    <td className="px-3 py-2 text-right text-white font-semibold">
                      {formatCurrency(totals.totalRevenue)}
                    </td>
                  </tr>
                  <tr className="bg-red-500/10">
                    <td className="px-3 py-2 text-slate-400">Banka (3.25%)</td>
                    <td className="px-3 py-2 text-right text-red-400 font-semibold">
                      −{formatCurrency(totals.bankFee)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">Naplaćeno</td>
                    <td className="px-3 py-2 text-right text-white font-semibold">
                      {formatCurrency(totals.totalCharged)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-emerald-400" />
                        Fisk
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-semibold">
                      {totals.totalFiscalized}{" "}
                      <span className="text-emerald-400/70">({formatCurrency(totals.totalFiscalizedValue)})</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileX className="w-3 h-3 text-amber-400" />
                        Nefisk
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-amber-400 font-semibold">
                      {totals.totalNotFiscalized}{" "}
                      <span className="text-amber-400/70">({formatCurrency(totals.totalNotFiscalizedValue)})</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-400">
                      <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3 text-rose-400" />
                        Skrivene
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-rose-400 font-semibold">
                      {totals.totalHidden}{" "}
                      <span className="text-rose-400/70">({formatCurrency(totals.totalHiddenValue)})</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">Service fee</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-semibold">
                      {formatCurrency(totals.customerServiceFee)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(e) => setShowPast(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800"
                />
                Završeni
              </label>
              <div className="flex gap-1">
                {(["date", "revenue", "sold"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleSort(f)}
                    className={`px-2 py-1 rounded text-xs ${sortBy === f ? "bg-red-500/20 text-red-400" : "text-slate-500"}`}
                  >
                    {f === "date" ? "Dat" : f === "revenue" ? "€" : "#"}
                    {sortBy === f && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                ))}
              </div>
            </div>

            {/* Events List */}
            {isLoading ? (
              <div className="flex justify-center py-20">
                <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nema događaja</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filtered.map((ev) => (
                  <EventCard
                    key={ev.eventId}
                    ev={ev}
                    expanded={expandedEvent === ev.eventId}
                    onToggle={() => setExpandedEvent(expandedEvent === ev.eventId ? null : ev.eventId)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* CARDS TAB */}
        {activeTab === "cards" && (
          <>
            {/* Card Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs">Transakcije</span>
                </div>
                <div className="text-2xl font-bold text-white">{cardStats.totalCount.toLocaleString()}</div>
                <div className="text-xs text-slate-500">{cardStats.totalTickets.toLocaleString()} karata</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Promet</span>
                </div>
                <div className="text-xl lg:text-2xl font-bold text-emerald-400">
                  {formatCurrency(cardStats.totalAmount)}
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Globe className="w-4 h-4" />
                  <span className="text-xs">Države</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">{cardStats.byCountry.length}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Building2 className="w-4 h-4" />
                  <span className="text-xs">Banke</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">{cardStats.byIssuer.length}</div>
              </div>
            </div>

            {/* Card Sub-tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {[
                { key: "brand", label: "Brand", icon: CreditCard },
                { key: "country", label: "Država", icon: Globe },
                { key: "issuer", label: "Banka", icon: Building2 },
                { key: "type", label: "Tip", icon: Ticket },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setCardSubTab(key as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    cardSubTab === key
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Card Stats List */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-700/50">
                {(cardSubTab === "brand"
                  ? cardStats.byBrand
                  : cardSubTab === "country"
                    ? cardStats.byCountry
                    : cardSubTab === "issuer"
                      ? cardStats.byIssuer
                      : cardStats.byType
                ).map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3 p-3 hover:bg-slate-700/30 transition-colors">
                    {/* Rank */}
                    <span className="text-lg font-bold text-slate-500 w-6 text-center">{index + 1}</span>

                    {/* Icon/Badge */}
                    {cardSubTab === "brand" && (
                      <div
                        className={`w-10 h-6 rounded bg-gradient-to-r ${getBrandColor(item.name)} flex items-center justify-center flex-shrink-0`}
                      >
                        <span className="text-white text-[10px] font-bold">{item.name.substring(0, 4)}</span>
                      </div>
                    )}
                    {cardSubTab === "country" && (
                      <span className="text-2xl w-10 text-center flex-shrink-0">{getCountryFlag(item.name)}</span>
                    )}
                    {cardSubTab === "issuer" && (
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    {cardSubTab === "type" && (
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-slate-400" />
                      </div>
                    )}

                    {/* Name & Count */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.count} transakcija</p>
                    </div>

                    {/* Amount & Percentage */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-emerald-400 text-sm">{formatCurrency(item.amount)}</p>
                      <p className="text-[10px] text-slate-500">{item.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}

                {((cardSubTab === "brand" && cardStats.byBrand.length === 0) ||
                  (cardSubTab === "country" && cardStats.byCountry.length === 0) ||
                  (cardSubTab === "issuer" && cardStats.byIssuer.length === 0) ||
                  (cardSubTab === "type" && cardStats.byType.length === 0)) && (
                  <div className="text-center text-slate-500 py-8">Nema podataka o karticama</div>
                )}
              </div>
            </div>

            {/* Top 5 Quick View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Top Brands */}
              <div className="bg-gradient-to-br from-blue-900/30 to-slate-800/50 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">Top 5 Brandova</span>
                </div>
                <div className="space-y-2">
                  {cardStats.byBrand.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-4">{i + 1}.</span>
                        <div
                          className={`w-8 h-5 rounded bg-gradient-to-r ${getBrandColor(item.name)} flex items-center justify-center`}
                        >
                          <span className="text-white text-[8px] font-bold">{item.name.substring(0, 4)}</span>
                        </div>
                        <span className="text-xs font-medium text-white">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold text-blue-400">{item.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                  {cardStats.byBrand.length === 0 && (
                    <p className="text-center text-slate-500 py-2 text-xs">Nema podataka</p>
                  )}
                </div>
              </div>

              {/* Top Countries */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-slate-800/50 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Top 5 Država</span>
                </div>
                <div className="space-y-2">
                  {cardStats.byCountry.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-4">{i + 1}.</span>
                        <span className="text-lg">{getCountryFlag(item.name)}</span>
                        <span className="text-xs font-medium text-white">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400">{formatCurrency(item.amount)}</span>
                        <span className="text-[10px] text-slate-500 ml-1">({item.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                  {cardStats.byCountry.length === 0 && (
                    <p className="text-center text-slate-500 py-2 text-xs">Nema podataka</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EventCard({ ev, expanded, onToggle }: { ev: EventSummary; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className={`bg-slate-800/50 border rounded-2xl overflow-hidden ${ev.isPast ? "opacity-60 border-slate-700" : "border-slate-700"}`}
    >
      <button onClick={onToggle} className="w-full p-3 lg:p-4 text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${ev.isPast ? "bg-slate-500" : "bg-emerald-500"}`} />
              <span className="font-semibold text-white truncate text-sm lg:text-base">{ev.eventName}</span>
            </div>
            <div className="text-[10px] lg:text-xs text-slate-500 ml-4">{ev.date}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-emerald-400 font-bold text-sm lg:text-base">{formatCurrency(ev.netProfit)}</div>
            <div className="text-[10px] lg:text-xs text-slate-500">{ev.paidTickets} karata</div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
        {/* Quick stats row */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-700/50 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] lg:text-xs text-slate-400">
            <Gift className="w-3 h-3 text-purple-400" />
            {ev.gratisTickets}
          </span>
          <span className="flex items-center gap-1 text-[10px] lg:text-xs text-slate-400">
            <EyeOff className="w-3 h-3 text-rose-400" />
            {ev.hiddenTickets}
          </span>
          <span className="flex items-center gap-1 text-[10px] lg:text-xs text-slate-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {ev.fiscalized}
          </span>
          {ev.notFiscalized > 0 && (
            <span className="flex items-center gap-1 text-[10px] lg:text-xs text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {ev.notFiscalized}
            </span>
          )}
          <span className="ml-auto text-[10px] lg:text-xs text-cyan-400">
            →{formatCurrency(ev.forPayout, ev.currency)}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 lg:px-4 pb-3 lg:pb-4 border-t border-slate-700/50 bg-slate-900/30 space-y-3">
          {/* Sales channels */}
          <div className="grid grid-cols-4 gap-2 pt-3">
            <div className="text-center">
              <div className="text-sm lg:text-lg font-bold text-white">{ev.onlineCount}</div>
              <div className="text-[10px] text-blue-400">Online</div>
            </div>
            <div className="text-center">
              <div className="text-sm lg:text-lg font-bold text-white">{ev.biletarnicaCount}</div>
              <div className="text-[10px] text-pink-400">Bilet.</div>
            </div>
            <div className="text-center">
              <div className="text-sm lg:text-lg font-bold text-white">{ev.virmanCount}</div>
              <div className="text-[10px] text-sky-400">Virman</div>
            </div>
            <div className="text-center">
              <div className="text-sm lg:text-lg font-bold text-white">{ev.karticaCount}</div>
              <div className="text-[10px] text-amber-400">Kartica</div>
            </div>
          </div>

          {/* Profit breakdown - compact */}
          <div className="bg-emerald-500/10 rounded-lg p-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Online:</span>
              <span className="text-white">{formatCurrency(ev.onlineTurnover, ev.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Naplaćeno (+5%):</span>
              <span className="text-white">{formatCurrency(ev.totalCharged, ev.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Banka:</span>
              <span className="text-red-400">-{formatCurrency(ev.bankFee, ev.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Razlika:</span>
              <span className="text-emerald-400">{formatCurrency(ev.serviceFeeAfterBank, ev.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">E-fee:</span>
              <span className="text-pink-400">+{formatCurrency(ev.eticketsFee, ev.currency)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-emerald-500/30">
              <span className="text-emerald-300">Zarada:</span>
              <span className="text-emerald-400">{formatCurrency(ev.netProfit, ev.currency)}</span>
            </div>
          </div>

          {/* Other info */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            {ev.hiddenTickets > 0 && (
              <span className="px-2 py-1 bg-slate-800 rounded text-rose-400">
                <EyeOff className="w-3 h-3 inline mr-1" />
                {ev.hiddenTickets} ({formatCurrency(ev.hiddenValue, ev.currency)})
              </span>
            )}
            <span className="px-2 py-1 bg-slate-800 rounded text-cyan-400">
              Isplata: {formatCurrency(ev.forPayout, ev.currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
