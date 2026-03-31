import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { supabaseQuery } from "@/lib/supabaseConfig";
import { isGradskiStadion, getTribuneFromCategory } from "@/lib/stadium-config";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ScanLine,
  RefreshCw,
} from "lucide-react";

interface ScanTicket {
  isUsed: string | null;
  used: string | null;
  checkTime: string | null;
  scannedAt: string | null;
  category: string;
  entrance: string;
  salesChannel: string | null;
}

interface TribuneStats {
  name: string;
  total: number;
  scanned: number;
  percentage: number;
}

interface EntranceStats {
  name: string;
  total: number;
  scanned: number;
  percentage: number;
}

function isScanned(t: ScanTicket): boolean {
  return t.isUsed === "true" || t.used === "true" || !!t.checkTime;
}

function formatTime(t: string | null): string {
  if (!t) return "-";
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleString("sr-Latn-BA", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return t;
  }
}

export default function CheckInScreen() {
  const { selectedEventId, selectedEvent } = useDashboard();
  const [tickets, setTickets] = useState<ScanTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const venue = selectedEvent?.venue || "";
  const isStadion = isGradskiStadion(venue);

  const fetchScanData = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      // Dohvati eventId polje iz AboutEvents (može biti comma-separated, npr. "mneslo,uuid")
      const aboutEvents = await supabaseQuery(
        "AboutEvents",
        `eventKey=eq.${selectedEventId}&select=eventId`
      );
      const rawEventId = aboutEvents[0]?.eventId || selectedEventId;
      const eventIds = rawEventId.split(",").map((id: string) => id.trim()).filter(Boolean);

      // Vuci karte za svaki eventId
      let allData: any[] = [];
      for (const eid of eventIds) {
        const data = await supabaseQuery(
          "QRKarte",
          `eventId=eq.${eid}&select=isUsed,used,checkTime,scannedAt,category,entrance,salesChannel`
        );
        allData = allData.concat(data);
      }

      setTickets(allData as ScanTicket[]);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("CheckIn fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchScanData();
  }, [fetchScanData]);

  // Polling 30s with visibilitychange
  useEffect(() => {
    if (!selectedEventId) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (!interval) interval = setInterval(fetchScanData, 30000);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { fetchScanData(); start(); }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [selectedEventId, fetchScanData]);

  if (loading && tickets.length === 0) {
    return (
      <div className="p-3 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // Stats
  const total = tickets.length;
  const scanned = tickets.filter(isScanned).length;
  const remaining = total - scanned;
  const pct = total > 0 ? (scanned / total) * 100 : 0;

  // Last scan time
  const lastScan = tickets.reduce<string | null>((latest, t) => {
    const time = t.scannedAt || t.checkTime;
    if (!time) return latest;
    if (!latest || time > latest) return time;
    return latest;
  }, null);

  // Tribune stats
  const tribuneMap = new Map<string, { total: number; scanned: number }>();
  tickets.forEach((t) => {
    const tribune = isStadion
      ? getTribuneFromCategory(t.category || "")
      : (t.category || "Ostalo");
    if (!tribuneMap.has(tribune)) tribuneMap.set(tribune, { total: 0, scanned: 0 });
    const stat = tribuneMap.get(tribune)!;
    stat.total++;
    if (isScanned(t)) stat.scanned++;
  });

  const tribuneOrder = ["Zapad", "Istok", "Sjever", "Jug", "VIP"];
  const tribuneStats: TribuneStats[] = Array.from(tribuneMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      scanned: s.scanned,
      percentage: s.total > 0 ? (s.scanned / s.total) * 100 : 0,
    }))
    .sort((a, b) => {
      const ia = tribuneOrder.indexOf(a.name);
      const ib = tribuneOrder.indexOf(b.name);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return b.total - a.total;
    });

  // Entrance stats
  const entranceMap = new Map<string, { total: number; scanned: number }>();
  tickets.forEach((t) => {
    const entrance = t.entrance || "Nepoznat";
    if (!entranceMap.has(entrance)) entranceMap.set(entrance, { total: 0, scanned: 0 });
    const stat = entranceMap.get(entrance)!;
    stat.total++;
    if (isScanned(t)) stat.scanned++;
  });

  const entranceStats: EntranceStats[] = Array.from(entranceMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      scanned: s.scanned,
      percentage: s.total > 0 ? (s.scanned / s.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Channel stats
  const channelMap = new Map<string, { total: number; scanned: number }>();
  tickets.forEach((t) => {
    const ch = t.salesChannel || "Nepoznat";
    if (!channelMap.has(ch)) channelMap.set(ch, { total: 0, scanned: 0 });
    const stat = channelMap.get(ch)!;
    stat.total++;
    if (isScanned(t)) stat.scanned++;
  });

  const channelStats = Array.from(channelMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      scanned: s.scanned,
      percentage: s.total > 0 ? (s.scanned / s.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const getColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 animate-slide-up">
      {/* Header with auto-refresh info */}
      {lastUpdate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>Auto-refresh 30s | {lastUpdate.toLocaleTimeString("sr-Latn-BA")}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Ukupno</span>
            </div>
            <p className="text-3xl font-black text-foreground">{total}</p>
            <p className="text-[10px] text-muted-foreground">karata u sistemu</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Skenirano</span>
            </div>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{scanned}</p>
            <div className="mt-1.5">
              <Progress value={pct} className="h-1.5" />
              <p className="text-[10px] mt-0.5 text-muted-foreground font-semibold">{pct.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Preostalo</span>
            </div>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{remaining}</p>
            <p className="text-[10px] text-muted-foreground">neskenirano</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-slate-500 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Zadnje sken.</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatTime(lastScan)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tribune stats */}
      {tribuneStats.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ScanLine className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wide">
                {isStadion ? "Po tribinama" : "Po kategorijama"}
              </h3>
            </div>
            <div className="space-y-3">
              {tribuneStats.map((t) => (
                <div key={t.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t.scanned}</span>
                      <span className="text-muted-foreground">/ {t.total}</span>
                      <span className={`font-bold min-w-[40px] text-right ${getColor(t.percentage)}`}>
                        {t.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={t.percentage} className="h-2" />
                </div>
              ))}
            </div>

            {/* Totals row */}
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">UKUPNO</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{scanned}</span>
                  <span className="text-muted-foreground">/ {total}</span>
                  <span className={`font-bold min-w-[40px] text-right ${getColor(pct)}`}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entrance stats */}
      {entranceStats.length > 0 && entranceStats.some((e) => e.name !== "Nepoznat") && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ScanLine className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wide">Po ulazima</h3>
            </div>
            <div className="space-y-3">
              {entranceStats
                .filter((e) => e.name !== "Nepoznat")
                .map((e) => (
                  <div key={e.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{e.name}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{e.scanned}</span>
                        <span className="text-muted-foreground">/ {e.total}</span>
                        <span className={`font-bold min-w-[40px] text-right ${getColor(e.percentage)}`}>
                          {e.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={e.percentage} className="h-1.5" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channel stats */}
      {channelStats.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ScanLine className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wide">Po kanalu prodaje</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {channelStats.map((ch) => (
                <div key={ch.name} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{ch.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{ch.scanned}</span>
                    <span className="text-xs text-muted-foreground">/ {ch.total}</span>
                  </div>
                  <Progress value={ch.percentage} className="h-1 mt-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ch.percentage.toFixed(1)}% skenirano</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
