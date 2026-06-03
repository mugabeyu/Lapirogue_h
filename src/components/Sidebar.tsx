'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboardIcon,
  UsersIcon,
  BedDoubleIcon,
  CalendarCheckIcon,
  PalmtreeIcon,
  CalendarDaysIcon,
  UtensilsIcon,
  CreditCardIcon,
  LeafIcon,
  UserCogIcon,
  StarIcon,
  MessageSquareIcon,
  SettingsIcon,
  LogOutIcon,
  PanelLeftClose,
  PanelLeftOpen,
  LucideIcon,
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

type NavChild = {
  path: string;
  label: string;
};

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { path: '/guests', label: 'Guests', icon: UsersIcon },
  {
    path: '/rooms',
    label: 'Rooms',
    icon: BedDoubleIcon,
    children: [{ path: '/rooms/assign', label: 'Room Assignment' }],
  },
  {
    path: '/reservations',
    label: 'Reservations',
    icon: CalendarCheckIcon,
    children: [
      { path: '/reservations/calendar', label: 'Calendar View' },
      { path: '/reservations/new', label: 'New Reservation' },
    ],
  },
  {
    path: '/activities',
    label: 'Activities & Tours',
    icon: PalmtreeIcon,
    children: [{ path: '/activities/calendar', label: 'Activity Calendar' }],
  },
  {
    path: '/schedule',
    label: 'Daily Schedules',
    icon: CalendarDaysIcon,
  },
  {
    path: '/food-beverage',
    label: 'Food & Beverage',
    icon: UtensilsIcon,
    children: [{ path: '/food-beverage/orders', label: 'Orders' }],
  },
  { path: '/payments', label: 'Payments', icon: CreditCardIcon },
  { path: '/messages', label: 'Messages', icon: MessageSquareIcon },
  { path: '/sustainability', label: 'Sustainability', icon: LeafIcon },
  {
    path: '/staff',
    label: 'Staff Management',
    icon: UserCogIcon,
    children: [{ path: '/staff/roles', label: 'Roles & Permissions' }],
  },
  { path: '/feedback', label: 'Guest Feedback', icon: StarIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isSectionActive = (item: NavItem) => {
    if (pathname === item.path) return true;
    if (item.children?.some((child) => pathname === child.path)) return true;
    if (item.path !== '/' && pathname.startsWith(item.path + '/')) return true;
    return false;
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 flex flex-col bg-surface text-[var(--color-text-primary)] border-r border-border transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      <div className={`border-b border-border ${collapsed ? 'px-3 py-4' : 'p-6'}`}>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'gap-3'}`}>
          <img
            src="/lapiroguelogo.jpg"
            alt="La Pirogue Logo"
            className={`shrink-0 object-contain ${collapsed ? 'h-8 w-8 rounded' : 'h-8 w-auto'}`}
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-medium tracking-wide text-[var(--color-primary)]">La Pirogue</h1>
              <p className="mt-1 text-sm uppercase tracking-widest text-[var(--color-text-secondary)]">Hotel Operations</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            className={`shrink-0 rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-surface hover:text-[var(--color-text-primary)] ${
              collapsed ? '' : 'ml-auto'
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <PanelLeftClose className="h-5 w-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto py-4">
        <ul className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            const sectionActive = isSectionActive(item);
            const exactActive = pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-all duration-200 ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    exactActive
                      ? 'bg-primary text-white shadow-[var(--shadow-small)]'
                      : sectionActive
                        ? 'bg-surface shadow-sm text-[var(--color-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-surface hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>

                {!collapsed && (
                  <AnimatePresence initial={false}>
                    {item.children && sectionActive && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1 space-y-0.5 overflow-hidden"
                      >
                        {item.children.map((child) => (
                          <li key={child.path}>
                            <Link
                              href={child.path}
                              className={`flex items-center gap-3 rounded-lg py-2 pl-11 pr-3 text-xs font-medium transition-all duration-200 ${
                                pathname === child.path
                                  ? 'text-[var(--color-primary)] font-semibold'
                                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`border-t border-border ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={collapsed ? 'Logout' : undefined}
          className={`flex w-full items-center align-content-center rounded-lg text-sm font-medium bg-transparent text-[var(--color-text-secondary)] ${
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          } hover:bg-surface hover:text-[var(--color-text-primary)]`}
        >
          <LogOutIcon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
        </button>
      </div>
    </aside>
  );
}
