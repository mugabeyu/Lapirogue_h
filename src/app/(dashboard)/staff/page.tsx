'use client';

import CrudDataTablePage from '@/components/CrudDataTablePage';
import { toast } from 'sonner';

export default function StaffPage() {
  async function handleBlockToggle(row: Record<string, unknown>) {
    const newStatus = String(row.status ?? '') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const response = await fetch('/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: row.id,
        employeeCode: row.employeeCode,
        name: row.name,
        department: row.department,
        position: row.position,
        email: row.email,
        phone: row.phone || undefined,
        status: newStatus,
        isMain: row.isMain,
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? `Unable to ${newStatus === 'INACTIVE' ? 'block' : 'unblock'} staff member`);
      throw new Error('Block toggle failed');
    }

    toast.success(newStatus === 'INACTIVE' ? 'Staff blocked' : 'Staff unblocked');
  }

  return (
    <CrudDataTablePage
      title="Staff Management"
      subtitle="Hotel staff directory, onboarding, and main receptionist assignment."
      endpoint="/api/staff"
      addLabel="Add Staff"
      entityType="staff"
      searchPlaceholder="Search by name, department, or role..."
      entityName="staff members"
      tableCaption="Staff directory"
      blockable
      onBlockToggle={handleBlockToggle}
      columns={[
        { key: 'name', label: 'Full name', type: 'image' },
        { key: 'employeeCode', label: 'Employee ID' },
        { key: 'department', label: 'Department' },
        { key: 'position', label: 'Job title' },
        { key: 'email', label: 'Work email' },
        { key: 'roleLabel', label: 'Reception role' },
        { key: 'status', label: 'Employment status', type: 'status' },
      ]}
    />
  );
}
