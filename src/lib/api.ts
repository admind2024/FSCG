// src/lib/api.ts
// API HELPER FUNKCIJE

import { Deduction, DeductionsResponse } from "@/types/dashboard";

const SUPABASE_URL = "https://hvpytasddzeprgqkwlbu.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cHl0YXNkZHplcHJncWt3bGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDMyODQsImV4cCI6MjA4MjE3OTI4NH0.R1wPgBpyO7MHs0YL_pW0XBKkX8QweJ8MuhHUpuDSuKk";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export const api = {
  /**
   * Get deductions for an event
   */
  async getDeductions(eventId: string, userEmail: string): Promise<DeductionsResponse> {
    try {
      const url = `${SUPABASE_URL}/rest/v1/Deductions?eventId=eq.${encodeURIComponent(eventId)}`;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        return { success: false, deductions: [], error: response.statusText };
      }

      const data = await response.json();

      const deductions: Deduction[] = data.map((d: any) => ({
        id: d.id,
        eventId: d.eventId,
        name: d.name || d.description || "Odbitak",
        description: d.description || "",
        amount: parseFloat(d.amount || "0"),
        type: d.type || "",
        date: d.date || "",
      }));

      return { success: true, deductions };
    } catch (error: any) {
      console.error("Error fetching deductions:", error);
      return { success: false, deductions: [], error: error.message };
    }
  },

  /**
   * Get exchange rate for currency
   */
  async getExchangeRate(currency: string): Promise<number | null> {
    if (currency === "EUR") return null;

    const fallbackRates: Record<string, number> = {
      RSD: 0.0085,
      DOP: 0.0165,
      MKD: 0.016,
      BAM: 0.51,
      HRK: 0.13,
      USD: 0.92,
    };

    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
      const data = await response.json();
      return data.rates?.EUR || fallbackRates[currency] || null;
    } catch {
      return fallbackRates[currency] || null;
    }
  },

  /**
   * Sync tickets from Wix to Supabase
   */
  async syncTickets(eventId: string): Promise<{ success: boolean; synced?: number; error?: string }> {
    try {
      // This would call your Wix HTTP function
      // For now, return a placeholder
      return { success: true, synced: 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export default api;
