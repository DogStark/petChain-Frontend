export interface RemoteImageHost {
  protocol: 'http' | 'https';
  hostname: string;
}

function cdnHostFromEnv(): RemoteImageHost | null {
  const endpoint = process.env.CDN_ENDPOINT || process.env.NEXT_PUBLIC_CDN_ENDPOINT;
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { protocol: url.protocol.replace(':', '') as 'http' | 'https', hostname: url.hostname };
  } catch {
    return null;
  }
}

/**
 * Real-world origins the backend serves user-uploaded pet/clinic/staff photos
 * from: AWS S3, Google Cloud Storage, IPFS gateways, and the configured CDN.
 * Used both by next.config.ts (images.remotePatterns) and SafeImage, so the
 * two stay in sync and a new host only needs to be added in one place.
 */
export const REMOTE_IMAGE_HOSTS: RemoteImageHost[] = [
  { protocol: 'https', hostname: '*.s3.amazonaws.com' },
  { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
  { protocol: 'https', hostname: 'storage.googleapis.com' },
  { protocol: 'https', hostname: 'ipfs.io' },
  { protocol: 'https', hostname: '*.infura-ipfs.io' },
  { protocol: 'https', hostname: 'gateway.pinata.cloud' },
  ...(() => {
    const cdnHost = cdnHostFromEnv();
    return cdnHost ? [cdnHost] : [];
  })(),
];

function hostPatternToRegExp(hostname: string): RegExp {
  const escaped = hostname
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^.]*')
    )
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function isAllowedImageHost(hostname: string): boolean {
  return REMOTE_IMAGE_HOSTS.some((host) => hostPatternToRegExp(host.hostname).test(hostname));
}

export function isAllowedImageSrc(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isAllowedImageHost(url.hostname);
  } catch {
    // Relative/same-origin paths (e.g. "/photo.jpg") don't need an allow-listed host.
    return true;
  }
}
