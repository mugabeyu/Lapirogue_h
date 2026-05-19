import ProtectedPage from '@/components/ProtectedPage';
import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function RoomsPage() {
  return (
    <ProtectedPage>
      <CrudDataTablePage
        title="Rooms"
        subtitle="Manage room inventory, status, and pricing."
        endpoint="/api/rooms"
        searchPlaceholder="Search rooms..."
        addLabel="Add Room"
        entityType="room"
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
