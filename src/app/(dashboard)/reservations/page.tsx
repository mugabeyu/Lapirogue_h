import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function ReservationsPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Reservations"
        subtitle="Manage bookings and check-ins."
        endpoint="/api/reservations"
        searchPlaceholder="Search reservations..."
        columns={[
          { key: 'reservationId', label: 'Reservation ID' },
          { key: 'guest', label: 'Guest' },
          { key: 'room', label: 'Room' },
          { key: 'checkIn', label: 'Check In', type: 'date' },
          { key: 'checkOut', label: 'Check Out', type: 'date' },
          { key: 'totalAmount', label: 'Total', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
