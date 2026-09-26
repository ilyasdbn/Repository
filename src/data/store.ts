import { createClient } from '@supabase/supabase-js';
import type { MenuItem, Order, VoidedItem } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// localStorage fallback keys for offline mode
const MENU_KEY = 'pos_menu';
const ORDERS_KEY = 'pos_orders';

export const DEFAULT_MENU: MenuItem[] = [
  // Breakfast
  { id: 'b1', name: 'Vegan Wrap', price: 100, category: 'Breakfast' },
  { id: 'b2', name: 'Egg Wrap', price: 120, category: 'Breakfast' },
  { id: 'b3', name: 'Omelet', price: 120, category: 'Breakfast' },
  { id: 'b4', name: 'Sunny Side Up', price: 120, category: 'Breakfast' },
  { id: 'b5', name: 'Menemen', price: 145, category: 'Breakfast' },
  { id: 'b6', name: 'Breakfast Combo', price: 145, category: 'Breakfast' },
  // Shawarmas
  { id: 's1', name: 'Shawarma Wrap', price: 199, category: 'Shawarmas' },
  { id: 's2', name: 'Shawarma Rice', price: 199, category: 'Shawarmas' },
  { id: 's3', name: 'Shawarma Wrap with Drink', price: 209, category: 'Shawarmas' },
  { id: 's4', name: 'Shawarma Rice with Drink', price: 209, category: 'Shawarmas' },
  // Shawarma Combos
  { id: 'sc1', name: 'Solo Combo', price: 239, category: 'Shawarma Combos' },
  { id: 'sc2', name: 'Couple Combo', price: 449, category: 'Shawarma Combos' },
  { id: 'sc3', name: 'Family Combo', price: 649, category: 'Shawarma Combos' },
  // Extras
  { id: 'e1', name: 'Butter Rice', price: 30, category: 'Extras' },
  { id: 'e2', name: 'Extra Bread', price: 30, category: 'Extras' },
  // Dessert
  { id: 'd1', name: 'Sütlaç', price: 40, category: 'Dessert' },
  { id: 'd2', name: 'Kabak Tatlısı', price: 139, category: 'Dessert' },
  // Cold Drinks
  { id: 'c1', name: 'Homemade Lemonade', price: 85, category: 'Cold Drinks' },
  { id: 'c2', name: 'Homemade Iced Tea', price: 85, category: 'Cold Drinks' },
  { id: 'c3', name: 'Coca Cola 1.5L', price: 125, category: 'Cold Drinks' },
  { id: 'c4', name: 'Soft Drinks (Coke/Sprite/Royal)', price: 25, category: 'Cold Drinks' },
  { id: 'c5', name: 'Water', price: 20, category: 'Cold Drinks' },
  // Hot Drinks
  { id: 'h1', name: 'Turkish Tea', price: 85, category: 'Hot Drinks' },
  { id: 'h2', name: 'Milk Tea', price: 85, category: 'Hot Drinks' },
  { id: 'h3', name: 'Turkish Coffee', price: 90, category: 'Hot Drinks' },
];

// --- Local storage helpers (offline fallback) ---

function localLoadMenu(): MenuItem[] {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (!raw) {
      localStorage.setItem(MENU_KEY, JSON.stringify(DEFAULT_MENU));
      return DEFAULT_MENU;
    }
    return JSON.parse(raw) as MenuItem[];
  } catch {
    return DEFAULT_MENU;
  }
}

function localSaveMenu(items: MenuItem[]): void {
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
}

function localLoadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

function localSaveOrders(orders: Order[]): void {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

// --- Supabase menu operations ---

export async function loadMenu(): Promise<MenuItem[]> {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, price, category, sort_order')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      return DEFAULT_MENU;
    }
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
    }));
  } catch {
    return localLoadMenu();
  }
}

export async function saveMenu(items: MenuItem[]): Promise<void> {
  localSaveMenu(items);
  try {
    const rows = items.map((item, index) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      sort_order: index,
    }));
    await supabase.from('menu_items').delete().neq('id', '__placeholder__');
    const { error } = await supabase.from('menu_items').insert(rows);
    if (error) throw error;
  } catch {
    // offline fallback already saved locally
  }
}

// --- Supabase order operations ---

export async function loadOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('timestamp', { ascending: true });

    if (error) throw error;
    if (!data) return localLoadOrders();
    const remoteOrders = data.map(rowToOrder);

    // Sync any local-only orders to the cloud
    const local = localLoadOrders();
    const remoteIds = new Set(remoteOrders.map((o) => o.id));
    const localOnly = local.filter((o) => !remoteIds.has(o.id));
    if (localOnly.length > 0) {
      for (const order of localOnly) {
        try {
          await supabase.from('orders').insert({
            id: order.id,
            timestamp: order.timestamp,
            items: order.items,
            subtotal: order.subtotal,
            discount_type: order.discountType,
            discount_value: order.discountValue,
            discount_amount: order.discountAmount,
            discount_reason: order.discountReason,
            total: order.total,
            payment_method: order.paymentMethod,
            grab_adjusted_total: order.grabAdjustedTotal,
            voided_items: order.voidedItems,
          });
        } catch {
          // will retry next load
        }
      }
      // Reload to get the synced data
      const { data: reloaded } = await supabase
        .from('orders')
        .select('*')
        .order('timestamp', { ascending: true });
      if (reloaded) return reloaded.map(rowToOrder);
    }

    return remoteOrders;
  } catch {
    return localLoadOrders();
  }
}

export async function addOrder(order: Order): Promise<void> {
  const local = localLoadOrders();
  local.push(order);
  localSaveOrders(local);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await supabase.from('orders').insert({
        id: order.id,
        timestamp: order.timestamp,
        items: order.items,
        subtotal: order.subtotal,
        discount_type: order.discountType,
        discount_value: order.discountValue,
        discount_amount: order.discountAmount,
        discount_reason: order.discountReason,
        total: order.total,
        payment_method: order.paymentMethod,
        grab_adjusted_total: order.grabAdjustedTotal,
        voided_items: order.voidedItems,
      });
      if (error) throw error;
      return;
    } catch (err) {
      if (attempt === 1) {
        console.error('Failed to save order to cloud after retry:', err);
      }
    }
  }
}

export async function clearAllOrders(): Promise<void> {
  localSaveOrders([]);
  try {
    const { error } = await supabase.from('orders').delete().neq('id', '__placeholder__');
    if (error) throw error;
  } catch {
    // offline fallback
  }
}

export async function voidOrderItem(
  orderId: string,
  itemId: string,
  reason: string,
): Promise<Order[]> {
  // Load from local first; fall back to remote if local is empty
  let orders = localLoadOrders();
  if (orders.length === 0) {
    orders = await loadOrders();
  }
  const order = orders.find((o) => o.id === orderId);
  if (!order) return orders;

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return orders;

  const voided: VoidedItem = {
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    voidedAt: new Date().toISOString(),
    reason,
  };

  order.voidedItems = [...order.voidedItems, voided];
  order.items = order.items.filter((i) => i.id !== itemId);
  order.subtotal = order.items.reduce((s, i) => s + i.lineTotal, 0);

  if (order.discountType === 'percentage') {
    order.discountAmount = (order.subtotal * order.discountValue) / 100;
  } else if (order.discountType === 'fixed') {
    order.discountAmount = Math.min(order.discountValue, order.subtotal);
  } else {
    order.discountAmount = 0;
  }
  order.total = Math.max(0, order.subtotal - order.discountAmount);

  localSaveOrders(orders);

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        items: order.items,
        subtotal: order.subtotal,
        discount_amount: order.discountAmount,
        discount_reason: order.discountReason,
        total: order.total,
        grab_adjusted_total: order.grabAdjustedTotal,
        voided_items: order.voidedItems,
      })
      .eq('id', orderId);
    if (error) throw error;
  } catch {
    // offline fallback
  }

  return orders;
}

// --- Pruning ---

const MAX_RECORD_AGE_DAYS = 90;

export async function pruneOldOrders(): Promise<Order[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_RECORD_AGE_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const orders = localLoadOrders();
  const pruned = orders.filter((o) => new Date(o.timestamp) >= cutoff);
  if (pruned.length !== orders.length) {
    localSaveOrders(pruned);
  }

  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .lt('timestamp', cutoff.toISOString());
    if (error) throw error;
  } catch {
    // offline fallback
  }

  return pruned;
}

// --- Helpers ---

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    items: row.items as Order['items'],
    subtotal: Number(row.subtotal),
    discountType: row.discount_type as Order['discountType'],
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    discountReason: (row.discount_reason as string) ?? '',
    total: Number(row.total),
    paymentMethod: row.payment_method as Order['paymentMethod'],
    grabAdjustedTotal: row.grab_adjusted_total != null ? Number(row.grab_adjusted_total) : null,
    voidedItems: row.voided_items as Order['voidedItems'],
  };
}

export function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getDayName(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export function getDateKey(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const BUSINESS_DAY_START_HOUR = 4;

export function getBusinessDayKey(iso: string): string {
  const d = new Date(iso);
  if (d.getHours() < BUSINESS_DAY_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBusinessDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function isTodayBusinessDay(dateKey: string): boolean {
  return dateKey === getBusinessDayKey(new Date().toISOString());
}
