'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';

interface LayoutProps {
  children: ReactNode;
}

function LayoutShell({ children }: LayoutProps) {
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
        <main className="flex-1 overflow-x-hidden p-8">{children}</main>
      </div>
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutShell>{children}</LayoutShell>
    </SidebarProvider>
  );
}
