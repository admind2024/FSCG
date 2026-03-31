// src/lib/dashboardApi.ts
// ISPRAVLJENI API - SVA POLJA PRISUTNA

import { EventInfo, EventData, Ticket, Deduction } from "@/types/dashboard";
import {
  normalizeSalesChannel,
  calculateFees,
  parseCapacityString,
  getTotalCapacity,
  isTicketHidden,
} from "./dashboard-utils";
import { supabaseQuery } from "./supabaseConfig";

// ============================================
// LOAD EVENTS LIST
// ============================================

export async function loadEventsList(eventIds: string[]): Promise<EventInfo[]> {
  if (!eventIds.length) return [];

  const aboutEvents = await supabaseQuery("AboutEvents", `eventKey=in.(${eventIds.join(",")})`);

  return aboutEvents.map((e: any) => {
    const capacityString = e.capacity || "";
    const totalCapacity = getTotalCapacity(capacityString);

    // Parse virmanFee from description if not direct field
    let virmanFee = 0;
    if (e.virmanFee) {
      virmanFee = parseFloat(e.virmanFee) || 0;
    } else if (e.description) {
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
      venue: e.venue || "",
      date: e.date || "",
      time: e.event_time || "",
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
}

// ============================================
// LOAD EVENT DATA (DASHBOARD)
// ============================================

export async function loadEventData(eventId: string): Promise<EventData | null> {
  try {
    // Load tickets and event info in parallel
    const [allTickets, aboutEvents] = await Promise.all([
      supabaseQuery("QRKarte", `eventId=eq.${eventId}`),
      supabaseQuery("AboutEvents", `eventKey=eq.${eventId}`),
    ]);

    const eventInfo = aboutEvents[0];
    if (!eventInfo) {
      console.error("Event not found:", eventId);
      return null;
    }

    // Fee data
    const serviceFeePercentage = parseFloat(eventInfo.serviceFeePercentage || "0");
    const pdvPercentage = parseFloat(eventInfo.pdvPercentage || "0");
    const biletarnicaFee = parseFloat(eventInfo.biletarnicaFee || "0");

    let virmanFee = 0;
    if (eventInfo.virmanFee) {
      virmanFee = parseFloat(eventInfo.virmanFee) || 0;
    } else if (eventInfo.description) {
      try {
        const desc =
          typeof eventInfo.description === "string" ? JSON.parse(eventInfo.description) : eventInfo.description;
        if (!Array.isArray(desc) && desc?.virmanFee) {
          virmanFee = parseFloat(desc.virmanFee) || 0;
        }
      } catch {}
    }

    // Skip rates
    const onlineSkipRate = parseInt(eventInfo.online || "0");
    const biletarnicaSkipRate = parseInt(eventInfo.biletarnica || "0");

    // Capacity
    const capacityString = eventInfo.capacity || "";
    const capacityByCategory = parseCapacityString(capacityString);
    const totalCapacity = Object.values(capacityByCategory).reduce((sum, cap) => sum + cap, 0);

    // Filter visible tickets
    const visibleTickets = allTickets.filter((t: any) => {
      if (isTicketHidden(t)) return false;
      if (t.status === "refunded") return false;
      // Skip reservations from main list
      const channel = (t.salesChannel || "").toLowerCase();
      if (channel === "rezervacija" || channel.includes("bukiranje")) return false;
      // Exclude Savez/Igraci channels, customerName "IGRACI", and "Nedostupno" category
      if (channel === "savez" || channel === "igraci") return false;
      if ((t.customerName || "").trim().toUpperCase() === "IGRACI") return false;
      if ((t.category || "").toLowerCase() === "nedostupno") return false;
      return true;
    });

    // Process tickets with fee calculation
    const tickets: Ticket[] = visibleTickets.map((row: any) => {
      const normalizedChannel = normalizeSalesChannel(row.salesChannel);
      // KORISTI price, NE totalPrice!
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
      };
    });

    // Rezervacija tickets
    const rezervacijaTickets: Ticket[] = allTickets
      .filter((t: any) => {
        const channel = (t.salesChannel || "").toLowerCase();
        return (channel === "rezervacija" || channel.includes("bukiranje")) && !isTicketHidden(t);
      })
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

    // Hidden count
    const hiddenCount = allTickets.filter((t: any) => isTicketHidden(t)).length;

    return {
      eventId,
      eventName: eventInfo.name || "Event",
      venue: eventInfo.venue || "",
      date: eventInfo.date || "",
      time: eventInfo.event_time || "",
      tickets,
      totalPrice: tickets.reduce((s, t) => s + t.price, 0),
      currency: eventInfo.currency || "EUR",
      serviceFeePercentage,
      pdvPercentage,
      biletarnicaFee,
      virmanFee,
      capacity: capacityString,
      capacityByCategory,
      totalCapacity,
      onlineSkipRate,
      biletarnicaSkipRate,
      totalTicketsInDb: allTickets.length,
      hiddenTickets: hiddenCount,
      hiddenBySkipRate: 0,
      hasRezervacija: rezervacijaTickets.length > 0,
      rezervacijaCount: rezervacijaTickets.length,
      rezervacijaTickets,
    };
  } catch (error) {
    console.error("Error loading event data:", error);
    return null;
  }
}

// ============================================
// DEDUCTIONS API
// ============================================

export async function loadDeductions(eventId: string, userEmail: string): Promise<Deduction[]> {
  try {
    const deductions = await supabaseQuery("Deductions", `eventId=eq.${encodeURIComponent(eventId)}`);

    return deductions.map((d: any) => ({
      id: d.id,
      eventId: d.eventId,
      name: d.name || d.description || "Odbitak",
      description: d.description || "",
      amount: parseFloat(d.amount || "0"),
      type: d.type || "",
      date: d.date || "",
    }));
  } catch (error) {
    console.error("Error loading deductions:", error);
    return [];
  }
}

// ============================================
// ORGANIZERS / AUTH API
// ============================================

export async function checkOrganizer(
  email: string,
  password: string,
): Promise<{
  success: boolean;
  user?: any;
  eventIds?: string[];
  error?: string;
}> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const organizers = await supabaseQuery(
      "Organizers",
      `email=eq.${encodeURIComponent(normalizedEmail)}&activeStatus=eq.true`,
    );

    if (!organizers.length) {
      return { success: false, error: "Email nije pronađen ili nalog nije aktivan." };
    }

    const authorizedOrgs = organizers.filter((o: any) => o.password === password);

    if (authorizedOrgs.length === 0) {
      return { success: false, error: "Pogrešna lozinka." };
    }

    const eventIds = authorizedOrgs.map((o: any) => o.eventId).filter(Boolean);

    if (!eventIds.length) {
      return { success: false, error: "Nema dodijeljenih događaja." };
    }

    const firstOrg = authorizedOrgs[0];
    return {
      success: true,
      user: {
        email: firstOrg.email,
        role: firstOrg.role || "organizer",
        organizerName: firstOrg.name || firstOrg.organizerName || firstOrg.email,
        permissions: firstOrg.permissions || [],
      },
      eventIds,
    };
  } catch (error: any) {
    console.error("Auth error:", error);
    return { success: false, error: error.message };
  }
}
