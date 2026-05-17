import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function NotificationsPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Notifications"
        subtitle="Operational alerts from the database."
        endpoint="/api/notifications"
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'message', label: 'Message' },
          { key: 'category', label: 'Category' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'createdAt', label: 'Created', type: 'date' },
        ]}
      />
    </ProtectedPage>
  );
}
