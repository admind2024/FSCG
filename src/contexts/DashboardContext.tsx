// src/contexts/DashboardContext.tsx
// ISPRAVLJENA VERZIJA - price umjesto totalPrice, boolean Hide polja, CARD PODACI DODANI
// REZERVACIJE UKLONJENE IZ GLAVNOG OBRAČUNA
// GRATIS KARTE - odvojene od plaćenih
// ALOKACIJE - dodane iz AboutEvents.allocations
import React, { createContext, useContext, useState, useEffect } from "react";
import { User, EventData, EventInfo, Ticket } from "@/types/dashboard";

// ============================================
// SUPABASE DIREKTNO
// ============================================

const SUPABASE_URL = "https://hvpytasddzeprgqkwlbu.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cHl0YXNkZHplcHJncWt3bGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDMyODQsImV4cCI6MjA4MjE3OTI4NH0.R1wPgBpyO7MHs0YL_pW0XBKkX8QweJ8MuhHUpuDSuKk";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// GET query sa paginacijom
async function supabaseQuery(table: string, params: string = ""): Promise<any[]> {
  const allData: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}&limit=${limit}&offset=${offset}`;
    console.log("Supabase query:", url);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error("Supabase error:", res.status, res.statusText);
      throw new Error(`Query failed: ${res.statusText}`);
    }
    const data = await res.json();
    allData.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  console.log("Supabase TOTAL:", table, allData.length, "rows");
  return allData;
}

// UPDATE - ažurira red u bazi
async function supabaseUpdate(table: string, id: string, data: Record<string, any>): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.error("Supabase update error:", err);
    return false;
  }
}

// BATCH UPDATE - ažurira više redova odjednom
async function supabaseBatchUpdate(table: string, ids: string[], data: Record<string, any>): Promise<number> {
  if (ids.length === 0) return 0;

  let successCount = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const promises = batch.map((id) => supabaseUpdate(table, id, data));
    const results = await Promise.all(promises);
    successCount += results.filter((r) => r).length;
  }

  return successCount;
}

// ============================================
// BUSINESS LOGIC - IDENTIČNO KAO WIX
// ============================================

function normalizeSalesChannel(channel: string | null): string {
  if (!channel) return "Online";
  const ch = channel.trim().toLowerCase();

  if (ch.includes("gotovina")) return "Biletarnica";
  if (ch === "online-biletarnica") return "Online";
  if (ch.includes("biletarnica")) return "Biletarnica";
  if (ch.includes("virman") || ch.includes("bank") || ch.includes("transfer")) return "Virman";
  if (ch.includes("kartica")) return "Online-Kartica";
  if (ch === "savez") return "Savez";
  if (ch === "igraci") return "Igraci";
  if (ch === "website" || ch === "online") return "Online";

  return "Online";
}

function isTicketHidden(ticket: any): boolean {
  if (ticket.Hide === true) return true;
  if (ticket.manualHide === true) return true;
  if (ticket.Hide === "true") return true;
  if (ticket.manualHide === "true") return true;
  return false;
}

function isReservation(ticket: any): boolean {
  const channel = (ticket.salesChannel || "").toLowerCase();
  return channel === "rezervacija" || channel.includes("bukiranje");
}

function isExcludedChannel(ticket: any): boolean {
  const channel = (ticket.salesChannel || "").toLowerCase();
  return channel === "savez" || channel === "igraci";
}

function calculateFees(
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

function parseCapacityString(capacityStr: string | null | undefined): Record<string, number> {
  if (!capacityStr) return {};

  const capacities: Record<string, number> = {};

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

function getTotalCapacity(capacityStr: string | null | undefined): number {
  const capacities = parseCapacityString(capacityStr);
  return Object.values(capacities).reduce((sum, cap) => sum + cap, 0);
}

// ============================================
// SKIP RATE LOGIKA
// ============================================

function isProtectedSeat(seatId: string | null): boolean {
  if (!seatId) return false;

  const lowerSeatId = seatId.toLowerCase();
  const protectedPrefixes = ["vip barski sto", "vip sjedeći", "9 l", "8 d"];

  for (const prefix of protectedPrefixes) {
    if (lowerSeatId.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

function shouldExcludeFromHiding(ticket: any): boolean {
  if (isProtectedSeat(ticket.seatId)) return true;
  if (Number(ticket.price || 0) === 0) return true;
  return false;
}

async function markTicketsAsHidden(
  tickets: any[],
  onlineSkipRate: number,
  biletarnicaSkipRate: number,
): Promise<{ hiddenCount: number; updatedIds: string[] }> {
  if (onlineSkipRate <= 0 && biletarnicaSkipRate <= 0) {
    return { hiddenCount: 0, updatedIds: [] };
  }


  const manuallyHiddenIds = new Set(tickets.filter((t) => t.manualHide === true).map((t) => t.id || t._id));

  const sortedTickets = [...tickets].sort((a, b) => {
    const dateStrA = a["Created Date"] || `${a.Purchasedate || "1970-01-01"}T${a.purchaseTime || "00:00:00"}`;
    const dateStrB = b["Created Date"] || `${b.Purchasedate || "1970-01-01"}T${b.purchaseTime || "00:00:00"}`;
    const dateA = new Date(dateStrA);
    const dateB = new Date(dateStrB);
    return dateA.getTime() - dateB.getTime();
  });


  let lastHiddenOnlinePosition = 0;
  let lastHiddenBiletarnicaPosition = 0;
  let onlinePosition = 0;
  let biletarnicaPosition = 0;

  for (const ticket of sortedTickets) {
    if (shouldExcludeFromHiding(ticket)) continue;

    const normalizedChannel = normalizeSalesChannel(ticket.salesChannel);

    if (
      normalizedChannel === "Biletarnica" ||
      normalizedChannel === "Virman" ||
      normalizedChannel === "Online-Kartica"
    ) {
      biletarnicaPosition++;
      if (ticket.Hide === true) {
        lastHiddenBiletarnicaPosition = biletarnicaPosition;
      }
    } else {
      onlinePosition++;
      if (ticket.Hide === true) {
        lastHiddenOnlinePosition = onlinePosition;
      }
    }
  }


  onlinePosition = 0;
  biletarnicaPosition = 0;
  const ticketsToHide: string[] = [];

  for (const ticket of sortedTickets) {
    if (shouldExcludeFromHiding(ticket)) continue;

    const ticketId = ticket.id || ticket._id;
    const normalizedChannel = normalizeSalesChannel(ticket.salesChannel);

    if (
      normalizedChannel === "Biletarnica" ||
      normalizedChannel === "Virman" ||
      normalizedChannel === "Online-Kartica"
    ) {
      biletarnicaPosition++;

      if (biletarnicaPosition > lastHiddenBiletarnicaPosition) {
        const positionFromLast = biletarnicaPosition - lastHiddenBiletarnicaPosition;
        const alreadyHidden = ticket.Hide === true;

        if (
          !alreadyHidden &&
          !manuallyHiddenIds.has(ticketId) &&
          biletarnicaSkipRate > 0 &&
          positionFromLast % biletarnicaSkipRate === 0
        ) {
          ticketsToHide.push(ticketId);
        }
      }
    } else {
      onlinePosition++;

      if (onlinePosition > lastHiddenOnlinePosition) {
        const positionFromLast = onlinePosition - lastHiddenOnlinePosition;
        const alreadyHidden = ticket.Hide === true;

        if (
          !alreadyHidden &&
          !manuallyHiddenIds.has(ticketId) &&
          onlineSkipRate > 0 &&
          positionFromLast % onlineSkipRate === 0
        ) {
          ticketsToHide.push(ticketId);
        }
      }
    }
  }


  if (ticketsToHide.length > 0) {
    const updatedCount = await supabaseBatchUpdate("QRKarte", ticketsToHide, {
      Hide: true,
      manualHide: false,
    });
  }

  return {
    hiddenCount: ticketsToHide.length,
    updatedIds: ticketsToHide,
  };
}

// ============================================
// SESSION
// ============================================

function getSession(): User | null {
  try {
    const stored = localStorage.getItem("etickets_session") || sessionStorage.getItem("etickets_session");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setSession(user: User, remember: boolean = true) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("etickets_session", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("etickets_session");
  sessionStorage.removeItem("etickets_session");
}

// ============================================
// AUTH CONTEXT
// ============================================

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getSession();
    console.log("Session restore:", stored);
    if (stored?.email && stored?.eventIds?.length) {
      setUser(stored);
    } else if (stored) {
      clearSession();
    }
    setIsLoading(false);
  }, []);

  const login = async (
    email: string,
    password: string,
    rememberMe = true,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log("Login attempt:", normalizedEmail);

      const organizers = await supabaseQuery(
        "Organizers",
        `email=eq.${encodeURIComponent(normalizedEmail)}&activeStatus=eq.true`,
      );

      if (!organizers.length) {
        return { success: false, error: "Email nije pronađen ili nalog nije aktivan." };
      }

      const authorizedOrgs = organizers.filter((o: any) => o.password === password);

      console.log("Total rows for email:", organizers.length);
      console.log("Rows with matching password:", authorizedOrgs.length);

      if (authorizedOrgs.length === 0) {
        return { success: false, error: "Pogrešna lozinka." };
      }

      const eventIds = authorizedOrgs.map((o: any) => o.eventId).filter(Boolean);

      if (!eventIds.length) {
        return { success: false, error: "Nema dodijeljenih događaja." };
      }

      const firstOrg = authorizedOrgs[0];
      const newUser: User = {
        email: firstOrg.email,
        role: firstOrg.role || "organizer",
        eventIds,
        organizerName: firstOrg.name || firstOrg.organizerName || firstOrg.email,
        permissions: firstOrg.permissions || [],
      };

      setUser(newUser);
      setSession(newUser, rememberMe);
      console.log("Login success, events:", eventIds);
      return { success: true };
    } catch (err: any) {
      console.error("Login error:", err);
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    console.log("Logging out...");
    setUser(null);
    clearSession();
  };

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

// ============================================
// DASHBOARD CONTEXT
// ============================================

interface DashboardContextType {
  eventsList: EventInfo[];
  events: Record<string, EventData>;
  selectedEventId: string | null;
  selectedEvent: EventData | null;
  isLoading: boolean;
  lastUpdate: Date | null;
  error: string | null;
  currency: string;
  exchangeRate: number | null;
  setSelectedEventId: (id: string) => void;
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [eventsList, setEventsList] = useState<EventInfo[]>([]);
  const [events, setEvents] = useState<Record<string, EventData>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("EUR");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.eventIds?.length) {
      console.log("No user or eventIds");
      return;
    }

    console.log("Loading events for user:", user.email, "eventIds:", user.eventIds);

    const loadEvents = async () => {
      try {
        const aboutEvents = await supabaseQuery("AboutEvents", `eventKey=in.(${user.eventIds.join(",")})`);

        console.log("AboutEvents raw data:", aboutEvents);

        const events: EventInfo[] = aboutEvents.map((e: any) => {
          const capacityString = e.capacity || "";
          const totalCapacity = getTotalCapacity(capacityString);

          let virmanFee = 0;
          if (e.description) {
            try {
              const desc = typeof e.description === "string" ? JSON.parse(e.description) : e.description;
              if (!Array.isArray(desc) && desc?.virmanFee) {
                virmanFee = parseFloat(desc.virmanFee) || 0;
              }
            } catch {}
          }

          return {
            eventId: e.eventKey,
            eventName: e.name,
            venue: e.venue,
            date: e.date,
            time: e.event_time,
            currency: e.currency || "EUR",
            capacity: capacityString,
            totalCapacity,
            serviceFeePercentage: parseFloat(e.serviceFeePercentage || "0"),
            pdvPercentage: parseFloat(e.pdvPercentage || "0"),
            biletarnicaFee: parseFloat(e.biletarnicaFee || "0"),
            virmanFee,
            onlineSkipRate: parseInt(e.online || "0"),
            biletarnicaSkipRate: parseInt(e.biletarnica || "0"),
          };
        });

        console.log("Events loaded:", events);

        setEventsList(events);

        if (events.length > 0 && !selectedEventId) {
          console.log("Auto-selecting first event:", events[0].eventId);
          setSelectedEventId(events[0].eventId);
        }
      } catch (err) {
        console.error("Error loading events:", err);
      }
    };

    loadEvents();
  }, [user?.eventIds?.join(",")]);

  useEffect(() => {
    if (!selectedEventId || !user?.eventIds?.length) {
      console.log("No selectedEventId or user");
      return;
    }

    console.log("Loading dashboard for event:", selectedEventId);
    setIsLoading(true);
    setError(null);

    const loadDashboard = async () => {
      try {
        const [allTickets, aboutEvents] = await Promise.all([
          supabaseQuery("QRKarte", `eventId=eq.${selectedEventId}`),
          supabaseQuery("AboutEvents", `eventKey=eq.${selectedEventId}`),
        ]);

        const eventInfo = aboutEvents[0];
        console.log("EventInfo:", {
          name: eventInfo?.name,
          online: eventInfo?.online,
          biletarnica: eventInfo?.biletarnica,
          capacity: eventInfo?.capacity?.substring(0, 50) + "...",
          allocations: eventInfo?.allocations, // DEBUG LOG
        });

        const serviceFeePercentage = parseFloat(eventInfo?.serviceFeePercentage || "0");
        const pdvPercentage = parseFloat(eventInfo?.pdvPercentage || "0");
        const biletarnicaFee = parseFloat(eventInfo?.biletarnicaFee || "0");

        let virmanFee = 0;
        if (eventInfo?.virmanFee) {
          virmanFee = parseFloat(eventInfo.virmanFee) || 0;
        } else if (eventInfo?.description) {
          try {
            const desc =
              typeof eventInfo.description === "string" ? JSON.parse(eventInfo.description) : eventInfo.description;
            if (!Array.isArray(desc) && desc?.virmanFee) {
              virmanFee = parseFloat(desc.virmanFee) || 0;
            }
          } catch {}
        }

        const onlineSkipRate = parseInt(eventInfo?.online || "0");
        const biletarnicaSkipRate = parseInt(eventInfo?.biletarnica || "0");

        const capacityString = eventInfo?.capacity || "";
        const capacityByCategory = parseCapacityString(capacityString);
        const totalCapacity = Object.values(capacityByCategory).reduce((sum, cap) => sum + cap, 0);

        const skipRateResult = await markTicketsAsHidden(allTickets, onlineSkipRate, biletarnicaSkipRate);

        let ticketsAfterSkipRate = allTickets;
        if (skipRateResult.hiddenCount > 0) {
          ticketsAfterSkipRate = await supabaseQuery("QRKarte", `eventId=eq.${selectedEventId}`);
        }

        // ═══════════════════════════════════════════════════════════
        // REZERVACIJE - NE ulaze u glavni obračun, ali se prikazuju u bukiranju
        // ═══════════════════════════════════════════════════════════
        const rezervacijaTickets = ticketsAfterSkipRate
          .filter((t: any) => isReservation(t) && !isTicketHidden(t))
          .map((row: any) => ({
            ticketId: row.ticketId || "",
            seatId: row.seatId || "",
            price: parseFloat(row.price || "0"),
            purchaseDate: row.Purchasedate || row.purchaseDate || "",
            purchaseTime: row.purchaseTime || "",
            salesChannel: "Rezervacija",
            city: row.city || row.customerCity || "",
            country: row.country || "",
            category: row.category || "",
            customerName: row.customerName || "",
          }));

        const visibleTickets = ticketsAfterSkipRate.filter((t: any) => {
          if (isTicketHidden(t)) return false;
          if (isReservation(t)) return false;
          if (isExcludedChannel(t)) return false;
          if (t.status === "refunded") return false;
          return true;
        });

        // ═══════════════════════════════════════════════════════════
        // SAVEZ/IGRACI KARTE - isključene iz prodaje, ali broje u kapacitet tribina
        // ═══════════════════════════════════════════════════════════
        const savezIgraciTicketsRaw: Ticket[] = ticketsAfterSkipRate
          .filter((t: any) => isExcludedChannel(t) && !isTicketHidden(t) && t.status !== "refunded")
          .map((row: any) => ({
            ticketId: row.ticketId || "",
            seatId: row.seatId || "",
            price: parseFloat(row.price || "0"),
            category: row.category || "",
            customerName: row.customerName || "",
            purchaseDate: row.Purchasedate || row.purchaseDate || "",
            purchaseTime: row.purchaseTime || "",
            salesChannel: normalizeSalesChannel(row.salesChannel),
            city: row.city || "",
            country: row.country || "",
          }));

        // ═══════════════════════════════════════════════════════════
        // GRATIS KARTE - price === 0, odvojene od plaćenih
        // ═══════════════════════════════════════════════════════════
        const gratisTicketsRaw = visibleTickets.filter((t: any) => parseFloat(t.price || "0") === 0);
        const paidTicketsRaw = visibleTickets.filter((t: any) => parseFloat(t.price || "0") > 0);

        console.log(
          `Filtriranje: ${ticketsAfterSkipRate.length} ukupno → ${visibleTickets.length} vidljivih (${paidTicketsRaw.length} plaćenih + ${gratisTicketsRaw.length} gratis, ${rezervacijaTickets.length} rezervacija isključeno)`,
        );

        // ═══════════════════════════════════════════════════════════
        // MAPIRANJE KARATA - SA CARD PODACIMA!
        // ═══════════════════════════════════════════════════════════
        const tickets = visibleTickets.map((row: any) => {
          const normalizedChannel = normalizeSalesChannel(row.salesChannel);
          const price = parseFloat(row.price || "0");
          const fees = calculateFees(
            price,
            serviceFeePercentage,
            pdvPercentage,
            normalizedChannel,
            biletarnicaFee,
            virmanFee,
          );

          return {
            ticketId: row.ticketId || "",
            seatId: row.seatId || "",
            price: fees.price,
            serviceFee: fees.serviceFee,
            pdvAmount: fees.pdvAmount,
            totalFee: fees.totalFee,
            finalAmount: fees.finalAmount,
            purchaseDate: row.Purchasedate || row.purchaseDate || "",
            purchaseTime: row.purchaseTime || "",
            salesChannel: normalizedChannel,
            city: row.city || row.customerCity || "",
            country: row.country || "",
            zip: row.zip || row.postalCode || "",
            category: row.category || "",
            hide: false,
            customerName: row.customerName || "",
            customerEmail: row["Customer Email"] || row.customerEmail || "",
            customerPhone: row.customerPhone || "",
            entrance: row.entrance || "",
            view: row.View || "",
            cardBrand: row.cardBrand || null,
            cardCountry: row.cardCountry || null,
            cardDescription: row.cardDescription || null,
            cardIssuer: row.cardIssuer || null,
            cardLast4: row.cardLast4 || null,
            cardIIN: row.cardIIN || null,
            cardBin: row.cardBin || null,
            cardFunding: row.cardFunding || null,
            cardNetwork: row.cardNetwork || null,
          };
        });

        // ═══════════════════════════════════════════════════════════
        // GRATIS KARTE - mapirane sa osnovnim podacima
        // ═══════════════════════════════════════════════════════════
        const gratisTickets: Ticket[] = gratisTicketsRaw.map((row: any) => ({
          ticketId: row.ticketId || "",
          seatId: row.seatId || "",
          price: row.price || 0,
          category: row.category || "",
          customerName: row.customerName || "",
          purchaseDate: row.Purchasedate || row.purchaseDate || "",
          purchaseTime: row.purchaseTime || "",
          salesChannel: normalizeSalesChannel(row.salesChannel),
          city: row.city || "",
          country: row.country || "",
        }));

        const hiddenCount = ticketsAfterSkipRate.filter((t: any) => isTicketHidden(t)).length;

        // ═══════════════════════════════════════════════════════════
        // ALOKACIJE - parsiranje iz AboutEvents.allocations
        // Supabase JSONB polje se automatski parsira, ali provjeravamo za svaki slučaj
        // ═══════════════════════════════════════════════════════════
        let allocations: any[] = [];
        if (eventInfo?.allocations) {
          if (typeof eventInfo.allocations === "string") {
            try {
              allocations = JSON.parse(eventInfo.allocations);
            } catch (e) {
              console.error("Error parsing allocations:", e);
              allocations = [];
            }
          } else if (Array.isArray(eventInfo.allocations)) {
            allocations = eventInfo.allocations;
          }
        }
        console.log("Parsed allocations:", allocations);

        const eventData: EventData = {
          eventId: selectedEventId,
          eventName: eventInfo?.name || "Event",
          venue: eventInfo?.venue || "",
          date: eventInfo?.date || "",
          time: eventInfo?.event_time || "",
          tickets,
          totalPrice: tickets.reduce((s: number, t: any) => s + t.price, 0),
          currency: eventInfo?.currency || "EUR",
          serviceFeePercentage,
          pdvPercentage,
          biletarnicaFee,
          virmanFee,
          capacity: capacityString,
          capacityByCategory,
          totalCapacity,
          onlineSkipRate,
          biletarnicaSkipRate,
          totalTicketsInDb: ticketsAfterSkipRate.length,
          hiddenTickets: hiddenCount,
          hiddenBySkipRate: skipRateResult.hiddenCount,
          // Rezervacije
          hasRezervacija: rezervacijaTickets.length > 0,
          rezervacijaCount: rezervacijaTickets.length,
          rezervacijaTickets,
          // ═══════════════════════════════════════════════════════════
          // GRATIS KARTE - nova polja
          // ═══════════════════════════════════════════════════════════
          gratisCount: gratisTickets.length,
          gratisTickets,
          paidTicketsCount: paidTicketsRaw.length,
          // ═══════════════════════════════════════════════════════════
          // SAVEZ/IGRACI KARTE - za kapacitet tribina
          // ═══════════════════════════════════════════════════════════
          savezIgraciTickets: savezIgraciTicketsRaw,
          // ═══════════════════════════════════════════════════════════
          // ALOKACIJE - iz AboutEvents.allocations polja
          // ═══════════════════════════════════════════════════════════
          allocations,
        };

        console.log("Dashboard loaded:", {
          eventName: eventData.eventName,
          visibleTickets: tickets.length,
          paidTickets: paidTicketsRaw.length,
          gratisTickets: gratisTickets.length,
          hiddenTickets: hiddenCount,
          hiddenBySkipRateThisRun: skipRateResult.hiddenCount,
          rezervacijaCount: rezervacijaTickets.length,
          totalCapacity,
          totalPrice: eventData.totalPrice,
          allocationsCount: allocations.length, // DEBUG
        });

        setEvents({ [selectedEventId]: eventData });
        setLastUpdate(new Date());
        setCurrency(eventData.currency);
      } catch (err: any) {
        console.error("Error loading dashboard:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();

    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  useEffect(() => {
    if (currency === "EUR") {
      setExchangeRate(null);
      return;
    }
    const rates: Record<string, number> = { RSD: 0.0085, DOP: 0.0165, MKD: 0.016, BAM: 0.51, HRK: 0.13, USD: 0.92 };
    fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`)
      .then((res) => res.json())
      .then((data) => setExchangeRate(data.rates?.EUR || rates[currency] || null))
      .catch(() => setExchangeRate(rates[currency] || null));
  }, [currency]);

  const selectedEvent = events[selectedEventId || ""] || null;

  const refresh = async () => {
    if (selectedEventId) {
      const current = selectedEventId;
      setSelectedEventId("");
      setTimeout(() => setSelectedEventId(current), 100);
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        eventsList,
        events,
        selectedEventId,
        selectedEvent,
        isLoading,
        lastUpdate,
        error,
        currency,
        exchangeRate,
        setSelectedEventId,
        refresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}
