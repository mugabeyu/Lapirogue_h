import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function ReservationsPage() {
  return (
    <CrudDataTablePage
      title="Reservations"
      subtitle="Manage bookings and check-ins."
      endpoint="/api/reservations"
      searchPlaceholder="Search reservations..."
      addLabel="Add Reservation"
      addHref="/reservations/new"
      entityType="reservation"
      entityName="reservations"
      tableCaption="Hotel reservations"
      columns={[
        { key: 'reservationId', label: 'Reservation ID' },
        { key: 'guest', label: 'Guest name' },
        { key: 'room', label: 'Room number' },
        { key: 'checkIn', label: 'Check-in date', type: 'date' },
        { key: 'checkOut', label: 'Check-out date', type: 'date' },
        { key: 'totalAmount', label: 'Total (Rs)', type: 'currency' },
        { key: 'status', label: 'Booking status', type: 'status' },
      ]}
    />
  );
}
