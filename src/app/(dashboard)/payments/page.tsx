'use client';

import { useApi } from '@/hooks/useApi';
import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function PaymentsPage() {
  const { data: user } = useApi<{ role: string }>('/api/auth/me');

  if (user?.role === 'RECEPTIONIST') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-4xl text-[var(--color-text-primary)]">Access Denied</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">You do not have permission to view payments.</p>
        </div>
      </div>
    );
  }

  return (
    <CrudDataTablePage
      title="Payments"
      subtitle="Track guest payments and balances."
      endpoint="/api/payments"
      searchPlaceholder="Search payments..."
      addLabel="Record Payment"
      entityType="payment"
      entityName="payments"
      tableCaption="Guest payments ledger"
      rowHrefBase="/payments"
      disableEdit
      disableDelete
      columns={[
        { key: 'paymentId', label: 'Payment ID' },
        { key: 'guest', label: 'Guest name', type: 'guest' },
        { key: 'amount', label: 'Amount (Rs)', type: 'currency' },
        { key: 'method', label: 'Payment method' },
        { key: 'status', label: 'Payment status', type: 'status' },
      ]}
    />
  );
}
