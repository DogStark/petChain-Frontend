import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageManifest = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

function packageMajor(versionRange: string): number {
  const match = versionRange.match(/(?:^|[^\d])(\d+)\./);
  if (!match) {
    throw new Error(`Unsupported package version range: ${versionRange}`);
  }
  return Number(match[1]);
}

describe('Next.js toolchain compatibility', () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as PackageManifest;
  const nextMajor = packageMajor(manifest.dependencies.next);

  it('uses eslint-config-next from the same Next.js major', () => {
    expect(packageMajor(manifest.devDependencies['eslint-config-next'])).toBe(
      nextMajor,
    );
  });

  it('uses @next/bundle-analyzer from the same Next.js major', () => {
    expect(packageMajor(manifest.devDependencies['@next/bundle-analyzer'])).toBe(
      nextMajor,
    );
  });
});