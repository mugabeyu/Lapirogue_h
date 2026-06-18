import DataTablePage from '@/components/DataTablePage';

export default function RolesPage() {
  return (
    <DataTablePage
      title="Access Roles"
      subtitle="Roles loaded from the database."
      endpoint="/api/roles"
      entityName="roles"
      tableCaption="System roles"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
    />
  );
}
