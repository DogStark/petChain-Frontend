export interface NavItem {
  label: string;
  href: string;
  icon: string;
  authRequired?: boolean;
  children?: NavItem[];
}

// Bottom tab items (mobile) — max 5
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Home',         href: '/',             icon: 'home' },
  { label: 'Pets',         href: '/pets',          icon: 'paw',          authRequired: true },
  { label: 'Appointments', href: '/appointments',  icon: 'calendar',     authRequired: true },
  { label: 'Search',       href: '/search',        icon: 'search' },
  { label: 'Profile',      href: '/profile',       icon: 'user',         authRequired: true },
];

// Full sidebar items (desktop)
export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'Home',         href: '/',             icon: 'home' },
  { label: 'Dashboard',    href: '/dashboard',    icon: 'grid',         authRequired: true },
  {
    label: 'My Pets',      href: '/pets',          icon: 'paw',          authRequired: true,
    children: [
      { label: 'All Pets',      href: '/pets',           icon: 'list' },
      { label: 'Lab Results',   href: '/lab-results',    icon: 'flask' },
      { label: 'Surgeries',     href: '/surgeries',      icon: 'scissors' },
      { label: 'Dental',        href: '/dental',         icon: 'tooth' },
    ],
  },
  {
    label: 'Appointments',  href: '/appointments', icon: 'calendar',     authRequired: true,
    children: [
      { label: 'Schedule',      href: '/appointments',   icon: 'calendar' },
      { label: 'Clinics',       href: '/clinics',        icon: 'building' },
    ],
  },
  { label: 'Analytics',    href: '/analytics',    icon: 'chart',        authRequired: true },
  { label: 'Notifications',href: '/notifications',icon: 'bell',         authRequired: true },
  { label: 'Search',       href: '/search',       icon: 'search' },
  {
    label: 'Account',       href: '/profile',      icon: 'user',         authRequired: true,
    children: [
      { label: 'Profile',       href: '/profile',        icon: 'user' },
      { label: 'Settings',      href: '/account-settings', icon: 'settings' },
      { label: 'Preferences',   href: '/preferences',    icon: 'sliders' },
      { label: 'Sessions',      href: '/sessions',       icon: 'shield' },
      { label: 'Activity Log',  href: '/activity-log',   icon: 'clock' },
      { label: 'Transactions',  href: '/transactions',   icon: 'credit-card' },
    ],
  },
];
