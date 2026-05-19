import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function InvoicePage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Invoices"
        subtitle="Issued invoices linked to guest payments."
        endpoint="/api/payments"
        entityName="invoices"
        tableCaption="Invoice register"
        searchPlaceholder="Search invoices..."
        columns={[
          { key: 'paymentId', label: 'Invoice reference' },
          { key: 'guest', label: 'Guest name' },
          { key: 'amount', label: 'Amount (Rs)', type: 'currency' },
          { key: 'status', label: 'Invoice status', type: 'status' },
          { key: 'createdAt', label: 'Issue date', type: 'date' },
        ]}
      />
    </ProtectedPage>
  );
}
