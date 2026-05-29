import ProtectedPage from '@/components/ProtectedPage';
import RoomsPageContent from '@/components/RoomsPage';

export default function RoomsRoutePage() {
  return (
    <ProtectedPage>
      <RoomsPageContent />
    </ProtectedPage>
  );
}
