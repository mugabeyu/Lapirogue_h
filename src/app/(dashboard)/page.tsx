import ProtectedPage from '@/components/ProtectedPage';
import DashboardDataPage from '@/components/DashboardDataPage';

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <DashboardDataPage />
    </ProtectedPage>
  );
}
