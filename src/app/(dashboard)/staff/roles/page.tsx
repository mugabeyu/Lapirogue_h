import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function RolesPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Receptionist Access"
        subtitle="Access roles configured for reception staff."
        endpoint="/api/roles"
        entityName="roles"
        tableCaption="System roles"
        columns={[
          { key: 'name', label: 'Role name' },
          { key: 'description', label: 'Role description' },
        ]}
      />
    </ProtectedPage>
  );
}
