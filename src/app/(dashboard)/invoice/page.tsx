import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function InvoicePage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Invoices"
        subtitle="Payment records from the database."
        endpoint="/api/payments"
        columns={[
          { key: 'paymentId', label: 'Invoice Reference' },
          { key: 'guest', label: 'Guest' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'createdAt', label: 'Created', type: 'date' },
        ]}
      />
    </ProtectedPage>
  );
}
