'use client';

import { BellIcon, SearchIcon, UserIcon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { User } from '@/types';

export default function Topbar() {
  const { data: user } = useApi<User>('/api/auth/me');

  return (
    <header className="h-16 bg-white border-b border-sand-200 flex items-center justify-between px-8">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search..."
            className="input-field w-full pl-10 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-ink-600 hover:text-primary rounded-lg hover:bg-sand-100 transition-colors">
          <BellIcon className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"></span>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-sand-200">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <div className="font-medium text-sm text-ink-900">
              {user?.name || user?.email || 'Account'}
            </div>
            <div className="text-xs text-ink-600">{user?.role ?? 'Signed in'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
