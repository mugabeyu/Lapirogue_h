import ProtectedPage from '@/components/ProtectedPage';
import AddReservationPage from '@/components/forms/AddReservationPage';

export default function NewReservationPage() {
  return (
    <ProtectedPage>
      <AddReservationPage />
    </ProtectedPage>
  );
}
