import { isAllowedImageHost, isAllowedImageSrc, REMOTE_IMAGE_HOSTS } from './remoteImageHosts';

describe('remoteImageHosts', () => {
  it('declares at least one remote pattern for every real photo host', () => {
    expect(REMOTE_IMAGE_HOSTS.length).toBeGreaterThan(0);
  });

  it('allows known S3 bucket hosts', () => {
    expect(isAllowedImageHost('petchain-uploads.s3.amazonaws.com')).toBe(true);
    expect(isAllowedImageHost('petchain-uploads.s3.us-east-1.amazonaws.com')).toBe(true);
  });

  it('allows Google Cloud Storage', () => {
    expect(isAllowedImageHost('storage.googleapis.com')).toBe(true);
  });

  it('allows known IPFS gateways', () => {
    expect(isAllowedImageHost('ipfs.io')).toBe(true);
    expect(isAllowedImageHost('gateway.pinata.cloud')).toBe(true);
    expect(isAllowedImageHost('petchain.infura-ipfs.io')).toBe(true);
  });

  it('rejects an unlisted/unexpected host', () => {
    expect(isAllowedImageHost('evil.example.com')).toBe(false);
  });

  it('treats relative/same-origin src values as allowed', () => {
    expect(isAllowedImageSrc('/uploads/photo.jpg')).toBe(true);
  });

  it('rejects an absolute src on an unlisted host', () => {
    expect(isAllowedImageSrc('https://evil.example.com/photo.jpg')).toBe(false);
  });

  it('allows an absolute src on an allow-listed host', () => {
    expect(isAllowedImageSrc('https://storage.googleapis.com/bucket/photo.jpg')).toBe(true);
  });
});
