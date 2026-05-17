import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function ReservationCalendarPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Reservation Calendar"
        subtitle="Reservation dates from the database."
        endpoint="/api/reservations"
        columns={[
          { key: 'reservationId', label: 'Reservation ID' },
          { key: 'guest', label: 'Guest' },
          { key: 'room', label: 'Room' },
          { key: 'checkIn', label: 'Check In', type: 'date' },
          { key: 'checkOut', label: 'Check Out', type: 'date' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
