import ProtectedPage from '@/components/ProtectedPage';
import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function ReservationsPage() {
  return (
    <ProtectedPage>
      <CrudDataTablePage
        title="Reservations"
        subtitle="Manage bookings and check-ins."
        endpoint="/api/reservations"
        searchPlaceholder="Search reservations..."
        addLabel="Add Reservation"
        entityType="reservation"
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
