import { useDashboard } from '@/contexts/DashboardContext';
import { calculateDailyCategoryStats, formatCurrency, formatDate } from '@/lib/dashboard-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function getCategoryBadgeVariant(category: string): "default" | "secondary" | "destructive" | "outline" {
  const lowerCat = category.toLowerCase();
  if (lowerCat.includes('vip') || lowerCat.includes('premium')) return 'default';
  if (lowerCat.includes('student')) return 'secondary';
  return 'outline';
}

export default function DailyCategoryScreen() {
  const { selectedEvent, isLoading, exchangeRate } = useDashboard();

  if (isLoading || !selectedEvent) {
    return <LoadingSkeleton />;
  }

  const dailyCatStats = calculateDailyCategoryStats(selectedEvent.tickets, selectedEvent);
  const currency = selectedEvent.currency;

  // Group by date for totals
  const dateGroups = new Map<string, typeof dailyCatStats>();
  dailyCatStats.forEach(stat => {
    if (!dateGroups.has(stat.date)) {
      dateGroups.set(stat.date, []);
    }
    dateGroups.get(stat.date)!.push(stat);
  });

  return (
    <div className="p-3 md:p-6 lg:p-8 animate-slide-up">
      <Card className="md:shadow-lg lg:shadow-xl lg:rounded-2xl">
        <CardHeader className="pb-2 md:pb-3 lg:pb-4">
          <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-2">
            <BarChart3 className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
            Dnevna Statistika po Kategorijama
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm lg:text-base">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 bg-muted/50 px-2 py-2 text-left font-semibold min-w-[70px]">Datum</th>
                  <th className="px-2 py-2 text-left font-semibold min-w-[80px]">Kategorija</th>
                  <th className="px-2 py-2 text-right font-semibold">Ukupno</th>
                  <th className="px-2 py-2 text-right font-semibold">Online</th>
                  <th className="px-2 py-2 text-right font-semibold">Bilet.</th>
                  <th className="px-2 py-2 text-right font-semibold">Virm.</th>
                  <th className="px-2 py-2 text-right font-semibold">Kart.</th>
                  <th className="px-2 py-2 text-right font-semibold bg-success/10">Iznos</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(dateGroups.entries()).map(([date, stats], dateIdx) => {
                  const dateTotal = stats.reduce((acc, s) => ({
                    total: acc.total + s.total,
                    online: acc.online + s.online,
                    biletarnica: acc.biletarnica + s.biletarnica,
                    virman: acc.virman + s.virman,
                    kartica: acc.kartica + s.kartica,
                    amount: acc.amount + s.amount,
                  }), { total: 0, online: 0, biletarnica: 0, virman: 0, kartica: 0, amount: 0 });

                  return (
                    <>
                      {stats.map((stat, idx) => (
                        <tr 
                          key={`${stat.date}-${stat.category}`} 
                          className={dateIdx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}
                        >
                          <td className="sticky left-0 bg-inherit px-2 py-1.5 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            {idx === 0 ? (
                              <span className="font-medium">{formatDate(stat.date)}</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge variant={getCategoryBadgeVariant(stat.category)} className="text-[10px] px-1.5 py-0">
                              {stat.category}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold">{stat.total}</td>
                          <td className="px-2 py-1.5 text-right">
                            {stat.online > 0 && (
                              <span className="bg-channel-online-bg text-channel-online px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {stat.online}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {stat.biletarnica > 0 && (
                              <span className="bg-channel-biletarnica-bg text-channel-biletarnica px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {stat.biletarnica}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {stat.virman > 0 && (
                              <span className="bg-channel-virman-bg text-channel-virman px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {stat.virman}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {stat.kartica > 0 && (
                              <span className="bg-channel-kartica-bg text-channel-kartica px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {stat.kartica}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right bg-success/5 text-success font-medium">
                            {formatCurrency(stat.amount, currency, exchangeRate, false)}
                          </td>
                        </tr>
                      ))}
                      {/* Date total row */}
                      <tr className="bg-muted/50 border-b border-border">
                        <td className="sticky left-0 bg-muted/50 px-2 py-1.5 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"></td>
                        <td className="px-2 py-1.5 font-bold text-[10px] text-muted-foreground">
                          UKUPNO za {formatDate(date)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold">{dateTotal.total}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-channel-online">{dateTotal.online || '-'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-channel-biletarnica">{dateTotal.biletarnica || '-'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-channel-virman">{dateTotal.virman || '-'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-channel-kartica">{dateTotal.kartica || '-'}</td>
                        <td className="px-2 py-1.5 text-right font-bold bg-success/10 text-success">
                          {formatCurrency(dateTotal.amount, currency, exchangeRate, false)}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
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
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
