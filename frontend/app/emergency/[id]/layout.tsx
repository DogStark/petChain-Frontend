import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function EmergencyProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
