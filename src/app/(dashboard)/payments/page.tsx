'use client';

import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function PaymentsPage() {
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
