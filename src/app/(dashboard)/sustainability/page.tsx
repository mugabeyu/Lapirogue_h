import ProtectedPage from '@/components/ProtectedPage';
import SustainabilityDashboardPage from '@/components/sustainability/SustainabilityDashboardPage';

export default function SustainabilityPage() {
  return (
    <ProtectedPage>
      <SustainabilityDashboardPage />
    </ProtectedPage>
  );
}
