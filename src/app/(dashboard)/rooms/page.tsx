import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function RoomsPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Rooms"
        subtitle="Manage room inventory, status, and pricing."
        endpoint="/api/rooms"
        searchPlaceholder="Search rooms..."
        columns={[
          { key: 'roomNumber', label: 'Room' },
          { key: 'type', label: 'Type' },
          { key: 'capacity', label: 'Capacity', type: 'number' },
          { key: 'price', label: 'Price', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
