import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Award, Package, Wallet, Tag, Receipt, ShoppingCart } from 'lucide-react';
import type { Order, PaymentMethod } from '@/types';
import { PAYMENT_METHODS } from '@/types';
import { formatCurrency, getBusinessDayKey, getDayName } from '@/data/store';

interface AnalyticsPageProps {
  orders: Order[];
}

type ViewPeriod = 'daily' | 'weekly' | 'monthly';
type ChartType = 'revenue' | 'products' | 'payments';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CHART_COLORS = [
  '#0f766e', '#0891b2', '#2563eb', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#4f46e5',
  '#9333ea', '#7c3aed',
];

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  'Cash': '#16a34a',
  'G-Cash': '#2563eb',
  'Credit Card': '#475569',
  'Maya': '#0d9488',
  'Maribank': '#ca8a04',
  'Palawan': '#ea580c',
  'Grab': '#059669',
};

function getPeriodBounds(period: ViewPeriod): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  if (period === 'daily') {
    // Business day starts at 4 AM; if before 4 AM, we're still in yesterday's business day
    if (start.getHours() < 4) {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(4, 0, 0, 0);
  } else if (period === 'weekly') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function getEffectiveTotal(order: Order): number {
  return order.grabAdjustedTotal != null ? order.grabAdjustedTotal : order.total;
}

export default function AnalyticsPage({ orders }: AnalyticsPageProps) {
  const [period, setPeriod] = useState<ViewPeriod>('daily');
  const [chartType, setChartType] = useState<ChartType>('revenue');

  const periodOrders = useMemo(() => {
    const { start, end } = getPeriodBounds(period);
    return orders.filter((o) => {
      const t = new Date(o.timestamp);
      return t >= start && t <= end;
    });
  }, [orders, period]);

  // Aggregate stats for the selected period
  const stats = useMemo(() => {
    const totalRevenue = periodOrders.reduce((s, o) => s + getEffectiveTotal(o), 0);
    const totalOrders = periodOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscounts = periodOrders.reduce((s, o) => s + o.discountAmount, 0);
    const itemsSold = periodOrders.reduce(
      (s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0),
      0,
    );
    const avgRevenuePerDay = (() => {
      const dayKeys = new Set(periodOrders.map((o) => getBusinessDayKey(o.timestamp)));
      const dayCount = Math.max(dayKeys.size, 1);
      return totalRevenue / dayCount;
    })();
    return { totalRevenue, totalOrders, avgOrderValue, totalDiscounts, itemsSold, avgRevenuePerDay };
  }, [periodOrders]);

  // Top products
  const productData = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of periodOrders) {
      for (const item of order.items) {
        const existing = map.get(item.id) || { name: item.name, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.lineTotal;
        map.set(item.id, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }, [periodOrders]);

  // Payment method breakdown
  const paymentData = useMemo(() => {
    const map = new Map<PaymentMethod, { revenue: number; orders: number }>();
    for (const method of PAYMENT_METHODS) map.set(method, { revenue: 0, orders: 0 });
    for (const order of periodOrders) {
      const entry = map.get(order.paymentMethod);
      if (entry) {
        entry.revenue += getEffectiveTotal(order);
        entry.orders += 1;
      }
    }
    return PAYMENT_METHODS.map((method) => ({
      method,
      revenue: map.get(method)!.revenue,
      orders: map.get(method)!.orders,
    })).filter((d) => d.orders > 0);
  }, [periodOrders]);

  // Daily revenue chart (for weekly/monthly)
  const dailyRevenueData = useMemo(() => {
    const { start, end } = getPeriodBounds(period);
    const map = new Map<string, { dateKey: string; revenue: number; orders: number }>();
    const cur = new Date(start);
    while (cur <= end) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      map.set(key, { dateKey: key, revenue: 0, orders: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    for (const order of periodOrders) {
      const key = getBusinessDayKey(order.timestamp);
      const entry = map.get(key);
      if (entry) {
        entry.revenue += getEffectiveTotal(order);
        entry.orders += 1;
      }
    }
    return Array.from(map.values());
  }, [periodOrders, period]);

  // Weekday breakdown (for weekly)
  const weekdayData = useMemo(() => {
    const counts: Record<string, { revenue: number; orders: number }> = {};
    WEEKDAYS.forEach((d) => (counts[d] = { revenue: 0, orders: 0 }));
    for (const order of periodOrders) {
      const day = getDayName(order.timestamp);
      counts[day].revenue += getEffectiveTotal(order);
      counts[day].orders += 1;
    }
    return WEEKDAYS.map((day) => ({
      day,
      revenue: counts[day].revenue,
      orders: counts[day].orders,
    }));
  }, [periodOrders]);

  if (orders.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-400">
        <BarChart3 className="mb-3 h-12 w-12 opacity-30" />
        <p className="text-sm font-medium">No data to analyze yet</p>
        <p className="text-xs">Complete some orders to see analytics</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-green-500' },
    { label: 'Avg Order Value', value: formatCurrency(stats.avgOrderValue), icon: Wallet, color: 'text-blue-500' },
    { label: 'Total Orders', value: String(stats.totalOrders), icon: Receipt, color: 'text-teal-500' },
    { label: 'Items Sold', value: String(stats.itemsSold), icon: Package, color: 'text-orange-500' },
    { label: 'Total Discounts', value: formatCurrency(stats.totalDiscounts), icon: Tag, color: 'text-amber-500' },
    { label: 'Avg Revenue/Day', value: formatCurrency(stats.avgRevenuePerDay), icon: TrendingUp, color: 'text-emerald-500' },
  ];

  const maxChartValue = chartType === 'revenue'
    ? Math.max(...dailyRevenueData.map((d) => d.revenue), 1)
    : chartType === 'products'
    ? Math.max(...productData.map((p) => p.quantity), 1)
    : Math.max(...paymentData.map((p) => p.revenue), 1);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Period selector */}
      <div className="mb-4 flex gap-2">
        {(['daily', 'weekly', 'monthly'] as ViewPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${
              period === p
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {p === 'daily' ? 'Today' : p}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${card.color}`} />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">
                  {card.label}
                </p>
              </div>
              <p className="mt-1 text-lg font-bold text-slate-800 sm:text-xl lg:text-2xl">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Chart type selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['revenue', 'products', 'payments'] as ChartType[]).map((c) => (
          <button
            key={c}
            onClick={() => setChartType(c)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${
              chartType === c
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {c === 'revenue' ? 'Revenue Trend' : c === 'products' ? 'Top Products' : 'Payment Methods'}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="flex-1">
        {chartType === 'revenue' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-4 text-base font-bold text-slate-800">
              Revenue — {period === 'daily' ? 'Today' : period === 'weekly' ? 'Last 7 Days' : 'Last 30 Days'}
            </h3>
            {dailyRevenueData.length <= 1 ? (
              <div className="flex h-40 items-center justify-center">
                <div className="w-full max-w-xs">
                  <div className="mb-2 flex justify-between text-sm text-slate-500">
                    <span>Today's Revenue</span>
                    <span className="font-bold text-slate-800">{formatCurrency(stats.totalRevenue)}</span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-teal-600 to-teal-400"
                      style={{ width: stats.totalRevenue > 0 ? '100%' : '0%' }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{stats.totalOrders} orders today</p>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-end justify-between gap-1 overflow-x-auto">
                {dailyRevenueData.map((d) => {
                  const heightPct = (d.revenue / maxChartValue) * 100;
                  return (
                    <div
                      key={d.dateKey}
                      className="group flex min-w-[24px] flex-1 flex-col items-center justify-end"
                    >
                      <div className="relative flex w-full flex-col items-center">
                        <div className="absolute -top-7 z-10 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white group-hover:block">
                          {formatCurrency(d.revenue)} · {d.orders} orders
                        </div>
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-teal-600 to-teal-400 transition-all duration-300"
                          style={{
                            height: `${Math.max(heightPct, d.revenue > 0 ? 4 : 0)}%`,
                            minHeight: d.revenue > 0 ? '4px' : '0',
                          }}
                        />
                      </div>
                      <span className="mt-2 text-[10px] text-slate-400">
                        {new Date(d.dateKey).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {chartType === 'products' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-4 text-base font-bold text-slate-800">Top Products by Quantity Sold</h3>
            {productData.length === 0 ? (
              <p className="text-sm text-slate-400">No products sold in this period.</p>
            ) : (
              <div className="space-y-2.5">
                {productData.slice(0, 15).map((p, idx) => {
                  const widthPct = (p.quantity / maxChartValue) * 100;
                  return (
                    <div key={p.name} className="flex items-center gap-2 sm:gap-3">
                      <div className="flex w-6 shrink-0 items-center justify-center">
                        {idx < 3 && <Award className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div className="w-28 shrink-0 truncate text-xs font-medium text-slate-700 sm:w-40 sm:text-sm">
                        {p.name}
                      </div>
                      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                        <div
                          className="flex h-full items-center justify-end rounded-md px-2 text-xs font-bold text-white transition-all duration-500"
                          style={{
                            width: `${Math.max(widthPct, 5)}%`,
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                          }}
                        >
                          {p.quantity}
                        </div>
                      </div>
                      <div className="w-16 text-right text-xs font-medium text-slate-500 sm:w-20 sm:text-sm">
                        {formatCurrency(p.revenue)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {chartType === 'payments' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-4 text-base font-bold text-slate-800">Revenue by Payment Method</h3>
            {paymentData.length === 0 ? (
              <p className="text-sm text-slate-400">No payment data in this period.</p>
            ) : (
              <>
                <div className="mb-6 space-y-3">
                  {paymentData.map((p) => {
                    const widthPct = (p.revenue / maxChartValue) * 100;
                    return (
                      <div key={p.method} className="flex items-center gap-2 sm:gap-3">
                        <div className="flex w-20 shrink-0 items-center gap-2 sm:w-28">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[p.method] }} />
                          <span className="text-xs font-medium text-slate-700 sm:text-sm">{p.method}</span>
                        </div>
                        <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-slate-100">
                          <div
                            className="flex h-full items-center justify-end rounded-md px-2 text-xs font-bold text-white transition-all duration-500"
                            style={{
                              width: `${Math.max(widthPct, 5)}%`,
                              backgroundColor: PAYMENT_COLORS[p.method],
                            }}
                          >
                            {p.orders}
                          </div>
                        </div>
                        <div className="w-20 text-right text-xs font-bold text-slate-700 sm:w-24 sm:text-sm">
                          {formatCurrency(p.revenue)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Payment Distribution
                  </p>
                  <div className="flex h-8 w-full overflow-hidden rounded-lg">
                    {paymentData.map((p) => {
                      const totalRev = paymentData.reduce((s, d) => s + d.revenue, 0);
                      const pct = totalRev > 0 ? (p.revenue / totalRev) * 100 : 0;
                      return (
                        <div
                          key={p.method}
                          className="group relative flex items-center justify-center transition-all hover:brightness-110"
                          style={{ width: `${pct}%`, backgroundColor: PAYMENT_COLORS[p.method] }}
                        >
                          <span className="absolute -top-7 z-10 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white group-hover:block">
                            {p.method}: {pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
