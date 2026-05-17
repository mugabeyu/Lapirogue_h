import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function StaffPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Staff Management"
        subtitle="Staff records from the database."
        endpoint="/api/staff"
        searchPlaceholder="Search staff..."
        columns={[
          { key: 'employeeCode', label: 'Employee ID' },
          { key: 'name', label: 'Name' },
          { key: 'department', label: 'Department' },
          { key: 'position', label: 'Position' },
          { key: 'email', label: 'Email' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
