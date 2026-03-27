import Link from 'next/link';
import { useRouter } from 'next/router';

// Map path segments to human-readable labels
const SEGMENT_LABELS: Record<string, string> = {
  pets: 'My Pets',
  appointments: 'Appointments',
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  notifications: 'Notifications',
  profile: 'Profile',
  search: 'Search',
  clinics: 'Clinics',
  'lab-results': 'Lab Results',
  surgeries: 'Surgeries',
  dental: 'Dental',
  sessions: 'Sessions',
  'activity-log': 'Activity Log',
  transactions: 'Transactions',
  'account-settings': 'Account Settings',
  preferences: 'Preferences',
  admin: 'Admin',
  reports: 'Reports',
};

function labelFor(segment: string) {
  // Dynamic segments like [id] — show as "Details"
  if (segment.startsWith('[')) return 'Details';
  return SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Breadcrumbs() {
  const { pathname } = useRouter();

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: labelFor(seg),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-gray-500 px-4 py-2 overflow-x-auto no-scrollbar"
    >
      <Link href="/" className="hover:text-blue-600 transition-colors shrink-0">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1 shrink-0">
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {i === crumbs.length - 1 ? (
            <span className="text-gray-900 font-medium" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="hover:text-blue-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
