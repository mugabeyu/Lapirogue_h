import ProtectedPage from '@/components/ProtectedPage';
import ActivitiesListPage from '@/components/activities/ActivitiesListPage';

export default function ActivitiesPage() {
  return (
    <ProtectedPage>
      <ActivitiesListPage />
    </ProtectedPage>
  );
}
