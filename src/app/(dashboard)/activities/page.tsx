import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function ActivitiesPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Activities & Tours"
        subtitle="Manage hotel experiences and excursions."
        endpoint="/api/activities"
        searchPlaceholder="Search activities..."
        columns={[
          { key: 'name', label: 'Activity' },
          { key: 'category', label: 'Category' },
          { key: 'duration', label: 'Duration', type: 'number' },
          { key: 'capacity', label: 'Capacity', type: 'number' },
          { key: 'price', label: 'Price', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
