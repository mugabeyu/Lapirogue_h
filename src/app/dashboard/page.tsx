export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Layout from '@/components/Layout';
import DashboardDataPage from '@/components/DashboardDataPage';
import { getServerSession } from '@/lib/auth-server';

export default async function DashboardRoutePage() {
  const user = await getServerSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <Layout user={user}>
      <DashboardDataPage />
    </Layout>
  );
}
