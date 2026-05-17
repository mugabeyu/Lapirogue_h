import ProtectedPage from '@/components/ProtectedPage';
import AddActivityPage from '@/components/forms/AddActivityPage';

export default function NewActivityPage() {
  return (
    <ProtectedPage>
      <AddActivityPage />
    </ProtectedPage>
  );
}
