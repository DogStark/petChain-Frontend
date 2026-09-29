import { getRouteMetadata } from './RouteMetadata';

describe('getRouteMetadata', () => {
  it('indexes public pages and uses an absolute canonical without query parameters', () => {
    const metadata = getRouteMetadata(
      '/clinics/[id]',
      '/clinics/clinic-123?campaign=spring#details',
      'https://pets.example.org/app/'
    );

    expect(metadata).toEqual({
      title: 'Clinic Profile | PetChain',
      description: 'View a veterinary clinic profile and its services on PetChain.',
      canonical: 'https://pets.example.org/clinics/clinic-123',
      robots: 'index, follow',
    });
  });

  it('marks protected routes noindex and keeps their social copy generic', () => {
    const metadata = getRouteMetadata(
      '/lab-results',
      '/lab-results?petName=Sensitive&result=Private',
      'https://pets.example.org'
    );
    const socialCopy = `${metadata.title} ${metadata.description}`;

    expect(metadata.robots).toBe('noindex, nofollow');
    expect(metadata.canonical).toBe('https://pets.example.org/lab-results');
    expect(socialCopy).not.toMatch(/Sensitive|Private|petName|lab|result/i);
  });

  it('keeps emergency metadata generic and prevents indexing', () => {
    const metadata = getRouteMetadata(
      '/pets/[id]/emergency',
      '/pets/pet-456/emergency?name=Sensitive&condition=Private',
      'https://pets.example.org'
    );
    const socialCopy = `${metadata.title} ${metadata.description}`;

    expect(metadata.robots).toBe('noindex, nofollow');
    expect(metadata.canonical).toBe('https://pets.example.org/pets/pet-456/emergency');
    expect(socialCopy).not.toMatch(/Sensitive|Private|condition/i);
  });

  it('keeps public emergency scan pages noindex with safe social copy', () => {
    const metadata = getRouteMetadata('/scan/[id]', '/scan/pet-789', 'https://pets.example.org');

    expect(metadata.robots).toBe('noindex, nofollow');
    expect(metadata.title).toBe('Emergency Pet Access | PetChain');
    expect(metadata.description).toBe('PetChain emergency tag access page.');
  });

  it('rejects invalid origins and paths that could replace the canonical host', () => {
    const metadata = getRouteMetadata('/about', '//attacker.example/path', 'not-a-url');
    const escapedPathMetadata = getRouteMetadata(
      '/about',
      '/\\attacker.example/path',
      'https://pets.example.org'
    );

    expect(metadata.canonical).toBe('http://localhost:3000/about');
    expect(escapedPathMetadata.canonical).toBe('https://pets.example.org/about');
  });
});
