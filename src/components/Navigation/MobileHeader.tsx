import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import NavIcon from './NavIcon';
import NavSearch from './NavSearch';
import { SIDEBAR_NAV_ITEMS, NavItem } from './navConfig';

function DrawerItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const { pathname } = useRouter();
  const { isAuthenticated } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

  if (item.authRequired && !isAuthenticated) return null;

  const baseClass = `flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-colors
    ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`;

  if (item.children?.length) {
    return (
      <li>
        <button
          className={baseClass}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <NavIcon name={item.icon} className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            <NavIcon name="chevronRight" className="w-4 h-4" />
          </span>
        </button>
        {expanded && (
          <ul className="mt-1 ml-4 space-y-0.5 border-l-2 border-gray-100 pl-3">
            {item.children.map((child) => (
              <DrawerItem key={child.href} item={child} onClose={onClose} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={baseClass}
        onClick={onClose}
        aria-current={isActive ? 'page' : undefined}
      >
        <NavIcon name={item.icon} className="w-5 h-5 shrink-0" />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

export default function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    setDrawerOpen(false);
    if (confirm('Are you sure you want to log out?')) await logout();
  };

  return (
    <>
      {/* Top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center gap-2 px-3 h-14">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <NavIcon name="menu" className="w-5 h-5" />
        </button>

        <Link href="/" className="flex items-center gap-2 mr-auto">
          <Image
            src="/PETCHAIN.jpeg"
            alt="PetChain"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="font-bold text-blue-700 text-sm">PetChain</span>
        </Link>

        <button
          onClick={() => setSearchOpen((s) => !s)}
          aria-label="Toggle search"
          aria-expanded={searchOpen}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <NavIcon name="search" className="w-5 h-5" />
        </button>

        <ThemeToggle />
      </header>

      {/* Inline search bar (slides down) */}
      {searchOpen && (
        <div className="lg:hidden sticky top-14 z-30 bg-white border-b border-gray-200 px-3 py-2">
          <NavSearch autoFocus onClose={() => setSearchOpen(false)} />
        </div>
      )}

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`
          lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl
          flex flex-col transition-transform duration-300 ease-in-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2" onClick={() => setDrawerOpen(false)}>
            <Image
              src="/PETCHAIN.jpeg"
              alt="PetChain"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-blue-700">PetChain</span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <NavIcon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        {isAuthenticated && (
          <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
            <p className="text-sm font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Drawer navigation">
          <ul className="space-y-0.5" role="list">
            {SIDEBAR_NAV_ITEMS.map((item) => (
              <DrawerItem
                key={item.href + item.label}
                item={item}
                onClose={() => setDrawerOpen(false)}
              />
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <NavIcon name="logout" className="w-5 h-5" />
              Log out
            </button>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl border border-blue-600 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
