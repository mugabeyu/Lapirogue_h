import React from 'react';
import { redirect } from 'next/navigation';
import Layout from '@/components/Layout';
import { getServerSession } from '@/lib/auth-server';
import { User } from '@/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return <Layout user={session}>{children}</Layout>;
}