import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import NavIcon from './NavIcon';
import NavSearch from './NavSearch';
import { SIDEBAR_NAV_ITEMS, NavItem } from './navConfig';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function SidebarItem({
  item,
  collapsed,
  depth = 0,
}: {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}) {
  const { pathname } = useRouter();
  const { isAuthenticated } = useAuth();
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const hasChildren = item.children && item.children.length > 0;
  const [expanded, setExpanded] = useState(isActive);

  // Auto-expand if a child is active
  useEffect(() => {
    if (hasChildren && item.children?.some((c) => pathname.startsWith(c.href))) {
      setExpanded(true);
    }
  }, [pathname, hasChildren, item.children]);

  if (item.authRequired && !isAuthenticated) return null;

  const itemClass = `
    group flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium
    transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-500
    ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }
    ${depth > 0 ? 'pl-9 text-xs' : ''}
  `;

  if (hasChildren && !collapsed) {
    return (
      <li>
        <button
          className={itemClass}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={`nav-sub-${item.label}`}
        >
          <NavIcon name={item.icon} className="w-5 h-5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{item.label}</span>
              <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
                <NavIcon name="chevronRight" className="w-4 h-4" />
              </span>
            </>
          )}
        </button>

        {expanded && (
          <ul id={`nav-sub-${item.label}`} className="mt-0.5 space-y-0.5">
            {item.children!.map((child) => (
              <SidebarItem key={child.href} item={child} collapsed={collapsed} depth={depth + 1} />
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
        className={itemClass}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        <NavIcon name={item.icon} className="w-5 h-5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </li>
  );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const sidebarRef = useRef<HTMLElement>(null);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) await logout();
  };

  return (
    <aside
      ref={sidebarRef}
      className={`
        hidden lg:flex flex-col h-screen sticky top-0 bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out shrink-0 z-30
        ${collapsed ? 'w-16' : 'w-64'}
      `}
      aria-label="Main navigation"
    >
      {/* Logo + toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-gray-100">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image
              src="/PETCHAIN.jpeg"
              alt="PetChain"
              width={32}
              height={32}
              className="rounded-lg shrink-0"
            />
            <span className="font-bold text-blue-700 truncate">PetChain</span>
          </Link>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors ml-auto"
        >
          <NavIcon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-gray-100">
          <NavSearch />
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Sidebar navigation">
        <ul className="space-y-0.5" role="list">
          {SIDEBAR_NAV_ITEMS.map((item) => (
            <SidebarItem key={item.href + item.label} item={item} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      {/* Footer: user + theme + logout */}
      <div className="border-t border-gray-100 px-2 py-3 space-y-1">
        <div className="flex items-center justify-between px-2">
          <ThemeToggle />
        </div>
        {isAuthenticated && (
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}
          >
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
            >
              <NavIcon name="logout" className="w-5 h-5" />
            </button>
          </div>
        )}
        {!isAuthenticated && !collapsed && (
          <div className="flex gap-2 px-2">
            <Link
              href="/login"
              className="flex-1 text-center text-xs py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="flex-1 text-center text-xs py-2 rounded-lg border border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition-colors"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
