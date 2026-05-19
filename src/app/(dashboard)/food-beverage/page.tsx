import ProtectedPage from '@/components/ProtectedPage';
import FoodBeverageMenuPage from '@/components/food-beverage/FoodBeverageMenuPage';

export default function FoodBeveragePage() {
  return (
    <ProtectedPage>
      <FoodBeverageMenuPage />
    </ProtectedPage>
  );
}
