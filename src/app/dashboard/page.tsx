export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Layout from '@/components/Layout';
import DashboardDataPage from '@/components/DashboardDataPage';
import { getServerSession } from '@/lib/auth-server';

export default async function DashboardRoutePage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <Layout>
      <DashboardDataPage />
    </Layout>
  );
}
