import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import NavIcon from './NavIcon';
import { BOTTOM_NAV_ITEMS } from './navConfig';

export default function BottomNav() {
  const { pathname } = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-inset-bottom"
    >
      <ul className="flex items-stretch" role="list">
        {BOTTOM_NAV_ITEMS.map(item => {
          if (item.authRequired && !isAuthenticated) return null;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex flex-col items-center justify-center gap-0.5 py-2 px-1 w-full
                  transition-colors duration-150 outline-none focus-visible:bg-blue-50
                  ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                <span className={`transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                  <NavIcon name={item.icon} className="w-6 h-6" />
                </span>
                <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-blue-600' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
