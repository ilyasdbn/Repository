import { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle2, X, Tag, Percent, Pencil, CreditCard, GripVertical, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import type { MenuItem, CartItem, Order, DiscountType, PaymentMethod } from '@/types';
import { PAYMENT_METHODS } from '@/types';
import { addOrder, formatCurrency } from '@/data/store';

const PAYMENT_ICONS: Record<PaymentMethod, string> = {
  'Cash': '💵',
  'G-Cash': '📱',
  'Credit Card': '💳',
  'Maya': '🏦',
  'Maribank': '🏛️',
  'Palawan': '🏪',
  'Grab': '🚗',
};

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  'Cash': 'border-green-500/50 hover:bg-green-50',
  'G-Cash': 'border-blue-500/50 hover:bg-blue-50',
  'Credit Card': 'border-slate-500/50 hover:bg-slate-50',
  'Maya': 'border-teal-500/50 hover:bg-teal-50',
  'Maribank': 'border-amber-500/50 hover:bg-amber-50',
  'Palawan': 'border-orange-500/50 hover:bg-orange-50',
  'Grab': 'border-emerald-500/50 hover:bg-emerald-50',
};

const DISCOUNT_REASONS = [
  'Senior Discount',
  'PWD Discount',
  'Promotional',
  'Staff Meal',
  'Loyalty',
  'Bulk Order',
  'Other',
];

const CAT_ORDER_KEY = 'pos_category_order';
const CAT_LOCKED_KEY = 'pos_category_locked';

function loadCategoryOrder(): string[] {
  try {
    const raw = localStorage.getItem(CAT_ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCategoryOrder(cats: string[]): void {
  localStorage.setItem(CAT_ORDER_KEY, JSON.stringify(cats));
}

function loadLockedCategories(): Set<string> {
  try {
    const raw = localStorage.getItem(CAT_LOCKED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLockedCategories(locked: Set<string>): void {
  localStorage.setItem(CAT_LOCKED_KEY, JSON.stringify(Array.from(locked)));
}

interface OrderPageProps {
  menu: MenuItem[];
  onOrderComplete: () => Promise<void> | void;
}

const PRESET_DISCOUNTS = [10, 20, 30];

export default function OrderPage({ menu, onOrderComplete }: OrderPageProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [customDiscountReason, setCustomDiscountReason] = useState<string>('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [grabAdjustedTotal, setGrabAdjustedTotal] = useState<number | null>(null);
  const [grabAdjustInput, setGrabAdjustInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Category ordering and lock state
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => loadCategoryOrder());
  const [lockedCategories, setLockedCategories] = useState<Set<string>>(() => loadLockedCategories());
  const [showCategories, setShowCategories] = useState(true);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Mobile: cart visibility
  const [showMobileCart, setShowMobileCart] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(menu.map((m) => m.category));
    const allCats = Array.from(set);
    // Sort by saved order, append any new categories at the end
    const ordered = categoryOrder.filter((c) => allCats.includes(c));
    const newCats = allCats.filter((c) => !ordered.includes(c));
    const result = [...ordered, ...newCats];
    if (result.length !== categoryOrder.length) {
      setCategoryOrder(result);
      saveCategoryOrder(result);
    }
    return result;
  }, [menu, categoryOrder]);

  const filteredMenu = useMemo(() => {
    if (!activeCategory) return menu;
    return menu.filter((m) => m.category === activeCategory);
  }, [menu, activeCategory]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') return (subtotal * discountValue) / 100;
    if (discountType === 'fixed') return Math.min(discountValue, subtotal);
    return 0;
  }, [subtotal, discountType, discountValue]);

  const total = Math.max(0, subtotal - discountAmount);
  const effectiveTotal = selectedPayment === 'Grab' && grabAdjustedTotal != null ? grabAdjustedTotal : total;

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function incrementQty(id: string) {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, quantity: c.quantity + 1 } : c)));
  }

  function decrementQty(id: string) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0),
    );
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function applyPercentageDiscount(pct: number) {
    setDiscountType('percentage');
    setDiscountValue(pct);
  }

  function applyFixedDiscount(amount: number) {
    setDiscountType('fixed');
    setDiscountValue(amount);
  }

  function clearDiscount() {
    setDiscountType('none');
    setDiscountValue(0);
    setDiscountReason('');
    setCustomDiscountReason('');
    setShowDiscountModal(false);
  }

  function getFinalDiscountReason(): string {
    if (discountType === 'none') return '';
    if (discountReason === 'Other') return customDiscountReason.trim() || 'Other';
    return discountReason;
  }

  // Category drag handlers
  function onDragStart(idx: number) {
    if (lockedCategories.has(categories[idx])) return;
    dragIndexRef.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (lockedCategories.has(categories[idx])) return;
    setDragOverIndex(idx);
  }

  function onDrop(idx: number) {
    const from = dragIndexRef.current;
    if (from === null || from === idx || lockedCategories.has(categories[idx])) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    setCategoryOrder(next);
    saveCategoryOrder(next);
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function toggleLock(cat: string) {
    const next = new Set(lockedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setLockedCategories(next);
    saveLockedCategories(next);
  }

  async function completeOrder() {
    if (cart.length === 0 || !selectedPayment || submitting) return;
    setSubmitting(true);
    const finalReason = getFinalDiscountReason();
    const order: Order = {
      id: 'ORD-' + Date.now(),
      timestamp: new Date().toISOString(),
      items: cart.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        category: c.category,
        quantity: c.quantity,
        lineTotal: c.price * c.quantity,
      })),
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      discountReason: finalReason,
      total,
      paymentMethod: selectedPayment,
      grabAdjustedTotal: selectedPayment === 'Grab' ? grabAdjustedTotal : null,
      voidedItems: [],
    };
    await addOrder(order);
    setSubmitting(false);
    setShowReceipt(order);
    setCart([]);
    setDiscountType('none');
    setDiscountValue(0);
    setDiscountReason('');
    setCustomDiscountReason('');
    setSelectedPayment(null);
    setShowPaymentModal(false);
    setGrabAdjustedTotal(null);
    setGrabAdjustInput('');
    await onOrderComplete();
  }

  function selectPayment(method: PaymentMethod) {
    setSelectedPayment(method);
    if (method === 'Grab') {
      setGrabAdjustedTotal(total);
      setGrabAdjustInput(String(total.toFixed(2)));
    } else {
      setGrabAdjustedTotal(null);
      setGrabAdjustInput('');
    }
  }

  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0);

  const categoryColors: Record<string, string> = {
    Breakfast: 'border-amber-500/50 hover:bg-amber-50',
    Shawarmas: 'border-orange-500/50 hover:bg-orange-50',
    'Shawarma Combos': 'border-red-500/50 hover:bg-red-50',
    Extras: 'border-gray-400/50 hover:bg-gray-50',
    Dessert: 'border-pink-500/50 hover:bg-pink-50',
    'Cold Drinks': 'border-sky-500/50 hover:bg-sky-50',
    'Hot Drinks': 'border-rose-500/50 hover:bg-rose-50',
  };

  return (
    <div className="flex h-full flex-col lg:flex-row lg:gap-4">
      {/* Menu side */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Category tabs with drag/lock controls */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setShowCategories((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            title={showCategories ? 'Hide categories' : 'Show categories'}
          >
            {showCategories ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          {showCategories && (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Drag to reorder · Lock to pin
            </span>
          )}
        </div>

        {showCategories && (
          <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('')}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                activeCategory === ''
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Items
            </button>
            {categories.map((cat, idx) => {
              const isLocked = lockedCategories.has(cat);
              return (
                <div
                  key={cat}
                  draggable={!isLocked}
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                  className={`group flex shrink-0 items-center gap-1 rounded-lg border transition-all ${
                    dragOverIndex === idx
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-slate-200 bg-white'
                  } ${isLocked ? 'ring-1 ring-amber-300' : 'cursor-grab active:cursor-grabbing'}`}
                >
                  <span
                    className="flex items-center pl-2 text-slate-300"
                    title={isLocked ? 'Locked — unlock to drag' : 'Drag to reorder'}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-2 text-xs font-semibold transition-all sm:px-3 sm:text-sm ${
                      activeCategory === cat
                        ? 'text-slate-800'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                  <button
                    onClick={() => toggleLock(cat)}
                    className={`flex h-7 w-7 items-center justify-center rounded-r-lg transition-all ${
                      isLocked
                        ? 'text-amber-500 hover:bg-amber-50'
                        : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500'
                    }`}
                    title={isLocked ? 'Unlock category' : 'Lock category in place'}
                  >
                    {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Item buttons grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className={`group flex flex-col items-start justify-between rounded-xl border-2 bg-white p-3 text-left shadow-sm transition-all hover:scale-[1.03] hover:shadow-md active:scale-95 sm:p-4 ${
                  categoryColors[item.category] || 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="mb-1 flex w-full items-start justify-between sm:mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-xs">
                    {item.category}
                  </span>
                  <Plus className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold leading-snug text-slate-800 sm:text-sm">
                    {item.name}
                  </p>
                </div>
                <p className="mt-1 text-base font-bold text-slate-900 sm:mt-2 sm:text-lg">
                  {formatCurrency(item.price)}
                </p>
              </button>
            ))}
          </div>
          {filteredMenu.length === 0 && (
            <div className="flex h-full items-center justify-center text-slate-400">
              No items in this category.
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar — desktop */}
      <div className="hidden w-80 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-lg lg:flex xl:w-96">
        <CartPanel
          cart={cart}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discountType={discountType}
          discountValue={discountValue}
          total={total}
          effectiveTotal={effectiveTotal}
          selectedPayment={selectedPayment}
          grabAdjustedTotal={grabAdjustedTotal}
          showDiscountModal={showDiscountModal}
          onIncrement={incrementQty}
          onDecrement={decrementQty}
          onRemove={removeFromCart}
          onOpenDiscount={() => setShowDiscountModal(true)}
          onClearDiscount={clearDiscount}
          onOpenPayment={() => setShowPaymentModal(true)}
        />
      </div>

      {/* Mobile cart toggle button */}
      {cartItemCount > 0 && !showMobileCart && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-green-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-green-700 active:scale-95 lg:hidden"
        >
          <ShoppingCart className="h-5 w-5" />
          {cartItemCount} items · {formatCurrency(effectiveTotal)}
        </button>
      )}

      {/* Mobile cart drawer */}
      {showMobileCart && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-bold text-slate-800">Current Order</h2>
            <button
              onClick={() => setShowMobileCart(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CartPanel
              cart={cart}
              subtotal={subtotal}
              discountAmount={discountAmount}
              discountType={discountType}
              discountValue={discountValue}
              total={total}
              effectiveTotal={effectiveTotal}
              selectedPayment={selectedPayment}
              grabAdjustedTotal={grabAdjustedTotal}
              showDiscountModal={showDiscountModal}
              onIncrement={incrementQty}
              onDecrement={decrementQty}
              onRemove={removeFromCart}
              onOpenDiscount={() => setShowDiscountModal(true)}
              onClearDiscount={clearDiscount}
              onOpenPayment={() => setShowPaymentModal(true)}
              isMobile
            />
          </div>
        </div>
      )}

      {/* Discount modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Apply Discount</h3>
              <button onClick={() => setShowDiscountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preset percentages */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Percentage Discounts
            </p>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {PRESET_DISCOUNTS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => applyPercentageDiscount(pct)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all hover:scale-105 sm:py-4 ${
                    discountType === 'percentage' && discountValue === pct
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Percent className="h-5 w-5 text-slate-500" />
                  <span className="text-lg font-bold text-slate-800">{pct}%</span>
                </button>
              ))}
            </div>

            {/* Manual fixed amount */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Manual Discount Amount
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = Number((e.currentTarget.elements.namedItem('amount') as HTMLInputElement).value);
                if (!isNaN(val) && val > 0) applyFixedDiscount(val);
              }}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Pencil className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter amount"
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <button type="submit" className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
                  Apply
                </button>
              </div>
            </form>

            {/* Discount reason */}
            {discountType !== 'none' && (
              <>
                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reason for Discount
                </p>
                <div className="flex flex-wrap gap-2">
                  {DISCOUNT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setDiscountReason(r)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        discountReason === r
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {discountReason === 'Other' && (
                  <input
                    type="text"
                    value={customDiscountReason}
                    onChange={(e) => setCustomDiscountReason(e.target.value)}
                    placeholder="Specify reason..."
                    className="mt-2 w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                )}
              </>
            )}

            {discountType !== 'none' && (
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                Current: <span className="font-semibold text-slate-800">
                  {discountType === 'percentage' ? `${discountValue}% off` : `${formatCurrency(discountValue)} off`}
                </span>
                {getFinalDiscountReason() && (
                  <span className="text-slate-500"> · {getFinalDiscountReason()}</span>
                )}
              </div>
            )}

            {discountType !== 'none' && (
              <button onClick={clearDiscount} className="mt-3 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Remove Discount
              </button>
            )}
          </div>
        </div>
      )}

      {/* Payment method modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Select Payment Method</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => selectPayment(method)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] sm:p-4 ${
                    selectedPayment === method ? 'border-green-500 bg-green-50' : PAYMENT_COLORS[method]
                  }`}
                >
                  <span className="text-xl sm:text-2xl">{PAYMENT_ICONS[method]}</span>
                  <p className="text-sm font-bold text-slate-800">{method}</p>
                </button>
              ))}
            </div>

            {/* Grab price adjustment */}
            {selectedPayment === 'Grab' && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">🚗</span>
                  <p className="text-sm font-bold text-slate-800">Adjust Grab Total</p>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Grab's pricing may differ from your register total. Enter the actual Grab price below.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={grabAdjustInput}
                    onChange={(e) => {
                      setGrabAdjustInput(e.target.value);
                      const val = Number(e.target.value);
                      setGrabAdjustedTotal(isNaN(val) || val < 0 ? total : val);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 py-2.5 px-3 text-sm font-bold text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <button
                    onClick={() => { setGrabAdjustedTotal(total); setGrabAdjustInput(String(total.toFixed(2))); }}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    Reset
                  </button>
                </div>
                {grabAdjustedTotal != null && grabAdjustedTotal !== total && (
                  <p className="mt-2 text-xs text-emerald-600">
                    Adjusted from {formatCurrency(total)} to {formatCurrency(grabAdjustedTotal)}
                    ({grabAdjustedTotal > total ? '+' : ''}{formatCurrency(grabAdjustedTotal - total)})
                  </p>
                )}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Order Total</span>
                <span className="font-bold text-slate-800">{formatCurrency(effectiveTotal)}</span>
              </div>
            </div>

            <button
              onClick={completeOrder}
              disabled={!selectedPayment || submitting}
              className="w-full rounded-xl bg-green-600 px-4 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <CheckCircle2 className="mr-2 inline h-5 w-5" />
              Complete Order
            </button>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex flex-col items-center">
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Order Complete!</h3>
              <p className="text-sm text-slate-500">{showReceipt.id}</p>
            </div>

            <div className="space-y-1.5 border-y border-slate-100 py-4 text-sm">
              {showReceipt.items.map((item) => (
                <div key={item.id} className="flex justify-between text-slate-600">
                  <span>{item.quantity}× {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 py-4 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(showReceipt.subtotal)}</span>
              </div>
              {showReceipt.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount ({showReceipt.discountType === 'percentage' ? `${showReceipt.discountValue}%` : formatCurrency(showReceipt.discountValue)})
                    {showReceipt.discountReason && ` · ${showReceipt.discountReason}`}
                  </span>
                  <span>-{formatCurrency(showReceipt.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(showReceipt.total)}</span>
              </div>
              {showReceipt.grabAdjustedTotal != null && showReceipt.grabAdjustedTotal !== showReceipt.total && (
                <div className="flex justify-between text-emerald-600">
                  <span>Grab Adjusted</span>
                  <span className="font-medium">{formatCurrency(showReceipt.grabAdjustedTotal)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm text-slate-500">
                <span>Paid with</span>
                <span className="font-medium text-slate-700">{showReceipt.paymentMethod}</span>
              </div>
            </div>

            <button
              onClick={() => { setShowReceipt(null); setShowMobileCart(false); }}
              className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700"
            >
              New Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Cart Panel Component ---

interface CartPanelProps {
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  discountType: DiscountType;
  discountValue: number;
  total: number;
  effectiveTotal: number;
  selectedPayment: PaymentMethod | null;
  grabAdjustedTotal: number | null;
  showDiscountModal: boolean;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenDiscount: () => void;
  onClearDiscount: () => void;
  onOpenPayment: () => void;
  isMobile?: boolean;
}

function CartPanel({
  cart,
  subtotal,
  discountAmount,
  discountType,
  discountValue,
  total,
  effectiveTotal,
  selectedPayment,
  grabAdjustedTotal,
  onIncrement,
  onDecrement,
  onRemove,
  onOpenDiscount,
  onClearDiscount,
  onOpenPayment,
  isMobile,
}: CartPanelProps) {
  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className={`flex h-full flex-col ${isMobile ? '' : ''}`}>
      {!isMobile && (
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <ShoppingCart className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-800">Current Order</h2>
          {cartItemCount > 0 && (
            <span className="ml-auto rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
              {cartItemCount} items
            </span>
          )}
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">No items yet</p>
            <p className="text-xs">Tap items to add them</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(item.price)} each</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onDecrement(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 active:scale-90"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                  <button
                    onClick={() => onIncrement(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 active:scale-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="w-14 text-right text-sm font-bold text-slate-800 sm:w-16">
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discount + totals + complete */}
      <div className="border-t border-slate-200 px-3 py-3 sm:px-5 sm:py-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={onOpenDiscount}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Tag className="h-4 w-4" />
            {discountType === 'none' ? 'Add Discount' : 'Edit Discount'}
          </button>
          {discountType !== 'none' && (
            <button onClick={onClearDiscount} className="text-xs font-medium text-red-500 hover:text-red-700">
              Remove
            </button>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount{discountType === 'percentage' && ` (${discountValue}%)`}</span>
              <span className="font-medium">-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {selectedPayment === 'Grab' && grabAdjustedTotal != null && grabAdjustedTotal !== total && (
            <div className="flex justify-between text-emerald-600">
              <span>Grab Total</span>
              <span className="font-bold">{formatCurrency(grabAdjustedTotal)}</span>
            </div>
          )}
        </div>

        {selectedPayment && (
          <div className="mb-3 mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-700">{selectedPayment}</span>
          </div>
        )}

        <button
          onClick={onOpenPayment}
          disabled={cart.length === 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <CheckCircle2 className="h-5 w-5" />
          {selectedPayment ? 'Complete Order' : 'Select Payment & Complete'}
        </button>
      </div>
    </div>
  );
}
