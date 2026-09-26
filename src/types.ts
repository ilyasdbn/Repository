export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  lineTotal: number;
}

export type DiscountType = 'percentage' | 'fixed' | 'none';

export type PaymentMethod = 'Cash' | 'G-Cash' | 'Credit Card' | 'Maya' | 'Maribank' | 'Palawan' | 'Grab';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'G-Cash',
  'Credit Card',
  'Maya',
  'Maribank',
  'Palawan',
  'Grab',
];

export interface VoidedItem {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  lineTotal: number;
  voidedAt: string;
  reason: string;
}

export interface Order {
  id: string;
  timestamp: string;
  items: OrderItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  total: number;
  paymentMethod: PaymentMethod;
  grabAdjustedTotal: number | null;
  voidedItems: VoidedItem[];
}

export type PageName = 'order' | 'records' | 'analytics' | 'menu';
