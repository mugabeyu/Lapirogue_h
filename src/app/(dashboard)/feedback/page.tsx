import ProtectedPage from '@/components/ProtectedPage';
import GuestFeedbackPage from '@/components/feedback/GuestFeedbackPage';

export default function FeedbackPage() {
  return (
    <ProtectedPage>
      <GuestFeedbackPage />
    </ProtectedPage>
  );
}
