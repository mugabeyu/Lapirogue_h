import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function StaffPage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Staff Management"
        subtitle="Hotel staff directory and employment details."
        endpoint="/api/staff"
        searchPlaceholder="Search by name, department, or role..."
        entityName="staff members"
        tableCaption="Staff directory"
        columns={[
          { key: 'employeeCode', label: 'Employee ID' },
          { key: 'name', label: 'Full name' },
          { key: 'department', label: 'Department' },
          { key: 'position', label: 'Job title' },
          { key: 'email', label: 'Work email' },
          { key: 'status', label: 'Employment status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
