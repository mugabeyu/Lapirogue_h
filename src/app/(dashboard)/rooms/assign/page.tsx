import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function RoomAssignmentPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Room Assignment"
        subtitle="Available rooms from the database."
        endpoint="/api/rooms?status=AVAILABLE"
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
