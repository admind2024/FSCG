// src/types/dashboard.ts
// KOMPLETNA DEFINICIJA TIPOVA - USKLAĐENO SA KODOM

// ============================================
// USER & AUTH
// ============================================

export interface User {
  email: string;
  role: string;
  eventIds: string[];
  organizerName?: string;
  permissions?: string[];
}

// ============================================
// EVENT TYPES
// ============================================

export interface EventInfo {
  eventId: string;
  eventName: string;
  venue?: string;
  date?: string;
  time?: string;
  currency: string;
  capacity: string;
  totalCapacity: number;
  serviceFeePercentage: number;
  pdvPercentage: number;
  biletarnicaFee: number;
  virmanFee: number;
  onlineSkipRate: number;
  biletarnicaSkipRate: number;
}

export interface EventData {
  eventId: string;
  eventName: string;
  venue: string;
  date: string;
  time: string;
  tickets: Ticket[];
  totalPrice: number;
  currency: string;
  serviceFeePercentage: number;
  pdvPercentage: number;
  biletarnicaFee: number;
  virmanFee: number;
  capacity: string;
  capacityByCategory: Record<string, number>;
  totalCapacity: number;
  onlineSkipRate: number;
  biletarnicaSkipRate: number;
  totalTicketsInDb?: number;
  hiddenTickets?: number;
  hiddenBySkipRate?: number;
  hasRezervacija?: boolean;
  rezervacijaCount?: number;
  rezervacijaTickets?: Ticket[];
  // Gratis karte
  gratisCount?: number;
  gratisTickets?: Ticket[];
  paidTicketsCount?: number;
  // Alokacije
  allocations?: Allocation[];
  // Savez/Igraci karte - isključene iz prodaje, ali broje u kapacitet
  savezIgraciTickets?: Ticket[];
}

// ============================================
// ALLOCATION TYPES
// ============================================

export interface Allocation {
  id: string;
  type: "reserved" | "external_channel" | "internal_use" | "blocked" | "complimentary";
  category: string;
  quantity: number;
  channel?: string;
  notes?: string;
  created_at: string;
}

// ============================================
// TICKET TYPES
// ============================================

export interface Ticket {
  ticketId: string;
  seatId: string;
  price: number;
  serviceFee?: number;
  pdvAmount?: number;
  totalFee?: number;
  finalAmount?: number;
  purchaseDate: string;
  purchaseTime: string;
  salesChannel: string;
  city: string;
  country: string;
  zip?: string;
  category: string;
  hide?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  entrance?: string;
  view?: string;
}

// ============================================
// STATISTICS TYPES
// ============================================

// Channel breakdown za DailyStats
export interface ChannelStats {
  count: number;
  amount: number;
  fees: number;
}

export interface DailyStats {
  date: string;
  total: number;
  totalAmount: number;
  online: ChannelStats;
  biletarnica: ChannelStats;
  virman: ChannelStats;
  kartica: ChannelStats;
}

export interface CategoryStats {
  category: string;
  count: number;
  capacity: number;
  fillPercentage: number;
  online: number;
  biletarnica: number;
  virman: number;
  kartica: number;
  amount: number;
  totalAmount: number;
  percentage: number;
  onlineCount: number;
  biletarnicaCount: number;
  virmanCount: number;
  karticaCount: number;
}

export interface LocationStats {
  location: string;
  count: number;
  amount: number;
  percentage: number; // NUMBER, ne string!
}

export interface DailyCategoryStats {
  date: string;
  category: string;
  total: number;
  amount: number;
  online: number;
  biletarnica: number;
  virman: number;
  kartica: number;
}

// ============================================
// DEDUCTION TYPES
// ============================================

export interface Deduction {
  id?: string;
  eventId?: string;
  name: string;
  description?: string;
  amount: number;
  type?: string;
  date?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DeductionsResponse {
  success: boolean;
  deductions: Deduction[];
  error?: string;
}

// ============================================
// CHART / UI TYPES
// ============================================

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface SalesChannelBreakdown {
  channel: string;
  count: number;
  amount: number;
  percentage: number;
  feePercent: number;
  serviceFee: number;
  pdvOnFee: number;
  totalFee: number;
}

// ============================================
// FILTER / QUERY TYPES
// ============================================

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface FilterOptions {
  dateRange?: DateRange;
  salesChannel?: string;
  category?: string;
  city?: string;
  country?: string;
}
