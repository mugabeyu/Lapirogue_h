import ProtectedPage from '@/components/ProtectedPage';
import CrudDataTablePage from '@/components/CrudDataTablePage';

export default function FoodBeveragePage() {
  return (
    <ProtectedPage>
      <CrudDataTablePage
        title="Food & Beverage Menu"
        subtitle="Manage restaurant and room service offerings."
        endpoint="/api/menu-items"
        searchPlaceholder="Search menu items..."
        addLabel="Add Menu Item"
        entityType="menu-item"
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
