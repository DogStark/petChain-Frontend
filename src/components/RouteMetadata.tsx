import Head from 'next/head';

type RouteCopy = {
  title: string;
  description: string;
  indexable?: boolean;
};

const ROUTE_COPY: Record<string, RouteCopy> = {
  '/': {
    title: 'PetChain | Pet Care Companion',
    description: 'Organize pet care and connect with trusted veterinary clinics with PetChain.',
    indexable: true,
  },
  '/about': {
    title: 'About PetChain',
    description: 'Learn about PetChain and our approach to connected pet care.',
    indexable: true,
  },
  '/clinics': {
    title: 'Veterinary Clinics | PetChain',
    description: 'Explore veterinary clinics and services with PetChain.',
    indexable: true,
  },
  '/clinics/[id]': {
    title: 'Clinic Profile | PetChain',
    description: 'View a veterinary clinic profile and its services on PetChain.',
    indexable: true,
  },
  '/pets/[id]': {
    title: 'Pet Profile | PetChain',
    description: 'Manage a pet profile in your PetChain account.',
  },
  '/pets/[id]/emergency': {
    title: 'Emergency Access Settings | PetChain',
    description: 'Manage emergency access settings for a pet in PetChain.',
  },
  '/scan/[id]': {
    title: 'Emergency Pet Access | PetChain',
    description: 'PetChain emergency tag access page.',
  },
  '/lab-results': {
    title: 'Account Records | PetChain',
    description: 'Manage saved records in your PetChain account.',
  },
  '/qrcode': {
    title: 'QR Code Tags | PetChain',
    description: 'Manage QR tags in your PetChain account.',
  },
  '/wallet': {
    title: 'Wallet | PetChain',
    description: 'Manage your PetChain wallet.',
  },
  '/admin/reports': {
    title: 'Admin Reports | PetChain',
    description: 'Manage PetChain administration reports.',
  },
  '/admin/sms': {
    title: 'SMS Dashboard | PetChain',
    description: 'Manage PetChain messaging administration.',
  },
  '/admin/security': {
    title: 'Security Dashboard | PetChain',
    description: 'Manage PetChain security settings.',
  },
  '/review': {
    title: 'Rate PetChain | PetChain',
    description: 'Share feedback about your experience with PetChain.',
  },
  '/sessions': {
    title: 'Active Sessions | PetChain',
    description: 'Review active sessions for your PetChain account.',
  },
  '/offline': {
    title: 'Offline | PetChain',
    description: 'PetChain is currently unavailable offline.',
  },
  '/activity-log': {
    title: 'Activity Log | PetChain',
    description: 'Review activity for your PetChain account.',
  },
  '/dental': {
    title: 'Dental Care | PetChain',
    description: 'Manage dental care entries in your PetChain account.',
  },
  '/notifications': {
    title: 'Notifications | PetChain',
    description: 'Manage notifications for your PetChain account.',
  },
  '/rate': {
    title: 'Exchange Rates | PetChain',
    description: 'View exchange rates in PetChain.',
  },
  '/appointments': {
    title: 'Appointments | PetChain',
    description: 'Manage appointments in your PetChain account.',
  },
  '/analytics': {
    title: 'Analytics | PetChain',
    description: 'Review account analytics in PetChain.',
  },
  '/account-settings': {
    title: 'Account Settings | PetChain',
    description: 'Manage your PetChain account settings.',
  },
  '/dashboard': {
    title: 'Dashboard | PetChain',
    description: 'View your PetChain account dashboard.',
  },
  '/forgot-password': {
    title: 'Reset Password | PetChain',
    description: 'Reset the password for your PetChain account.',
  },
  '/login': {
    title: 'Sign In | PetChain',
    description: 'Sign in to your PetChain account.',
  },
  '/onboarding': {
    title: 'Get Started | PetChain',
    description: 'Set up your PetChain account.',
  },
  '/preferences': {
    title: 'Preferences | PetChain',
    description: 'Manage your PetChain preferences.',
  },
  '/profile': {
    title: 'Profile | PetChain',
    description: 'Manage your PetChain profile.',
  },
  '/register': {
    title: 'Create Account | PetChain',
    description: 'Create a PetChain account.',
  },
  '/search': {
    title: 'Search | PetChain',
    description: 'Search PetChain.',
  },
  '/surgeries': {
    title: 'Care Records | PetChain',
    description: 'Manage care entries in your PetChain account.',
  },
  '/transactions': {
    title: 'Transactions | PetChain',
    description: 'Review transactions in your PetChain account.',
  },
  '/two-factor': {
    title: 'Two-Factor Authentication | PetChain',
    description: 'Manage two-factor authentication for your PetChain account.',
  },
  '/verify-account': {
    title: 'Verify Account | PetChain',
    description: 'Verify your PetChain account.',
  },
  '/verify-email': {
    title: 'Verify Email | PetChain',
    description: 'Verify the email address for your PetChain account.',
  },
  '/reset-password': {
    title: 'Reset Password | PetChain',
    description: 'Choose a new password for your PetChain account.',
  },
  '/performance': {
    title: 'Performance | PetChain',
    description: 'Review PetChain performance metrics.',
  },
};

export type RouteMetadataValues = {
  title: string;
  description: string;
  canonical: string;
  robots: 'index, follow' | 'noindex, nofollow';
};

function resolveSiteOrigin(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  const candidate =
    configuredUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.origin;
    }
  } catch {
    // Use the local fallback when the configured public URL is invalid.
  }

  return 'http://localhost:3000';
}

export function getRouteMetadata(
  pathname: string,
  asPath: string,
  siteOrigin = resolveSiteOrigin()
): RouteMetadataValues {
  const route = ROUTE_COPY[pathname] ?? {
    title: 'PetChain',
    description: 'Manage your PetChain account.',
  };
  const origin = (() => {
    try {
      const url = new URL(siteOrigin);
      return url.protocol === 'http:' || url.protocol === 'https:'
        ? url.origin
        : 'http://localhost:3000';
    } catch {
      return 'http://localhost:3000';
    }
  })();
  const requestedPath = asPath.split(/[?#]/, 1)[0];
  const canonicalPath =
    requestedPath.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : pathname;
  let canonicalUrl = new URL(canonicalPath, origin);
  if (canonicalUrl.origin !== origin) {
    canonicalUrl = new URL(pathname, origin);
  }

  return {
    title: route.title,
    description: route.description,
    canonical: canonicalUrl.toString(),
    robots: route.indexable ? 'index, follow' : 'noindex, nofollow',
  };
}

type RouteMetadataProps = {
  pathname: string;
  asPath: string;
};

export default function RouteMetadata({ pathname, asPath }: RouteMetadataProps) {
  const metadata = getRouteMetadata(pathname, asPath);

  return (
    <Head>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <link rel="canonical" href={metadata.canonical} />
      <meta name="robots" content={metadata.robots} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="PetChain" />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      <meta property="og:url" content={metadata.canonical} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={metadata.title} />
      <meta name="twitter:description" content={metadata.description} />
    </Head>
  );
}
