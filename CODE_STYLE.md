# Code Style Guide

This document outlines the coding standards and best practices for the PetChain project.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript](#typescript)
- [React/Next.js](#reactnextjs)
- [Styling](#styling)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Git Commit Messages](#git-commit-messages)

## General Principles

1. **Write clean, readable code** - Code is read more often than it's written
2. **Follow DRY** - Don't Repeat Yourself
3. **Keep it simple** - Avoid over-engineering
4. **Write self-documenting code** - Use clear variable and function names
5. **Comment when necessary** - Explain "why", not "what"

## TypeScript

### Type Safety

```typescript
// ✅ Good - Explicit types
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): User {
  // implementation
}

// ❌ Bad - Using 'any'
function getUser(id: any): any {
  // implementation
}
```

### Interfaces vs Types

- Use `interface` for object shapes that might be extended
- Use `type` for unions, intersections, and primitives

```typescript
// ✅ Good
interface Pet {
  id: string;
  name: string;
}

type PetStatus = 'active' | 'inactive' | 'pending';
```

### Avoid Non-null Assertions

```typescript
// ✅ Good
const user = getUser();
if (user) {
  console.log(user.name);
}

// ❌ Bad
const user = getUser();
console.log(user!.name);
```

## React/Next.js

### Component Structure

```typescript
// ✅ Good - Functional component with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn">
      {label}
    </button>
  );
}
```

### Hooks

- Use hooks at the top level of components
- Custom hooks should start with "use"
- Keep hooks simple and focused

```typescript
// ✅ Good
function usePetData(petId: string) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPet(petId).then(setPet).finally(() => setLoading(false));
  }, [petId]);

  return { pet, loading };
}
```

### Props Destructuring

```typescript
// ✅ Good
function PetCard({ name, breed, age }: PetCardProps) {
  return <div>{name}</div>;
}

// ❌ Bad
function PetCard(props: PetCardProps) {
  return <div>{props.name}</div>;
}
```

### Conditional Rendering

```typescript
// ✅ Good - Clear and readable
{isLoading ? <Spinner /> : <Content />}

// ✅ Good - For simple conditions
{isVisible && <Component />}

// ❌ Bad - Nested ternaries
{isLoading ? <Spinner /> : isError ? <Error /> : <Content />}
```

## Styling

### Tailwind CSS

- Use Tailwind utility classes
- Group related classes together
- Use responsive prefixes consistently

```typescript
// ✅ Good
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition">
  <h2 className="text-xl font-bold text-gray-900">Title</h2>
</div>

// ❌ Bad - Inconsistent spacing and grouping
<div className="flex p-4 items-center bg-white justify-between rounded-lg shadow-md hover:shadow-lg transition">
  <h2 className="font-bold text-xl text-gray-900">Title</h2>
</div>
```

### Class Order

1. Layout (flex, grid, display)
2. Positioning (relative, absolute)
3. Spacing (margin, padding)
4. Sizing (width, height)
5. Typography (font, text)
6. Visual (background, border, shadow)
7. Interactions (hover, focus, transition)

## File Organization

### Directory Structure

```
src/
├── components/
│   ├── common/          # Reusable components
│   ├── features/        # Feature-specific components
│   └── layout/          # Layout components
├── pages/               # Next.js pages
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── types/               # TypeScript types/interfaces
├── constants/           # Constants and enums
└── styles/              # Global styles
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `PetCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `PascalCase.ts` or `camelCase.types.ts`
- Tests: `*.test.ts` or `*.spec.ts`

## Naming Conventions

### Variables and Functions

```typescript
// ✅ Good - Descriptive names
const petMedicalRecords = fetchRecords();
const isUserAuthenticated = checkAuth();

function calculateVaccinationDate(lastVaccination: Date): Date {
  // implementation
}

// ❌ Bad - Unclear names
const data = fetchRecords();
const flag = checkAuth();

function calc(d: Date): Date {
  // implementation
}
```

### Constants

```typescript
// ✅ Good
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
```

### Boolean Variables

- Prefix with `is`, `has`, `should`, `can`

```typescript
// ✅ Good
const isLoading = true;
const hasPermission = false;
const shouldRender = true;
const canEdit = false;
```

## Git Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# ✅ Good
feat(pet-records): add medical history timeline component

Implemented a timeline component to display pet medical records
in chronological order with filtering capabilities.

Closes #123

# ✅ Good
fix(auth): resolve token expiration issue

# ❌ Bad
update stuff
```

## Best Practices

### Error Handling

```typescript
// ✅ Good
try {
  const data = await fetchPetData(petId);
  return data;
} catch (error) {
  console.error('Failed to fetch pet data:', error);
  throw new Error('Unable to load pet information');
}

// ❌ Bad
try {
  const data = await fetchPetData(petId);
  return data;
} catch (error) {
  // Silent failure
}
```

### Async/Await

```typescript
// ✅ Good
async function loadPetData(petId: string): Promise<Pet> {
  const pet = await fetchPet(petId);
  const records = await fetchRecords(petId);
  return { ...pet, records };
}

// ❌ Bad - Callback hell
function loadPetData(petId: string, callback: Function) {
  fetchPet(petId, (pet) => {
    fetchRecords(petId, (records) => {
      callback({ ...pet, records });
    });
  });
}
```

### Imports

```typescript
// ✅ Good - Organized imports
import { useState, useEffect } from 'react';
import Image from 'next/image';

import { fetchPetData } from '@/utils/api';
import { Pet } from '@/types/pet';
import Button from '@/components/common/Button';

// ❌ Bad - Unorganized
import Button from '@/components/common/Button';
import { useState, useEffect } from 'react';
import { Pet } from '@/types/pet';
import { fetchPetData } from '@/utils/api';
import Image from 'next/image';
```

### Import Order

1. React and Next.js imports
2. Third-party libraries
3. Internal utilities and types
4. Components
5. Styles

## Code Review Checklist

Before submitting a PR, ensure:

- [ ] Code follows the style guide
- [ ] All tests pass
- [ ] TypeScript has no errors
- [ ] ESLint has no warnings
- [ ] Code is properly formatted (Prettier)
- [ ] No console.logs in production code
- [ ] Proper error handling
- [ ] Meaningful variable names
- [ ] Comments for complex logic
- [ ] No hardcoded values (use constants)

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Remember**: Consistency is key. When in doubt, follow the existing patterns in the codebase.
