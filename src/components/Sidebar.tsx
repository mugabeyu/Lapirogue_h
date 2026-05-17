'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  BarChart3Icon,
  UserCogIcon,
  BellIcon,
  MessageSquareIcon,
  SettingsIcon,
  LogOutIcon,
  LucideIcon,
} from 'lucide-react';

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
    path: '/hotel-services',
    label: 'Guest Services',
    icon: UserCogIcon,
    children: [
      { path: '/hotel-services', label: 'Services' },
      { path: '/hotel-services/categories', label: 'Service Categories' },
      { path: '/emergency-contacts', label: 'Emergency Contacts' },
    ],
  },
  { path: '/schedule', label: 'Daily Schedules', icon: CalendarDaysIcon },
  {
    path: '/food-beverage',
    label: 'Food & Beverage',
    icon: UtensilsIcon,
    children: [{ path: '/food-beverage/orders', label: 'Orders' }],
  },
  { path: '/payments', label: 'Payments', icon: CreditCardIcon },
  { path: '/messages', label: 'Messages', icon: MessageSquareIcon },
  { path: '/reports', label: 'Reports', icon: BarChart3Icon },
  {
    path: '/staff',
    label: 'Staff Management',
    icon: UserCogIcon,
    children: [{ path: '/staff/roles', label: 'Roles & Permissions' }],
  },
  { path: '/notifications', label: 'Notifications', icon: BellIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname() ?? '/';

  const isSectionActive = (item: NavItem) => {
    if (pathname === item.path) return true;
    if (item.children?.some((c) => pathname === c.path)) return true;
    if (item.path !== '/' && pathname.startsWith(item.path + '/')) return true;
    return false;
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] bg-primary text-sand-50 flex flex-col z-20">
      <div className="p-6 border-b border-primary-hover">
        <h1 className="font-display text-2xl font-medium tracking-wide">
          La Pirogue
        </h1>
        <p className="text-sand-200/70 text-sm mt-1 uppercase tracking-widest">
          Hotel Operations
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const sectionActive = isSectionActive(item);
            const exactActive = pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    exactActive
                      ? 'bg-primary-hover text-white relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-1 before:bg-accent before:rounded-r-full'
                      : sectionActive
                      ? 'text-white hover:bg-primary-hover/50'
                      : 'text-sand-100/80 hover:bg-primary-hover/50 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" strokeWidth={1.5} />
                  {item.label}
                </Link>

                <AnimatePresence initial={false}>
                  {item.children && sectionActive && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-1 space-y-0.5"
                    >
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            href={child.path}
                            className={`flex items-center gap-3 pl-11 pr-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                              pathname === child.path
                                ? 'text-white'
                                : 'text-sand-100/60 hover:text-white'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                pathname === child.path ? 'bg-accent' : 'bg-sand-100/30'
                              }`}
                            />
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-primary-hover">
        <Link
          href="/login"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sand-100/80 hover:bg-primary-hover/50 hover:text-white transition-colors"
        >
          <LogOutIcon className="w-5 h-5" strokeWidth={1.5} />
          Logout
        </Link>
      </div>
    </aside>
  );
}
