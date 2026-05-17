import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function PaymentsPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Payments"
        subtitle="Track guest payments and balances."
        endpoint="/api/payments"
        searchPlaceholder="Search payments..."
        columns={[
          { key: 'paymentId', label: 'Payment ID' },
          { key: 'reservation', label: 'Reservation' },
          { key: 'guest', label: 'Guest' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'method', label: 'Method' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
