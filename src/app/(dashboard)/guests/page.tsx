import ProtectedPage from '@/components/ProtectedPage';
import GuestsPageContent from '@/components/GuestsPage';

export default function GuestsPage() {
  return (
    <ProtectedPage>
      <GuestsPageContent />
    </ProtectedPage>
  );
}
