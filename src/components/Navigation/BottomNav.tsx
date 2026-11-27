import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import NavIcon from './NavIcon';
import { BOTTOM_NAV_ITEMS, type NavItem } from './navConfig';

export interface BottomNavItem extends NavItem {
  /** When true, the item renders the unread notification badge. */
  showBadge?: boolean;
}

const BOTTOM_NAV_ITEMS_WITH_BADGE: BottomNavItem[] = BOTTOM_NAV_ITEMS.map((item) => ({
  ...item,
  showBadge: item.href === '/notifications',
}));

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile-only bottom navigation bar. Hidden from `md` breakpoint upwards,
 * where the sidebar takes over. Rendered inside `NotificationProvider` so the
 * unread count can be read from context.
 */
export default function BottomNav() {
  const { pathname } = useRouter();
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();

  const items = BOTTOM_NAV_ITEMS_WITH_BADGE.filter(
    (item) => !item.authRequired || isAuthenticated,
  );

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = isItemActive(pathname, item.href);
          const badge = item.showBadge && unreadCount > 0 ? unreadCount : 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="relative">
                  <NavIcon name={item.icon} className="h-6 w-6" />
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} unread notifications`}
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white"
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
