import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function FoodOrdersPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Food Orders"
        subtitle="Room service and restaurant orders."
        endpoint="/api/food-orders"
        searchPlaceholder="Search orders..."
        columns={[
          { key: 'orderId', label: 'Order ID' },
          { key: 'guest', label: 'Guest' },
          { key: 'room', label: 'Room' },
          { key: 'total', label: 'Total', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'createdAt', label: 'Created', type: 'date' },
        ]}
      />
    </ProtectedPage>
  );
}
