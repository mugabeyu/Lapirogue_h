import ProtectedPage from '@/components/ProtectedPage';
import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function PaymentsPage() {
  return (
    <ProtectedPage>
      <CrudDataTablePage
        title="Payments"
        subtitle="Track guest payments and balances."
        endpoint="/api/payments"
        searchPlaceholder="Search payments..."
        addLabel="Record Payment"
        entityType="payment"
        columns={[
          { key: 'paymentId', label: 'Payment ID' },
          { key: 'guest', label: 'Guest' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'method', label: 'Method' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
