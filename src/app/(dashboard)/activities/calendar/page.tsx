import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function ActivityCalendarPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Activity Calendar"
        subtitle="Activity sessions from the database."
        endpoint="/api/activities"
        columns={[
          { key: 'name', label: 'Activity' },
          { key: 'category', label: 'Category' },
          { key: 'duration', label: 'Duration', type: 'number' },
          { key: 'capacity', label: 'Capacity', type: 'number' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
