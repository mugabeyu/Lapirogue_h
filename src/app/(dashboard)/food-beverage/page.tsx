import ProtectedPage from '@/components/ProtectedPage';
import DataTablePage from '@/components/DataTablePage';

export default function FoodBeveragePage() {
  return (
    <ProtectedPage>
      <DataTablePage
        title="Food & Beverage Menu"
        subtitle="Manage restaurant and room service offerings."
        endpoint="/api/menu-items"
        searchPlaceholder="Search menu items..."
        columns={[
          { key: 'name', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'price', label: 'Price', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
        ]}
      />
    </ProtectedPage>
  );
}
