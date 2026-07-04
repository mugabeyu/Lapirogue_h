export type BillingChargeCategory =
  | 'Room charges'
  | 'Food & Beverage orders'
  | 'Tours and activities'
  | 'Transport services'
  | 'Laundry/services'
  | 'Additional hotel purchases'
  | 'Taxes and service charges';

export type BillingLineItem = {
  category: BillingChargeCategory;
  label: string;
  amount: number;
  source?: string;
  sourceId?: string;
  createdAt?: string | null;
};

export type BillingSummary = {
  items: BillingLineItem[];
  totals: Record<BillingChargeCategory, number>;
  totalCharges: number;
  totalPaid: number;
  balanceDue: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
};

const DEFAULT_TOTALS: Record<BillingChargeCategory, number> = {
  'Room charges': 0,
  'Food & Beverage orders': 0,
  'Tours and activities': 0,
  'Transport services': 0,
  'Laundry/services': 0,
  'Additional hotel purchases': 0,
  'Taxes and service charges': 0,
};

export function buildBillingSummary({
  roomCharges = [],
  activityCharges = [],
  foodOrders = [],
  extraCharges = [],
  payments = [],
}: {
  roomCharges?: Array<{ amount: number; label: string; sourceId?: string; createdAt?: string | null }>;
  activityCharges?: Array<{ amount: number; label: string; sourceId?: string; createdAt?: string | null }>;
  foodOrders?: Array<{
    id: string;
    orderId: string;
    subtotal?: number;
    serviceCharge?: number;
    taxAmount?: number;
    total: number;
    createdAt?: string | null;
  }>;
  extraCharges?: Array<{
    category: Exclude<BillingChargeCategory, 'Room charges' | 'Food & Beverage orders' | 'Tours and activities' | 'Taxes and service charges'>;
    amount: number;
    label: string;
    sourceId?: string;
    createdAt?: string | null;
  }>;
  payments?: Array<{ amount: number; status: string }>;
}): BillingSummary {
  const items: BillingLineItem[] = [];
  const totals = { ...DEFAULT_TOTALS };

  roomCharges.forEach((item) => {
    if (item.amount <= 0) return;
    totals['Room charges'] += item.amount;
    items.push({ category: 'Room charges', label: item.label, amount: item.amount, sourceId: item.sourceId, createdAt: item.createdAt });
  });

  activityCharges.forEach((item) => {
    if (item.amount <= 0) return;
    totals['Tours and activities'] += item.amount;
    items.push({ category: 'Tours and activities', label: item.label, amount: item.amount, sourceId: item.sourceId, createdAt: item.createdAt });
  });

  foodOrders.forEach((order) => {
    const subtotal = Number(order.subtotal ?? 0);
    const serviceCharge = Number(order.serviceCharge ?? 0);
    const taxAmount = Number(order.taxAmount ?? 0);
    const total = Number(order.total ?? subtotal + serviceCharge + taxAmount);

    if (subtotal > 0) {
      totals['Food & Beverage orders'] += subtotal;
      items.push({ category: 'Food & Beverage orders', label: `${order.orderId} subtotal`, amount: subtotal, sourceId: order.id, createdAt: order.createdAt });
    }
    if (serviceCharge > 0) {
      totals['Taxes and service charges'] += serviceCharge;
      items.push({ category: 'Taxes and service charges', label: `${order.orderId} service charge`, amount: serviceCharge, sourceId: order.id, createdAt: order.createdAt });
    }
    if (taxAmount > 0) {
      totals['Taxes and service charges'] += taxAmount;
      items.push({ category: 'Taxes and service charges', label: `${order.orderId} tax`, amount: taxAmount, sourceId: order.id, createdAt: order.createdAt });
    }
    if (total > 0 && subtotal <= 0 && serviceCharge <= 0 && taxAmount <= 0) {
      totals['Food & Beverage orders'] += total;
      items.push({ category: 'Food & Beverage orders', label: order.orderId, amount: total, sourceId: order.id, createdAt: order.createdAt });
    }
  });

  extraCharges.forEach((item) => {
    if (item.amount <= 0) return;
    totals[item.category] += item.amount;
    items.push({ category: item.category, label: item.label, amount: item.amount, sourceId: item.sourceId, createdAt: item.createdAt });
  });

  function isPaymentCompleted(status: string): boolean {
    const s = status.toUpperCase();
    return s === 'PAID' || s === 'COMPLETED' || s === 'PARTIALLY_PAID';
  }

  const totalCharges = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const totalPaid = payments.reduce((sum, payment) => {
    if (payment.status === 'REFUNDED') return sum - payment.amount;
    if (isPaymentCompleted(payment.status)) return sum + payment.amount;
    return sum;
  }, 0);
  const balanceDue = Math.max(totalCharges - totalPaid, 0);

  const status = totalCharges === 0
    ? 'PENDING'
    : balanceDue === 0 && totalPaid > 0
      ? 'PAID'
      : totalPaid > 0
        ? 'PARTIALLY_PAID'
        : 'PENDING';

  return { items, totals, totalCharges, totalPaid, balanceDue, status };
}