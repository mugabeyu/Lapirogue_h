import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function GuestsPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Guests"
        subtitle="Manage current, upcoming, and past guests."
        endpoint="/api/guests"
        searchPlaceholder="Search guests..."
        columns={[
          { key: 'guestId', label: 'Guest ID' },
          { key: 'firstName', label: 'First Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
