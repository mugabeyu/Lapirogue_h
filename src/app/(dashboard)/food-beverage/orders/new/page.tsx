import ProtectedPage from '@/components/ProtectedPage';
import AddFoodOrderPage from '@/components/forms/AddFoodOrderPage';

export default function NewFoodOrderPage() {
  return (
    <ProtectedPage>
      <AddFoodOrderPage />
    </ProtectedPage>
  );
}
