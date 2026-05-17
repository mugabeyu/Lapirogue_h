import ProtectedPage from '@/components/ProtectedPage';
import GuestDetailsContent from '@/components/GuestDetailsPage';

export default function GuestDetailsPage() {
  return (
    <ProtectedPage>
      <GuestDetailsContent />
    </ProtectedPage>
  );
}
