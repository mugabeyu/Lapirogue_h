'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { User } from '@/types';

interface LayoutProps {
  children: ReactNode;
  user: User;
}

function LayoutShell({ children, user }: LayoutProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div
        className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ease-in-out ${
          collapsed ? 'ml-[72px]' : 'ml-[260px]'
        }`}
      >
        <Topbar />
        <main className="flex-1 overflow-x-hidden px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export default function Layout({ children, user }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutShell user={user}>{children}</LayoutShell>
    </SidebarProvider>
  );
}