import { redirect } from 'next/navigation';
import Layout from '@/components/Layout';
import { getServerSession } from '@/lib/auth-server';

type ProtectedPageProps = {
  children: React.ReactNode;
};

export default async function ProtectedPage({ children }: ProtectedPageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return <Layout>{children}</Layout>;
}
