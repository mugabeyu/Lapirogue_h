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
        entityName="rooms"
        tableCaption="Room inventory"
        columns={[
          { key: 'roomNumber', label: 'Room number' },
          { key: 'type', label: 'Room type' },
          { key: 'capacity', label: 'Guest capacity', type: 'number' },
          { key: 'price', label: 'Nightly rate (Rs)', type: 'currency' },
          { key: 'status', label: 'Availability', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
