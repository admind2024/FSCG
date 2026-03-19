import { useDashboard } from '@/contexts/DashboardContext';
import { calculateLocationStats, formatCurrency, filterVisibleTickets } from '@/lib/dashboard-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Globe, TrendingUp, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, PieChart, Pie, Legend } from 'recharts';

const CHART_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#14b8a6', // teal
  '#64748b', // slate
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
];

export default function LocationScreen() {
  const { selectedEvent, isLoading, exchangeRate } = useDashboard();

  if (isLoading || !selectedEvent) {
    return <LoadingSkeleton />;
  }

  const tickets = filterVisibleTickets(selectedEvent.tickets);
  const cityStats = calculateLocationStats(tickets, 'city');
  const countryStats = calculateLocationStats(tickets, 'country');
  const currency = selectedEvent.currency;

  const top10Cities = cityStats.slice(0, 10);
  const top5Cities = cityStats.slice(0, 5);
  const top5Countries = countryStats.slice(0, 5);

  return (
    <div className="p-3 md:p-6 space-y-4 animate-slide-up">
      {/* DESKTOP: Side-by-side layout for stats and top city */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-4">
        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-3">
          <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-muted-foreground">Gradovi</span>
              </div>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{cityStats.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border-teal-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-teal-500" />
                <span className="text-xs text-muted-foreground">Države</span>
              </div>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{countryStats.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Top City Highlight - spans 2 columns on desktop */}
        {top10Cities[0] && (
          <Card className="mt-4 lg:mt-0 lg:col-span-2 bg-gradient-to-r from-red-500/10 via-red-600/5 to-slate-800/30 border-red-500/20 overflow-hidden">
            <CardContent className="p-4 relative">
              <div className="absolute top-2 right-2">
                <Award className="w-8 h-8 text-red-500/30" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Najprodavaniji grad</p>
                  <p className="font-bold text-lg">{top10Cities[0].location}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-3 lg:gap-8">
                <div>
                  <p className="text-xs text-muted-foreground">Karata</p>
                  <p className="font-semibold text-red-500 dark:text-red-400 lg:text-xl">{top10Cities[0].count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Iznos</p>
                  <p className="font-semibold lg:text-xl">{formatCurrency(top10Cities[0].amount, currency, exchangeRate, false)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Udio</p>
                  <p className="font-semibold lg:text-xl">{top10Cities[0].percentage.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Grid - side by side on tablet+ */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Bar Chart - Top Cities */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Top 10 Gradova
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10Cities} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                  <defs>
                    {CHART_COLORS.map((color, index) => (
                      <linearGradient key={`gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={color} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="location" 
                    width={80} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                    tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Karata']}
                    contentStyle={{ 
                      fontSize: 12, 
                      borderRadius: 12,
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
                    }}
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                    {top10Cities.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#barGradient-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Countries */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-teal-500/5 to-cyan-500/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-500" />
              Distribucija po Državama
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {CHART_COLORS.map((color, index) => (
                      <linearGradient key={`pieGradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={top5Countries}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="location"
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {top5Countries.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieGradient-${index})`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{ 
                      fontSize: 12, 
                      borderRadius: 12,
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Grid - side by side on large screens */}
      <div className="grid xl:grid-cols-2 gap-4">
        {/* Top 5 Cities Table */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-pink-500/5 to-rose-500/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-pink-500" />
              Top 5 Gradova - Detalji
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Grad</th>
                    <th className="px-4 py-3 text-right font-semibold">Karte</th>
                    <th className="px-4 py-3 text-right font-semibold">Iznos</th>
                    <th className="px-4 py-3 text-right font-semibold">Udio</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Cities.map((city, idx) => (
                    <tr 
                      key={city.location} 
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ background: `linear-gradient(135deg, ${CHART_COLORS[idx]}, ${CHART_COLORS[idx]}dd)` }}
                        >
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{city.location}</td>
                      <td className="px-4 py-3 text-right font-bold">{city.count}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(city.amount, currency, exchangeRate, false)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {city.percentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Full City List */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500" />
              Kompletna Lista Gradova
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted">
                  <th className="px-4 py-2 text-left font-semibold">Grad</th>
                  <th className="px-4 py-2 text-right font-semibold">Karte</th>
                  <th className="px-4 py-2 text-right font-semibold">Iznos</th>
                  <th className="px-4 py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {cityStats.map((city, idx) => (
                  <tr 
                    key={city.location} 
                    className={`border-b border-border/30 ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}`}
                  >
                    <td className="px-4 py-2.5 font-medium">{city.location}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{city.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(city.amount, currency, exchangeRate, false)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{city.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
