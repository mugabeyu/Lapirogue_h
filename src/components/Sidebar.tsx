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
  Building2Icon,
  HotelIcon,
  LucideIcon,
  ShieldIcon,
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { useApi } from '@/hooks/useApi';
import type { User, Role } from '@/types';

type NavChild = {
  path: string;
  label: string;
};

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
  roles?: Role[];
};

// ── Admin Navigation ──────────────────────────────────────────
const adminNav: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
  { path: '/departments', label: 'Departments', icon: Building2Icon },
  { path: '/managers', label: 'Managers', icon: UserCogIcon },
  { path: '/audit-log', label: 'Audit Log', icon: ShieldIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

// ── Manager Navigation ────────────────────────────────────────
const managerNav: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
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
  { path: '/payments', label: 'Payments', icon: CreditCardIcon },
  {
    path: '/activities',
    label: 'Activities & Tours',
    icon: PalmtreeIcon,
    children: [{ path: '/activities/calendar', label: 'Activity Calendar' }],
  },
  {
    path: '/food-beverage',
    label: 'Food & Beverage',
    icon: UtensilsIcon,
    children: [{ path: '/food-beverage/orders', label: 'Orders' }],
  },
  { path: '/receptionists', label: 'Receptionists', icon: UserCogIcon },
  { path: '/sustainability', label: 'Sustainability', icon: LeafIcon },
  { path: '/feedback', label: 'Guest Feedback', icon: StarIcon },
  { path: '/hotel-information', label: 'Hotel Information', icon: HotelIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

// ── Receptionist Navigation ──────────────────────────────────
const receptionistNav: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
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
  { path: '/payments', label: 'Payments', icon: CreditCardIcon },
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
  { path: '/messages', label: 'Messages', icon: MessageSquareIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

function getNavItems(role?: Role): NavItem[] {
  switch (role) {
    case 'ADMIN':
      return adminNav;
    case 'MANAGER':
      return managerNav;
    case 'RECEPTIONIST':
      return receptionistNav;
    default:
      return receptionistNav;
  }
}

export default function Sidebar() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { collapsed } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data: currentUser } = useApi<User>('/api/auth/me');

  const role = currentUser?.role;
  const navItems = getNavItems(role);

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

  const roleLabel = (r?: Role) => {
    switch (r) {
      case 'ADMIN': return 'Administrator';
      case 'MANAGER': return 'Manager';
      case 'RECEPTIONIST': return 'Receptionist';
      default: return '';
    }
  };

return (
    <aside
      className={`fixed top-0 inset-y-0 left-0 z-20 flex flex-col bg-[var(--color-sidebar-bg)] text-white border-r border-[var(--color-sidebar-border)] transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      <div className={`border-b border-[var(--color-sidebar-border)] flex min-h-20 items-center py-4 ${collapsed ? 'px-3' : 'px-6'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
          <img
            src="/lapiroguelogo.jpg"
            alt="La Pirogue Logo"
            className={`shrink-0 object-contain ${collapsed ? 'h-8 w-8 rounded' : 'h-8 w-auto'}`}
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
               <h1 className="font-heading text-2xl tracking-wide text-white">La Pirogue</h1>
              <p className="mt-1 text-xs uppercase tracking-widest text-white/70">{roleLabel(role)}</p>
            </div>
          )}
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
                      className={`flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
            } ${
                        exactActive
                           ? 'bg-[var(--color-nav-active)] text-white font-semibold'
                        : sectionActive
                           ? 'bg-[var(--color-nav-active)]/20 text-white font-medium'
                        : 'text-white/90 hover:bg-[var(--color-nav-active)] hover:text-white'
                        }`}
                    >
                      <item.icon className="h-5 w-5 shrink-0 text-icon-body" strokeWidth={1.5} />
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
                                    className={`flex items-center gap-3 rounded-xl py-2 pl-11 pr-3 text-xs font-medium transition-all duration-200 ${
                                      pathname === child.path
                                        ? 'text-[var(--color-nav-active)] font-semibold'
                                        : 'text-white/80 font-medium hover:text-white'
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

      <div className={`border-t border-[var(--color-sidebar-border)] ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={collapsed ? 'Logout' : undefined}
          className={`flex w-full items-center align-content-center rounded-xl font-semibold text-white/90 ${
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          } hover:bg-[var(--color-danger)] hover:text-white transition-colors`}
        >
          <LogOutIcon className="h-5 w-5 shrink-0 text-icon-body" strokeWidth={1.5} />
          {!collapsed && <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
        </button>
      </div>
    </aside>
  );
}
