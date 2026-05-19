import ProtectedPage from '@/components/ProtectedPage';
import FoodOrdersListPage from '@/components/food-beverage/FoodOrdersListPage';

export default function FoodOrdersPage() {
  return (
    <ProtectedPage>
      <FoodOrdersListPage />
    </ProtectedPage>
  );
}
