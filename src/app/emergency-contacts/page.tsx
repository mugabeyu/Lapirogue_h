import DataTablePage from '@/components/DataTablePage';

export default function EmergencyContactsPage() {
  return (
    <DataTablePage
      title="Emergency Contacts"
      subtitle="Important response numbers for hotel operations."
      endpoint="/api/emergency-contacts"
      searchPlaceholder="Search emergency contacts..."
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'phoneNumber', label: 'Phone' },
        { key: 'iconName', label: 'Icon' },
        { key: 'colorHex', label: 'Color' },
        { key: 'displayOrder', label: 'Display Order', type: 'number' },
        { key: 'is24h', label: '24/7' },
      ]}
    />
  );
}
