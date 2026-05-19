import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function RolesPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Receptionist Access"
        subtitle="The system now runs on a single Receptionist role with full access."
        endpoint="/api/roles"
        columns={[
          { key: 'name', label: 'Role' },
          { key: 'description', label: 'Description' },
        ]}
      />
    </ProtectedPage>
  );
}
