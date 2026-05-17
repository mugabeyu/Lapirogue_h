import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function RolesPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Roles & Permissions"
        subtitle="Role definitions from the database."
        endpoint="/api/roles"
        columns={[
          { key: 'name', label: 'Role' },
          { key: 'description', label: 'Description' },
        ]}
      />
    </ProtectedPage>
  );
}
