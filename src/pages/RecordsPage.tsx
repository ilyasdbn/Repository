import { useMemo, useState } from 'react';
import { Receipt, Search, ChevronDown, ChevronUp, Trash2, Ban, Calendar, TrendingUp } from 'lucide-react';
import type { Order } from '@/types';
import { formatCurrency, formatTime, clearAllOrders, voidOrderItem, getBusinessDayKey, getBusinessDayLabel, isTodayBusinessDay } from '@/data/store';

type ViewPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

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
  } else if (period === 'monthly') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 89);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function getEffectiveTotal(order: Order): number {
  return order.grabAdjustedTotal != null ? order.grabAdjustedTotal : order.total;
}

const PERIOD_LABELS: Record<ViewPeriod, string> = {
  daily: 'Today',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: '3 Months',
};

interface RecordsPageProps {
  orders: Order[];
  onOrdersChanged: () => Promise<void> | void;
}

interface DayGroup {
  dateKey: string;
  label: string;
  isToday: boolean;
  orders: Order[];
  revenue: number;
  itemCount: number;
}

export default function RecordsPage({ orders, onOrdersChanged }: RecordsPageProps) {
  const [period, setPeriod] = useState<ViewPeriod>('daily');
  const [search, setSearch] = useState('');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ orderId: string; itemId: string; itemName: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const periodOrders = useMemo(() => {
    const { start, end } = getPeriodBounds(period);
    return orders.filter((o) => {
      const t = new Date(o.timestamp);
      return t >= start && t <= end;
    });
  }, [orders, period]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Order[]>();
    for (const order of periodOrders) {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          order.id.toLowerCase().includes(q) ||
          order.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matches) continue;
      }
      const key = getBusinessDayKey(order.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    }
    const groups: DayGroup[] = [];
    for (const [dateKey, dayOrders] of map) {
      const sorted = dayOrders.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      groups.push({
        dateKey,
        label: getBusinessDayLabel(dateKey),
        isToday: isTodayBusinessDay(dateKey),
        orders: sorted,
        revenue: sorted.reduce((s, o) => s + (o.grabAdjustedTotal != null ? o.grabAdjustedTotal : o.total), 0),
        itemCount: sorted.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0),
      });
    }
    return groups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [periodOrders, search]);

  const totalRevenue = useMemo(
    () => dayGroups.reduce((s, g) => s + g.revenue, 0),
    [dayGroups],
  );
  const totalDiscounts = useMemo(
    () => periodOrders.reduce((s, o) => s + o.discountAmount, 0),
    [periodOrders],
  );
  const totalItems = useMemo(
    () => dayGroups.reduce((s, g) => s + g.itemCount, 0),
    [dayGroups],
  );
  const totalOrders = useMemo(
    () => dayGroups.reduce((s, g) => s + g.orders.length, 0),
    [dayGroups],
  );

  function toggleDay(dateKey: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  async function handleClearAll() {
    await clearAllOrders();
    await onOrdersChanged();
    setShowClearConfirm(false);
  }

  async function handleVoidItem() {
    if (!voidTarget || !voidReason.trim()) return;
    await voidOrderItem(voidTarget.orderId, voidTarget.itemId, voidReason.trim());
    setVoidTarget(null);
    setVoidReason('');
    await onOrdersChanged();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Period selector */}
      <div className="mb-4 flex gap-2">
        {(['daily', 'weekly', 'monthly', 'quarterly'] as ViewPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              period === p
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Total Orders
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{totalOrders}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Total Revenue
          </p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Total Discounts
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-500">
            {formatCurrency(totalDiscounts)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Items Sold
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{totalItems}</p>
        </div>
      </div>

      {/* Search + clear */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID or item name..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
        {periodOrders.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Orders grouped by business day */}
      <div className="flex-1 overflow-y-auto pr-1">
        {dayGroups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <Receipt className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">No sales recorded yet</p>
            <p className="text-xs">Completed orders will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayGroups.map((group) => {
              const expanded = expandedDays.has(group.dateKey);
              return (
                <div
                  key={group.dateKey}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                    group.isToday ? 'border-teal-300' : 'border-slate-200'
                  }`}
                >
                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(group.dateKey)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        group.isToday ? 'bg-teal-100' : 'bg-slate-100'
                      }`}
                    >
                      <Calendar className={`h-5 w-5 ${group.isToday ? 'text-teal-600' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {group.label}
                        </span>
                        {group.isToday && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {group.orders.length} orders · {group.itemCount} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="flex items-center gap-1 text-base font-bold text-slate-800">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        {formatCurrency(group.revenue)}
                      </p>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </button>

                  {/* Orders within this day */}
                  {expanded && (
                    <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-3">
                      {group.orders.map((order) => {
                        const orderExpanded = expandedOrderId === order.id;
                        return (
                          <div
                            key={order.id}
                            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                          >
                            <button
                              onClick={() =>
                                setExpandedOrderId(orderExpanded ? null : order.id)
                              }
                              className="flex w-full items-center gap-3 px-3 py-3 text-left"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
                                <Receipt className="h-4 w-4 text-slate-500" />
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800">
                                    {order.id}
                                  </span>
                                  {order.discountAmount > 0 && (
                                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600">
                                      -{order.discountType === 'percentage' ? `${order.discountValue}%` : formatCurrency(order.discountAmount)}
                                    </span>
                                  )}
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                                    {order.paymentMethod}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                  {formatTime(order.timestamp)} ·{' '}
                                  {order.items.reduce((s, i) => s + i.quantity, 0)} items
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-800">
                                  {formatCurrency(order.total)}
                                </p>
                                {order.discountAmount > 0 && (
                                  <p className="text-xs text-slate-400 line-through">
                                    {formatCurrency(order.subtotal)}
                                  </p>
                                )}
                              </div>
                              {orderExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </button>

                            {orderExpanded && (
                              <div className="border-t border-slate-100 px-3 py-2.5">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                                      <th className="pb-2 text-left font-semibold">Item</th>
                                      <th className="pb-2 text-center font-semibold">Qty</th>
                                      <th className="pb-2 text-right font-semibold">Price</th>
                                      <th className="pb-2 text-right font-semibold">Total</th>
                                      <th className="pb-2 text-right font-semibold">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item) => (
                                      <tr key={item.id} className="border-t border-slate-50">
                                        <td className="py-2 text-slate-700">{item.name}</td>
                                        <td className="py-2 text-center text-slate-500">
                                          {item.quantity}
                                        </td>
                                        <td className="py-2 text-right text-slate-500">
                                          {formatCurrency(item.price)}
                                        </td>
                                        <td className="py-2 text-right font-medium text-slate-700">
                                          {formatCurrency(item.lineTotal)}
                                        </td>
                                        <td className="py-2 text-right">
                                          <button
                                            onClick={() =>
                                              setVoidTarget({
                                                orderId: order.id,
                                                itemId: item.id,
                                                itemName: item.name,
                                              })
                                            }
                                            className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                          >
                                            <Ban className="h-3 w-3" />
                                            Void
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                                  <div className="flex justify-between text-slate-500">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(order.subtotal)}</span>
                                  </div>
                                  {order.discountAmount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                      <span>
                                        Discount
                                        {order.discountType === 'percentage' &&
                                          ` (${order.discountValue}%)`}
                                        {order.discountReason && ` · ${order.discountReason}`}
                                      </span>
                                      <span>-{formatCurrency(order.discountAmount)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-bold text-slate-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(order.total)}</span>
                                  </div>
                                  {order.grabAdjustedTotal != null && order.grabAdjustedTotal !== order.total && (
                                    <div className="flex justify-between text-emerald-600">
                                      <span>Grab Adjusted</span>
                                      <span className="font-medium">{formatCurrency(order.grabAdjustedTotal)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-1 text-sm text-slate-500">
                                    <span>Payment Method</span>
                                    <span className="font-medium text-slate-700">
                                      {order.paymentMethod}
                                    </span>
                                  </div>
                                  {order.voidedItems.length > 0 && (
                                    <div className="mt-3 rounded-lg bg-red-50 p-3">
                                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-red-500">
                                        Voided Items
                                      </p>
                                      {order.voidedItems.map((v) => (
                                        <div
                                          key={v.id + v.voidedAt}
                                          className="flex items-center justify-between text-xs text-red-700"
                                        >
                                          <span>
                                            {v.quantity}× {v.name}
                                            <span className="ml-1 text-red-400">
                                              ({v.reason})
                                            </span>
                                          </span>
                                          <span>-{formatCurrency(v.lineTotal)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Void confirmation modal */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Void Item?</h3>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Voiding{' '}
              <span className="font-semibold text-slate-700">
                {voidTarget.itemName}
              </span>{' '}
              from order {voidTarget.orderId}. The order total will be
              recalculated.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reason for Voiding
              </label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Punched by mistake, wrong order..."
                className="w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setVoidTarget(null);
                  setVoidReason('');
                }}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidItem}
                disabled={!voidReason.trim()}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200"
              >
                Void Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Clear All Records?
              </h3>
            </div>
            <p className="mb-5 text-sm text-slate-500">
              This will permanently delete all {orders.length} recorded orders.
              This action cannot be undone and affects all periods.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
