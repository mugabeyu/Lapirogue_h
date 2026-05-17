import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function ReportsPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Reports"
        subtitle="Live reporting metrics from the database."
        endpoint="/api/reports"
        columns={[
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value', type: 'number' },
        ]}
      />
    </ProtectedPage>
  );
}
