import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Receipt, BarChart3, UtensilsCrossed, Loader2 } from 'lucide-react';
import type { PageName, MenuItem, Order } from '@/types';
import { loadMenu, loadOrders, pruneOldOrders } from '@/data/store';
import OrderPage from '@/pages/OrderPage';
import RecordsPage from '@/pages/RecordsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import MenuPage from '@/pages/MenuPage';

const NAV_ITEMS: { id: PageName; label: string; icon: typeof ShoppingCart }[] = [
  { id: 'order', label: 'Take Order', icon: ShoppingCart },
  { id: 'records', label: 'Sales Records', icon: Receipt },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
];

export default function App() {
  const [page, setPage] = useState<PageName>('order');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshMenu = useCallback(async () => {
    const data = await loadMenu();
    setMenu(data);
  }, []);

  const refreshOrders = useCallback(async () => {
    const pruned = await pruneOldOrders();
    const data = await loadOrders();
    const merged = mergeOrders(pruned, data);
    setOrders(merged);
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([refreshMenu(), refreshOrders()]);
      setLoading(false);
    })();
  }, [refreshMenu, refreshOrders]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm font-medium text-slate-500">Loading POS System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top navigation bar */}
      <header className="z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 shadow-md">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-800">
                POS System
              </h1>
              <p className="text-xs text-slate-400">Cloud Synced</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2 py-2 sm:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden p-4 lg:p-6">
        {page === 'order' && (
          <OrderPage menu={menu} onOrderComplete={refreshOrders} />
        )}
        {page === 'records' && (
          <RecordsPage orders={orders} onOrdersChanged={refreshOrders} />
        )}
        {page === 'analytics' && <AnalyticsPage orders={orders} />}
        {page === 'menu' && (
          <MenuPage menu={menu} onMenuChanged={refreshMenu} />
        )}
      </main>
    </div>
  );
}

function mergeOrders(local: Order[], remote: Order[]): Order[] {
  const map = new Map<string, Order>();
  for (const o of remote) map.set(o.id, o);
  for (const o of local) {
    if (!map.has(o.id)) map.set(o.id, o);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}
