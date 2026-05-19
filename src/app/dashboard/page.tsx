import Layout from '@/components/Layout';
import ProtectedPage from '@/components/ProtectedPage';
import DashboardDataPage from '@/components/DashboardDataPage';

export default function DashboardRoutePage() {
  return (
    <Layout>
      <ProtectedPage>
        <DashboardDataPage />
      </ProtectedPage>
    </Layout>
  );
}
