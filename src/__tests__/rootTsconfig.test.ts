import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

describe('root TypeScript package boundaries', () => {
  it('includes only root frontend sources instead of nested packages', () => {
    const tsconfigPath = path.join(repoRoot, 'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8')) as {
      include?: string[];
      exclude?: string[];
    };

    expect(tsconfig.include).toContain('src/**/*.ts');
    expect(tsconfig.include).toContain('src/**/*.tsx');
    expect(tsconfig.include).not.toContain('**/*.ts');
    expect(tsconfig.include).not.toContain('**/*.tsx');

    expect(tsconfig.exclude).toEqual(expect.arrayContaining([
      'backend',
      'frontend',
      'petChain-Frontend',
    ]));
  });

  it('does not let backend behavior specs enter the root TypeScript package', () => {
    const backendSpecs = [
      'backend/src/behavior/behavior.controller.spec.ts',
      'backend/src/behavior/behavior.service.spec.ts',
    ];

    for (const spec of backendSpecs) {
      expect(fs.existsSync(path.join(repoRoot, spec))).toBe(true);
    }
  });
});
