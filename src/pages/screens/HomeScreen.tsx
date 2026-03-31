import { useState, useEffect } from "react";
import { useDashboard, useAuth } from "@/contexts/DashboardContext";
import { filterVisibleTickets, normalizeSalesChannel, getTotalCapacity, formatCurrency } from "@/lib/dashboard-utils";
import { isGradskiStadion, getTribuneCapacities } from "@/lib/stadium-config";
import { Deduction } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Ticket,
  DollarSign,
  Wallet,
  Globe,
  MapPin,
  Building,
  CreditCard,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Printer,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { SUPABASE_URL, supabaseHeaders } from "@/lib/supabaseConfig";

async function fetchDeductionsFromSupabase(eventId: string): Promise<Deduction[]> {
  try {
    // Tabela EventDeductions sa eventId filterom
    const url = `${SUPABASE_URL}/rest/v1/EventDeductions?eventId=eq.${encodeURIComponent(eventId)}&select=id,eventId,deductions,created_at&limit=1`;
    console.log("Fetching deductions from Supabase:", url);

    const response = await fetch(url, { headers: supabaseHeaders });

    if (!response.ok) {
      console.error("Supabase deductions error:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log("Raw deductions data:", data);

    if (!data || data.length === 0) {
      return [];
    }

    // Uzmi prvi red (trebalo bi biti samo jedan po eventId)
    const row = data[0];

    // deductions kolona je JSON string sa nizom: [{"name": "...", "amount": ...}, ...]
    let deductionsArray: Deduction[] = [];

    if (row.deductions) {
      try {
        // Parsiraj JSON string
        const parsed = typeof row.deductions === "string" ? JSON.parse(row.deductions) : row.deductions;

        if (Array.isArray(parsed)) {
          deductionsArray = parsed
            .filter((item: any) => item.amount > 0) // Filtriraj samo one sa iznosom > 0
            .map((item: any, index: number) => ({
              id: `${row.id}-${index}`,
              eventId: row.eventId || eventId,
              name: item.name || "Nepoznat odbitak",
              amount: parseFloat(item.amount) || 0,
              description: item.description || "",
              createdAt: row.created_at || "",
            }));
        }
      } catch (parseError) {
        console.error("Error parsing deductions JSON:", parseError);
      }
    }

    console.log("Parsed deductions:", deductionsArray);
    return deductionsArray;
  } catch (error) {
    console.error("Error fetching deductions:", error);
    return [];
  }
}

interface ChannelBreakdown {
  count: number;
  amount: number;
  feePercent: number;
  pdvPercent: number;
  serviceFee: number;
  pdvOnFee: number;
  totalFee: number;
  perTicketFee?: number;
  perTicketFeeTotal?: number;
}

export default function HomeScreen() {
  const { selectedEvent, selectedEventId, isLoading, exchangeRate } = useDashboard();
  const { user } = useAuth();
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [deductionsLoading, setDeductionsLoading] = useState(false);

  useEffect(() => {
    const loadDeductions = async () => {
      const eventId = selectedEvent?.eventId || selectedEventId;

      console.log("Loading deductions for eventId:", eventId);

      if (!eventId) {
        console.log("Missing eventId, skipping deductions load");
        setDeductions([]);
        return;
      }

      setDeductionsLoading(true);
      try {
        const fetchedDeductions = await fetchDeductionsFromSupabase(eventId);
        setDeductions(fetchedDeductions);
      } catch (error) {
        console.error("Error loading deductions:", error);
        setDeductions([]);
      } finally {
        setDeductionsLoading(false);
      }
    };

    loadDeductions();
  }, [selectedEvent?.eventId, selectedEventId]);

  if (isLoading || !selectedEvent) {
    return <LoadingSkeleton />;
  }

  const tickets = filterVisibleTickets(selectedEvent.tickets);
  const venue = selectedEvent.venue || "";
  const isStadion = isGradskiStadion(venue);
  const totalCapacity = isStadion
    ? Object.values(getTribuneCapacities()).reduce((s, v) => s + v, 0)
    : getTotalCapacity(selectedEvent.capacity);
  const currency = selectedEvent.currency || "EUR";

  // ═══════════════════════════════════════════════════════════════
  // PRODATO vs SAVEZ KARTE
  // Savez = Savez/Igraci kanali + sve gratis (price=0)
  // Prodato = samo naša plaćena prodaja
  // ═══════════════════════════════════════════════════════════════
  const savezIgraciTickets = (selectedEvent as any).savezIgraciTickets || [];
  const paidTickets = tickets.filter((t) => {
    const ch = (t.salesChannel || "").toLowerCase();
    return t.price > 0 && ch !== "savez" && ch !== "igraci";
  });
  const savezCount = savezIgraciTickets.length + tickets.filter((t) => {
    const ch = (t.salesChannel || "").toLowerCase();
    return t.price === 0 && ch !== "savez" && ch !== "igraci";
  }).length;
  const savezGratis = savezIgraciTickets.filter((t: any) => Number(t.price) === 0).length + tickets.filter((t) => {
    const ch = (t.salesChannel || "").toLowerCase();
    return t.price === 0 && ch !== "savez" && ch !== "igraci";
  }).length;
  const savezPaid = savezCount - savezGratis;
  const totalSold = paidTickets.length;

  const fillPercentage = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

  const channelTotals = {
    online: { count: 0, amount: 0 },
    biletarnica: { count: 0, amount: 0 },
    virman: { count: 0, amount: 0 },
    kartica: { count: 0, amount: 0 },
  };

  let totalRevenue = 0;

  // Samo plaćene karte ulaze u obračun
  paidTickets.forEach((ticket) => {
    const channel = normalizeSalesChannel(ticket.salesChannel);
    totalRevenue += ticket.price;

    const key =
      channel === "Online"
        ? "online"
        : channel === "Biletarnica"
          ? "biletarnica"
          : channel === "Virman"
            ? "virman"
            : "kartica";

    channelTotals[key].count++;
    channelTotals[key].amount += ticket.price;
  });

  // ═══════════════════════════════════════════════════════════
  // DVA RAZLIČITA PDV-a:
  // 1. PDV na prodaju karata (crnogorski PDV) = FIKSNO 15%
  // 2. PDV na E-Tickets naknadu = iz baze ili default 21%
  // ═══════════════════════════════════════════════════════════
  const pdvPercentRevenue = 15; // PDV na prodaju karata - crnogorski PDV
  const pdvPercentFee = selectedEvent.pdvPercentage || 21; // PDV na E-Tickets naknadu

  const pdvCoefficient = pdvPercentRevenue / (100 + pdvPercentRevenue);
  const pdvAmount = totalRevenue * pdvCoefficient;
  const baseAmount = totalRevenue - pdvAmount;

  const onlineServiceFee = channelTotals.online.amount * (selectedEvent.serviceFeePercentage / 100);
  const onlinePdvOnFee = onlineServiceFee * (pdvPercentFee / 100);
  const onlineBreakdown: ChannelBreakdown = {
    count: channelTotals.online.count,
    amount: channelTotals.online.amount,
    feePercent: selectedEvent.serviceFeePercentage,
    pdvPercent: pdvPercentFee,
    serviceFee: onlineServiceFee,
    pdvOnFee: onlinePdvOnFee,
    totalFee: onlineServiceFee + onlinePdvOnFee,
  };

  const biletarnicaServiceFee = channelTotals.biletarnica.amount * (selectedEvent.biletarnicaFee / 100);
  const biletarnicaPdvOnFee = biletarnicaServiceFee * (pdvPercentFee / 100);
  const biletarnicaBreakdown: ChannelBreakdown = {
    count: channelTotals.biletarnica.count,
    amount: channelTotals.biletarnica.amount,
    feePercent: selectedEvent.biletarnicaFee,
    pdvPercent: pdvPercentFee,
    serviceFee: biletarnicaServiceFee,
    pdvOnFee: biletarnicaPdvOnFee,
    totalFee: biletarnicaServiceFee + biletarnicaPdvOnFee,
  };

  const effectiveVirmanFee = selectedEvent.virmanFee || selectedEvent.serviceFeePercentage;
  const virmanServiceFee = channelTotals.virman.amount * (effectiveVirmanFee / 100);
  const virmanPdvOnFee = virmanServiceFee * (pdvPercentFee / 100);
  const virmanBreakdown: ChannelBreakdown = {
    count: channelTotals.virman.count,
    amount: channelTotals.virman.amount,
    feePercent: effectiveVirmanFee,
    pdvPercent: pdvPercentFee,
    serviceFee: virmanServiceFee,
    pdvOnFee: virmanPdvOnFee,
    totalFee: virmanServiceFee + virmanPdvOnFee,
  };

  const karticaServiceFee = channelTotals.kartica.amount * (selectedEvent.biletarnicaFee / 100);
  const karticaPdvOnFee = karticaServiceFee * (pdvPercentFee / 100);
  const karticaBreakdown: ChannelBreakdown = {
    count: channelTotals.kartica.count,
    amount: channelTotals.kartica.amount,
    feePercent: selectedEvent.biletarnicaFee,
    pdvPercent: pdvPercentFee,
    serviceFee: karticaServiceFee,
    pdvOnFee: karticaPdvOnFee,
    totalFee: karticaServiceFee + karticaPdvOnFee,
  };

  const eTicketsFee =
    onlineBreakdown.totalFee + biletarnicaBreakdown.totalFee + virmanBreakdown.totalFee + karticaBreakdown.totalFee;
  const forPayout = totalRevenue - eTicketsFee;

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const finalPayout = forPayout - totalDeductions;
  const hasDeductions = deductions.length > 0;

  const getFillColor = (percentage: number) => {
    if (percentage < 50) return "bg-emerald-500";
    if (percentage < 70) return "bg-amber-500";
    if (percentage < 90) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 animate-slide-up">
      {/* DESKTOP: Two-column layout with main stats left, summary right */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Left Column - Main Stats (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-3 md:space-y-4">
          {/* Row 1: Main Stats - 2x2 on mobile, 4 columns on tablet+ */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* Ukupno Prodato */}
            <div className="rounded-2xl p-3 md:p-4 bg-white dark:bg-card border border-gray-100 dark:border-border shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prodato</span>
                <div className="w-7 h-7 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
                  <Ticket className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-3xl md:text-4xl font-black text-foreground leading-none">{totalSold}</p>
              <p className="text-[11px] text-muted-foreground mt-1">od {totalCapacity} mesta</p>
              <div className="mt-2.5">
                <Progress value={fillPercentage} className={`h-1.5 ${getFillColor(fillPercentage)}`} />
                <p className="text-[11px] mt-1 font-semibold text-muted-foreground">{fillPercentage.toFixed(1)}% popunjeno</p>
              </div>
            </div>

            {/* Ukupan Prihod */}
            <div className="rounded-2xl p-3 md:p-4 bg-white dark:bg-card border border-gray-100 dark:border-border shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prihod</span>
                <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                  <DollarSign className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-foreground leading-none">{formatCurrency(totalRevenue, currency, exchangeRate)}</p>
              <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                <p>Osnovica: <span className="font-semibold text-foreground">{formatCurrency(baseAmount, currency, exchangeRate, false)}</span></p>
                <p>PDV ({pdvPercentRevenue}%): <span className="font-semibold text-foreground">{formatCurrency(pdvAmount, currency, exchangeRate, false)}</span></p>
              </div>
            </div>

            {/* E-Tickets Fee */}
            <div className="rounded-2xl p-3 md:p-4 bg-white dark:bg-card border border-gray-100 dark:border-border shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">E-Tickets Fee</span>
                <div className="w-7 h-7 rounded-xl bg-pink-500 flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-foreground leading-none">{formatCurrency(eTicketsFee, currency, exchangeRate)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">naknada e-tickets platforme</p>
            </div>

            {/* Za Isplatu */}
            <div className={`rounded-2xl p-3 md:p-4 shadow-md ${hasDeductions ? "ring-2 ring-red-300" : ""}`} style={{background: "linear-gradient(135deg, #C8102E 0%, #9b0c24 100%)"}}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-semibold text-red-100 uppercase tracking-wider">
                  Za Isplatu {hasDeductions ? "(sa odbicima)" : ""}
                </span>
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-white leading-none">
                <AnimatedNumber
                  value={hasDeductions ? finalPayout : forPayout}
                  formatter={(v) => formatCurrency(v, currency, exchangeRate)}
                  duration={600}
                />
              </p>
              <p className="text-[11px] text-red-100 mt-1">finalni iznos za organizatora</p>
            </div>
          </div>

          {/* Savez Karte - samo ako ima */}
          {savezCount > 0 && (
            <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm border-l-4 border-l-amber-500">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-muted-foreground font-medium">Savez</p>
                      <p className="text-2xl font-bold text-amber-600">{savezCount}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-600 font-medium">{savezGratis} gratis / {savezPaid} sa cijenom</p>
                    <p className="text-xs text-gray-400">ne ulaze u prodaju</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Channel Summary (1/3 width on desktop) */}
        <div className="mt-3 lg:mt-0">
          <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm h-full">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-muted-foreground">Prodaja po Kanalima</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {/* Mobile: 4 columns, Desktop: stacked list */}
              <div className="grid grid-cols-4 lg:grid-cols-1 gap-2 lg:gap-3">
                <div className="flex flex-col items-center lg:flex-row lg:items-center lg:justify-between p-2 lg:p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-gray-700 dark:text-muted-foreground">Online</span>
                  </div>
                  <div className="text-center lg:text-right mt-1 lg:mt-0">
                    <p className="text-[10px] lg:hidden text-gray-600 dark:text-muted-foreground font-medium">Online</p>
                    <p className="text-sm lg:text-lg font-bold text-gray-900 dark:text-foreground">{onlineBreakdown.count}</p>
                    <p className="text-[10px] lg:text-xs text-gray-500 dark:text-muted-foreground">{formatCurrency(onlineBreakdown.amount, currency, exchangeRate, false)}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center lg:flex-row lg:items-center lg:justify-between p-2 lg:p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-gray-700 dark:text-muted-foreground">Biletarnica</span>
                  </div>
                  <div className="text-center lg:text-right mt-1 lg:mt-0">
                    <p className="text-[10px] lg:hidden text-gray-600 dark:text-muted-foreground font-medium">Bilet.</p>
                    <p className="text-sm lg:text-lg font-bold text-gray-900 dark:text-foreground">{biletarnicaBreakdown.count}</p>
                    <p className="text-[10px] lg:text-xs text-gray-500 dark:text-muted-foreground">{formatCurrency(biletarnicaBreakdown.amount, currency, exchangeRate, false)}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center lg:flex-row lg:items-center lg:justify-between p-2 lg:p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-gray-700 dark:text-muted-foreground">Virman</span>
                  </div>
                  <div className="text-center lg:text-right mt-1 lg:mt-0">
                    <p className="text-[10px] lg:hidden text-gray-600 dark:text-muted-foreground font-medium">Virman</p>
                    <p className="text-sm lg:text-lg font-bold text-gray-900 dark:text-foreground">{virmanBreakdown.count}</p>
                    <p className="text-[10px] lg:text-xs text-gray-500 dark:text-muted-foreground">{formatCurrency(virmanBreakdown.amount, currency, exchangeRate, false)}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center lg:flex-row lg:items-center lg:justify-between p-2 lg:p-3 rounded-lg bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-gray-700 dark:text-muted-foreground">Kartica</span>
                  </div>
                  <div className="text-center lg:text-right mt-1 lg:mt-0">
                    <p className="text-[10px] lg:hidden text-gray-600 dark:text-muted-foreground font-medium">Kartica</p>
                    <p className="text-sm lg:text-lg font-bold text-gray-900 dark:text-foreground">{karticaBreakdown.count}</p>
                    <p className="text-[10px] lg:text-xs text-gray-500 dark:text-muted-foreground">{formatCurrency(karticaBreakdown.amount, currency, exchangeRate, false)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3: Detailed Channel Breakdown - 2 columns on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {/* Online */}
        <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm md:shadow-md border-t-4 border-t-indigo-500 md:hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                <Globe className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
              </div>
              <span className="font-bold text-sm md:text-base text-gray-900 dark:text-foreground">Online prodaja</span>
            </div>
            <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Broj karata:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">{onlineBreakdown.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Ukupna prodaja:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(onlineBreakdown.amount, currency, exchangeRate, false)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">
                  Naknada ({onlineBreakdown.feePercent}% + {pdvPercentFee}% PDV):
                </span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(onlineBreakdown.totalFee, currency, exchangeRate, false)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Biletarnica */}
        <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm md:shadow-md border-t-4 border-t-pink-500 md:hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-pink-100 dark:bg-pink-500/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-pink-600" />
              </div>
              <span className="font-bold text-sm md:text-base text-gray-900 dark:text-foreground">Biletarnica</span>
            </div>
            <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Broj karata:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">{biletarnicaBreakdown.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Ukupna prodaja:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(biletarnicaBreakdown.amount, currency, exchangeRate, false)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">
                  Naknada ({biletarnicaBreakdown.feePercent}% + {pdvPercentFee}% PDV):
                </span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(biletarnicaBreakdown.totalFee, currency, exchangeRate, false)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Virman */}
        <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm md:shadow-md border-t-4 border-t-sky-500 md:hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center">
                <Building className="w-4 h-4 md:w-5 md:h-5 text-sky-600" />
              </div>
              <span className="font-bold text-sm md:text-base text-gray-900 dark:text-foreground">Virman</span>
            </div>
            <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Broj karata:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">{virmanBreakdown.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Ukupna prodaja:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(virmanBreakdown.amount, currency, exchangeRate, false)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">
                  Naknada ({virmanBreakdown.feePercent}% + {pdvPercentFee}% PDV):
                </span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(virmanBreakdown.totalFee, currency, exchangeRate, false)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kartica */}
        <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm md:shadow-md border-t-4 border-t-amber-500 md:hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
              </div>
              <span className="font-bold text-sm md:text-base text-gray-900 dark:text-foreground">Kartica</span>
            </div>
            <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Broj karata:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">{karticaBreakdown.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">Ukupna prodaja:</span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(karticaBreakdown.amount, currency, exchangeRate, false)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-muted-foreground">
                  Naknada ({karticaBreakdown.feePercent}% + {pdvPercentFee}% PDV):
                </span>
                <span className="font-bold text-gray-900 dark:text-foreground">
                  {formatCurrency(karticaBreakdown.totalFee, currency, exchangeRate, false)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Deductions & Final Payout Section */}
      {(() => {
        const handlePrintReport = () => {
          const currentDate = new Date().toLocaleDateString("sr-Latn-ME", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });

          const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Finansijski Izvještaj - ${selectedEvent.eventName}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px 40px; max-width: 900px; margin: 0 auto; color: #333; font-size: 12px; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #0047CC; }
                .company-block { text-align: left; }
                .company { font-size: 16px; font-weight: bold; color: #0047CC; margin-bottom: 4px; }
                .company-info { font-size: 10px; color: #666; line-height: 1.5; }
                .report-block { text-align: right; }
                .title { font-size: 18px; font-weight: bold; color: #0047CC; margin-bottom: 8px; }
                .event-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
                .report-date { font-size: 11px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { padding: 8px 10px; text-align: left; border: 1px solid #ddd; }
                th { background: #f8f9fa; font-weight: 600; color: #333; font-size: 11px; }
                td { font-size: 11px; }
                td.right { text-align: right; }
                td.bold { font-weight: 600; }
                td.negative { color: #dc2626; }
                td.positive { color: #059669; }
                td.purple { color: #7c3aed; }
                .section-title { font-size: 12px; font-weight: bold; color: #0047CC; margin: 20px 0 8px 0; padding-bottom: 5px; border-bottom: 1px solid #0047CC; }
                .summary-row { background: #f0f7ff; }
                .summary-row td { font-weight: 600; }
                .gratis-row { background: #faf5ff; }
                .gratis-row td { color: #7c3aed; }
                .final-box { background: #059669; color: white; padding: 15px 20px; margin: 20px 0; display: flex; justify-content: space-between; align-items: center; }
                .final-label { font-size: 13px; }
                .final-amount { font-size: 24px; font-weight: bold; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
                .signature-line { text-align: center; width: 180px; }
                .signature-line .line { border-top: 1px solid #333; margin-bottom: 5px; }
                .signature-line .label { font-size: 10px; color: #666; }
                .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                @media print { body { padding: 15px; } }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="company-block">
                  <div class="company">RAKUNAT DOO</div>
                  <div class="company-info">
                    PIB: 03145280<br>
                    PDV: 40/31-03142-2<br>
                    Ž.R.: 510-213582-76, CKB<br>
                    E-mail: info@rakunat.com
                  </div>
                </div>
                <div class="report-block">
                  <div class="title">IZVJEŠTAJ O ISPLATAMA</div>
                  <div class="event-name">${selectedEvent.eventName}</div>
                  <div class="report-date">Datum: ${currentDate}</div>
                </div>
              </div>
              
              <div class="section-title">FINANSIJSKI PREGLED</div>
              <table>
                <tr>
                  <td>Ukupna prodaja (${totalSold} karata)</td>
                  <td class="right bold">${formatCurrency(totalRevenue, currency, null, false)}</td>
                </tr>
                ${savezCount > 0 ? `<tr class="gratis-row"><td>Savez karte (${savezGratis} gratis / ${savezPaid} sa cijenom)</td><td class="right purple">${savezCount} kom</td></tr>` : ""}
                <tr>
                  <td>E-Tickets naknada</td>
                  <td class="right negative">-${formatCurrency(eTicketsFee, currency, null, false)}</td>
                </tr>
                <tr class="summary-row">
                  <td>Osnovni iznos za isplatu</td>
                  <td class="right positive">${formatCurrency(forPayout, currency, null, false)}</td>
                </tr>
              </table>
              
              <div class="section-title">PREGLED PO KANALIMA PRODAJE</div>
              <table>
                <thead>
                  <tr>
                    <th>Kanal</th>
                    <th class="right">Br. karata</th>
                    <th class="right">Prodaja</th>
                    <th class="right">Naknada</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Online</td>
                    <td class="right">${onlineBreakdown.count}</td>
                    <td class="right">${formatCurrency(onlineBreakdown.amount, currency, null, false)}</td>
                    <td class="right negative">-${formatCurrency(onlineBreakdown.totalFee, currency, null, false)}</td>
                  </tr>
                  <tr>
                    <td>Biletarnica</td>
                    <td class="right">${biletarnicaBreakdown.count}</td>
                    <td class="right">${formatCurrency(biletarnicaBreakdown.amount, currency, null, false)}</td>
                    <td class="right negative">-${formatCurrency(biletarnicaBreakdown.totalFee, currency, null, false)}</td>
                  </tr>
                  <tr>
                    <td>Virman</td>
                    <td class="right">${virmanBreakdown.count}</td>
                    <td class="right">${formatCurrency(virmanBreakdown.amount, currency, null, false)}</td>
                    <td class="right negative">-${formatCurrency(virmanBreakdown.totalFee, currency, null, false)}</td>
                  </tr>
                  <tr>
                    <td>Online-Kartica</td>
                    <td class="right">${karticaBreakdown.count}</td>
                    <td class="right">${formatCurrency(karticaBreakdown.amount, currency, null, false)}</td>
                    <td class="right negative">-${formatCurrency(karticaBreakdown.totalFee, currency, null, false)}</td>
                  </tr>
                  ${savezCount > 0 ? `<tr class="gratis-row"><td>Savez (${savezGratis}g / ${savezPaid}p)</td><td class="right purple">${savezCount}</td><td class="right purple">-</td><td class="right purple">-</td></tr>` : ""}
                  <tr class="summary-row">
                    <td>UKUPNO</td>
                    <td class="right">${totalSold}${savezCount > 0 ? ` (+${savezCount} savez)` : ""}</td>
                    <td class="right">${formatCurrency(totalRevenue, currency, null, false)}</td>
                    <td class="right negative">-${formatCurrency(eTicketsFee, currency, null, false)}</td>
                  </tr>
                </tbody>
              </table>
              
              ${
                deductions.length > 0
                  ? `
              <div class="section-title">DODATNI ODBICI</div>
              <table>
                <thead>
                  <tr>
                    <th>Naziv</th>
                    <th class="right">Iznos</th>
                  </tr>
                </thead>
                <tbody>
                  ${deductions
                    .map(
                      (d) => `
                  <tr>
                    <td>${d.name}</td>
                    <td class="right negative">-${formatCurrency(d.amount, currency, null, false)}</td>
                  </tr>
                  `,
                    )
                    .join("")}
                  <tr class="summary-row">
                    <td>UKUPNO ODBICI</td>
                    <td class="right negative">-${formatCurrency(totalDeductions, currency, null, false)}</td>
                  </tr>
                </tbody>
              </table>
              `
                  : ""
              }
              
              <div class="final-box">
                <div class="final-label">FINALNI IZNOS ZA ISPLATU</div>
                <div class="final-amount">${formatCurrency(finalPayout, currency, null, false)}</div>
              </div>
              
              <div class="signatures">
                <div class="signature-line">
                  <div class="line"></div>
                  <div class="label">Organizator događaja</div>
                </div>
                <div class="signature-line">
                  <div class="line"></div>
                  <div class="label">Ovlašćeno lice</div>
                </div>
              </div>
              
              <div class="footer">
                Generisano putem E-Tickets Dashboard • ${currentDate}
              </div>
            </body>
            </html>
          `;

          const printWindow = window.open("", "_blank");
          if (printWindow) {
            const toolbarHTML = `
              <div id="toolbar" style="position: fixed; top: 0; left: 0; right: 0; background: #0047CC; padding: 16px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <button onclick="window.close()" style="background: rgba(255,255,255,0.15); border: none; color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 14px 20px; border-radius: 12px; font-weight: 600;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Nazad
                </button>
                <div style="display: flex; gap: 10px;">
                  <button onclick="handleShare()" id="shareBtn" style="background: white; border: none; color: #0047CC; font-size: 15px; cursor: pointer; padding: 14px 18px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
                    Podijeli
                  </button>
                  <button onclick="handleDownload()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 15px; cursor: pointer; padding: 14px 18px; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Snimi
                  </button>
                  <button onclick="window.print()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 15px; cursor: pointer; padding: 14px 18px; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
                    Štampaj
                  </button>
                </div>
              </div>
              <script>
                if (!navigator.share) {
                  document.getElementById('shareBtn').style.display = 'none';
                }
                
                async function handleShare() {
                  var toolbar = document.getElementById('toolbar');
                  toolbar.style.display = 'none';
                  document.body.style.paddingTop = '30px';
                  
                  try {
                    var opt = {
                      margin: [15, 15, 15, 15],
                      filename: 'Izvjestaj-${selectedEvent.eventName.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}.pdf',
                      image: { type: 'jpeg', quality: 0.98 },
                      html2canvas: { scale: 2 },
                      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    
                    if (typeof html2pdf !== 'undefined') {
                      var pdfBlob = await html2pdf().set(opt).from(document.body).outputPdf('blob');
                      var file = new File([pdfBlob], opt.filename, { type: 'application/pdf' });
                      
                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          title: 'Finansijski Izvještaj - ${selectedEvent.eventName}',
                          text: 'Izvještaj o prodaji za ${selectedEvent.eventName}',
                          files: [file]
                        });
                      } else {
                        await navigator.share({
                          title: 'Finansijski Izvještaj - ${selectedEvent.eventName}',
                          text: 'Izvještaj o prodaji za ${selectedEvent.eventName}\\n\\nUkupna prodaja: ${formatCurrency(totalRevenue, currency, null, false)}\\nZa isplatu: ${formatCurrency(finalPayout, currency, null, false)}'
                        });
                      }
                    }
                  } catch (err) {
                    if (err.name !== 'AbortError') {
                      console.error('Share failed:', err);
                      alert('Dijeljenje nije uspjelo. Pokušajte ponovo.');
                    }
                  } finally {
                    toolbar.style.display = 'flex';
                    document.body.style.paddingTop = '100px';
                  }
                }
                
                function handleDownload() {
                  var toolbar = document.getElementById('toolbar');
                  toolbar.style.display = 'none';
                  document.body.style.paddingTop = '30px';
                  
                  var opt = {
                    margin: [15, 15, 15, 15],
                    filename: 'Izvjestaj-${selectedEvent.eventName.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}.pdf',
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                  };
                  
                  if (typeof html2pdf !== 'undefined') {
                    html2pdf().set(opt).from(document.body).save().then(function() {
                      toolbar.style.display = 'flex';
                      document.body.style.paddingTop = '100px';
                    });
                  } else {
                    window.print();
                    toolbar.style.display = 'flex';
                    document.body.style.paddingTop = '100px';
                  }
                }
              </script>
            `;

            const modifiedContent = printContent
              .replace(
                "</head>",
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script></head>',
              )
              .replace("<body>", '<body style="padding-top: 100px; max-width: 210mm; margin: 0 auto;">' + toolbarHTML)
              .replace(
                "@media print { body { padding: 15px; } }",
                "@media print { body { padding: 20mm !important; padding-top: 20mm !important; max-width: none !important; } #toolbar { display: none !important; } @page { size: A4; margin: 15mm; } }",
              );

            printWindow.document.write(modifiedContent);
            printWindow.document.close();
          }
        };

        return (
          <Card className="bg-white dark:bg-card border border-gray-200 dark:border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-900 dark:text-foreground">
                  <Receipt className="w-4 h-4 text-gray-700 dark:text-muted-foreground" />
                  Odbici i Finalna Isplata
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintReport}
                  className="h-7 text-xs border-gray-300 hover:bg-gray-100"
                >
                  <Printer className="w-3 h-3 mr-1" />
                  Štampaj
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Base payout */}
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-border rounded-lg">
                <span className="text-sm text-gray-700 dark:text-muted-foreground font-medium">Osnovni iznos za isplatu:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(forPayout, currency, exchangeRate)}</span>
              </div>

              {/* Deductions list */}
              {deductionsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : deductions.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-gray-600 dark:text-muted-foreground font-semibold uppercase tracking-wide">Dodatni odbici:</p>
                  {deductions.map((deduction, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-border rounded"
                    >
                      <span className="text-sm text-gray-700 dark:text-muted-foreground">{deduction.name}</span>
                      <span className="text-sm font-bold text-red-600">
                        -{formatCurrency(deduction.amount, currency, exchangeRate, false)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-2 border-t-2 border-gray-300 mt-2 pt-2">
                    <span className="text-sm text-gray-600 dark:text-muted-foreground font-medium">Ukupno odbici:</span>
                    <span className="font-bold text-red-600">
                      -{formatCurrency(totalDeductions, currency, exchangeRate, false)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-muted-foreground text-center py-2">Nema dodatnih odbitaka</p>
              )}

              {/* Final payout */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-border shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-gray-700 dark:text-muted-foreground flex-shrink-0" />
                  <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-foreground">FINALNI IZNOS:</span>
                </div>
                <span className="text-xl sm:text-2xl font-bold text-emerald-600 text-right">
                  {formatCurrency(finalPayout, currency, exchangeRate)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white">
            <CardContent className="p-3">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white">
            <CardContent className="p-2">
              <Skeleton className="w-8 h-8 rounded-full mb-1" />
              <Skeleton className="h-3 w-10 mb-1" />
              <Skeleton className="h-4 w-8" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
