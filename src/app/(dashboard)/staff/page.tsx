import ProtectedPage from '@/components/ProtectedPage';
import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function StaffPage() {
  return (
    <ProtectedPage>
      <CrudDataTablePage
        title="Staff Management"
        subtitle="Hotel staff directory, onboarding, and main receptionist assignment."
        endpoint="/api/staff"
        addLabel="Add Staff"
        entityType="staff"
        searchPlaceholder="Search by name, department, or role..."
        entityName="staff members"
        tableCaption="Staff directory"
        columns={[
          { key: 'employeeCode', label: 'Employee ID' },
          { key: 'name', label: 'Full name' },
          { key: 'department', label: 'Department' },
          { key: 'position', label: 'Job title' },
          { key: 'email', label: 'Work email' },
          { key: 'roleLabel', label: 'Reception role' },
          { key: 'status', label: 'Employment status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
