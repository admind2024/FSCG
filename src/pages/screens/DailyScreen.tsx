import { useDashboard } from "@/contexts/DashboardContext";
import { calculateDailyStats, formatCurrencyNoDecimals, formatDate } from "@/lib/dashboard-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DailyScreen() {
  const { selectedEvent, isLoading, exchangeRate } = useDashboard();

  if (isLoading || !selectedEvent) {
    return <LoadingSkeleton />;
  }

  // Samo plaćene karte (pazar) - bez gratis
  const paidTickets = selectedEvent.tickets.filter((t) => Number(t.price) > 0);

  // Sortiraj od najnovijeg ka najstarijem
  const dailyStats = calculateDailyStats(paidTickets, selectedEvent).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const currency = selectedEvent.currency;

  // Provjeri da li je datum danas ili jučer
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const isToday = (date: string) => date === today;
  const isYesterday = (date: string) => date === yesterday;

  // Izračunaj trend (promjena u odnosu na prethodni dan)
  const getTrend = (currentIdx: number) => {
    if (currentIdx >= dailyStats.length - 1) return null;
    const current = dailyStats[currentIdx].total;
    const previous = dailyStats[currentIdx + 1].total;
    if (current > previous) return "up";
    if (current < previous) return "down";
    return "same";
  };

  // Totali
  const totals = {
    tickets: dailyStats.reduce((sum, d) => sum + d.total, 0),
    online: dailyStats.reduce((sum, d) => sum + d.online.count, 0),
    biletarnica: dailyStats.reduce((sum, d) => sum + d.biletarnica.count, 0),
    virman: dailyStats.reduce((sum, d) => sum + d.virman.count, 0),
    kartica: dailyStats.reduce((sum, d) => sum + d.kartica.count, 0),
    amount: dailyStats.reduce((sum, d) => sum + d.totalAmount, 0),
  };

  return (
    <div className="p-3 md:p-6 lg:p-8 animate-slide-up">
      <Card className="overflow-hidden md:shadow-lg lg:shadow-xl lg:rounded-2xl">
        <CardHeader className="pb-3 md:pb-4 lg:pb-5 bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="text-sm md:text-base lg:text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-primary" />
              Dnevna Statistika Prodaje
            </div>
            <span className="text-xs md:text-sm font-normal text-muted-foreground">{dailyStats.length} dana</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm lg:text-base">
              <thead>
                <tr className="border-b bg-gray-100 dark:bg-gray-800">
                  <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-3 py-2.5 text-left font-semibold min-w-[100px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    Datum
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold min-w-[60px]">Ukupno</th>
                  <th className="px-2 py-2.5 text-center font-semibold bg-channel-online-bg/30 min-w-[70px]">Online</th>
                  <th className="px-2 py-2.5 text-center font-semibold bg-channel-biletarnica-bg/30 min-w-[70px]">
                    Bilet.
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold bg-channel-virman-bg/30 min-w-[70px]">Virm.</th>
                  <th className="px-2 py-2.5 text-center font-semibold bg-channel-kartica-bg/30 min-w-[70px]">Kart.</th>
                  <th className="px-2 py-2.5 text-right font-semibold bg-success/10 min-w-[90px]">Iznos</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((day, idx) => {
                  const trend = getTrend(idx);
                  const isTodayRow = isToday(day.date);
                  const isYesterdayRow = isYesterday(day.date);

                  return (
                    <tr
                      key={day.date}
                      className={`
                        transition-colors
                        ${isTodayRow ? "bg-primary/5 hover:bg-primary/10" : ""}
                        ${isYesterdayRow ? "bg-muted/30 hover:bg-muted/40" : ""}
                        ${!isTodayRow && !isYesterdayRow ? (idx % 2 === 0 ? "bg-card hover:bg-muted/20" : "bg-muted/10 hover:bg-muted/30") : ""}
                      `}
                    >
                      <td
                        className={`
                        sticky left-0 z-10 px-3 py-2.5 font-medium border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]
                        ${isTodayRow ? "bg-blue-50 dark:bg-blue-950" : isYesterdayRow ? "bg-gray-100 dark:bg-gray-800" : idx % 2 === 0 ? "bg-card" : "bg-gray-50 dark:bg-gray-800"}
                      `}
                      >
                        <div className="flex items-center gap-1.5">
                          {isTodayRow && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                          <span>{isTodayRow ? "Danas" : isYesterdayRow ? "Jučer" : formatDate(day.date)}</span>
                        </div>
                        {!isTodayRow && !isYesterdayRow && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {new Date(day.date).toLocaleDateString("sr-Latn", { weekday: "short" })}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-sm">{day.total}</span>
                          {trend === "up" && <TrendingUp className="w-3 h-3 text-success" />}
                          {trend === "down" && <TrendingDown className="w-3 h-3 text-destructive" />}
                          {trend === "same" && <Minus className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center bg-channel-online-bg/20">
                        <div className="font-semibold text-channel-online">{day.online.count}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatCurrencyNoDecimals(day.online.amount, currency, exchangeRate, false)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center bg-channel-biletarnica-bg/20">
                        <div className="font-semibold text-channel-biletarnica">{day.biletarnica.count}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatCurrencyNoDecimals(day.biletarnica.amount, currency, exchangeRate, false)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center bg-channel-virman-bg/20">
                        <div className="font-semibold text-channel-virman">{day.virman.count}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatCurrencyNoDecimals(day.virman.amount, currency, exchangeRate, false)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center bg-channel-kartica-bg/20">
                        <div className="font-semibold text-channel-kartica">{day.kartica.count}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatCurrencyNoDecimals(day.kartica.amount, currency, exchangeRate, false)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right bg-success/5">
                        <div className={`font-bold ${isTodayRow ? "text-primary" : "text-success"}`}>
                          {formatCurrencyNoDecimals(day.totalAmount, currency, exchangeRate, false)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted font-bold sticky bottom-0">
                  <td className="sticky left-0 z-10 bg-gray-200 dark:bg-gray-700 px-3 py-3 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    UKUPNO
                  </td>
                  <td className="px-2 py-3 text-center text-sm">{totals.tickets}</td>
                  <td className="px-2 py-3 text-center bg-channel-online-bg/30 text-channel-online">{totals.online}</td>
                  <td className="px-2 py-3 text-center bg-channel-biletarnica-bg/30 text-channel-biletarnica">
                    {totals.biletarnica}
                  </td>
                  <td className="px-2 py-3 text-center bg-channel-virman-bg/30 text-channel-virman">{totals.virman}</td>
                  <td className="px-2 py-3 text-center bg-channel-kartica-bg/30 text-channel-kartica">
                    {totals.kartica}
                  </td>
                  <td className="px-2 py-3 text-right bg-success/10 text-success text-sm">
                    {formatCurrencyNoDecimals(totals.amount, currency, exchangeRate, false)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
