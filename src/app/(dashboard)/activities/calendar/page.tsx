import ProtectedPage from '@/components/ProtectedPage';
import ActivityCalendarPage from '@/components/forms/ActivityCalendarPage';

export default function ActivityCalendarRoute() {
  return (
    <ProtectedPage>
      <ActivityCalendarPage />
    </ProtectedPage>
  );
}
