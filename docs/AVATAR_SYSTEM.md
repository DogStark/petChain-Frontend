# Avatar System Documentation

## Overview

The avatar system provides robust image handling for user profiles and pet avatars with intelligent fallback mechanisms, layout stability, and proper accessibility support.

## Components

### 1. Avatar Component

**Location:** `src/components/Avatar.tsx`

The primary component for displaying user and pet avatars with automatic fallback handling.

#### Features

- ✅ **Deterministic fallback**: Shows initials for users or species icons for pets
- ✅ **Layout stability**: No layout shift when images fail to load
- ✅ **Proper alt text**: Follows WCAG guidelines for decorative vs meaningful images
- ✅ **No retry logic**: Immediate fallback for broken images (performance optimization)
- ✅ **Localized error handling**: Errors are contained within the component

#### Usage

```tsx
import { Avatar } from '@/components/Avatar';

// User avatar with initials fallback
<Avatar 
  src={user.avatarUrl} 
  alt="John Doe's profile picture" 
  name="John Doe" 
  size={48} 
/>

// Pet avatar with species fallback
<Avatar 
  src={pet.avatarUrl} 
  alt="" 
  name={pet.name} 
  species="dog" 
  size={64} 
/>

// Decorative avatar in a list (empty alt)
<Avatar 
  src={user.avatarUrl} 
  alt="" 
  name={user.name} 
  size={32} 
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| null` | - | URL of the avatar image |
| `alt` | `string` | - | Alt text (empty for decorative) |
| `name` | `string` | - | Display name for initials fallback |
| `species` | `'dog' \| 'cat' \| 'bird' \| 'rabbit' \| 'other'` | - | Pet species for icon fallback |
| `size` | `number` | `48` | Size in pixels |
| `shape` | `'circle' \| 'rounded' \| 'square'` | `'circle'` | Avatar shape |
| `className` | `string` | `''` | Additional CSS classes |
| `priority` | `boolean` | `false` | Next.js image loading priority |

#### Fallback Logic

1. **Valid image URL** → Display image
2. **Broken/missing image + species** → Show species emoji (🐕 🐈 🐦 🐇 🐾)
3. **Broken/missing image + name** → Show initials (e.g., "JD" for "John Doe")
4. **No image, name, or species** → Show generic user icon

#### Initials Generation

- Single name: First 2 characters (e.g., "Madonna" → "MA")
- Multiple names: First + Last initial (e.g., "John Doe" → "JD")
- Always uppercase
- Deterministic (same input = same output)

### 2. SafeImage Component

**Location:** `src/components/SafeImage.tsx`

A wrapper around Next.js Image component for general images (photos, banners, etc.) with graceful degradation.

#### Features

- ✅ **Hostname validation**: Only allows configured remote image hosts
- ✅ **Graceful degradation**: Falls back to placeholder on error
- ✅ **No layout shift**: Maintains dimensions during fallback
- ✅ **Alt text preservation**: Keeps alt text even when using fallback

#### Usage

```tsx
import SafeImage from '@/components/SafeImage';

<SafeImage
  src={photo.url}
  alt="Pet medical record photo"
  width={400}
  height={300}
  fallbackSrc="/placeholder.svg"
/>
```

#### When to Use

- **Use Avatar**: For user profiles and pet avatars (needs initials/species fallback)
- **Use SafeImage**: For general images like photos, banners, medical records

### 3. AvatarUpload Component

**Location:** `src/components/Profile/AvatarUpload.tsx`

Upload interface for avatar images with drag-and-drop support and preview.

#### Features

- ✅ **Drag and drop**: Upload by dragging files
- ✅ **File validation**: Size (max 5MB) and type (JPEG, PNG, WebP, GIF)
- ✅ **Live preview**: Shows preview with Avatar component
- ✅ **Error handling**: Clear error messages for validation failures

#### Usage

```tsx
import { AvatarUpload } from '@/components/Profile/AvatarUpload';

<AvatarUpload
  currentAvatar={user.avatarUrl}
  userName={`${user.firstName} ${user.lastName}`}
  onUploadSuccess={(url) => handleUpload(url)}
  onUploadError={(error) => setError(error)}
  isLoading={uploading}
/>
```

## Accessibility Guidelines

### Alt Text Rules

Following WCAG 2.1 Level AA guidelines:

#### Meaningful Images (Describe the subject)

```tsx
// ✅ CORRECT: Profile page avatar
<Avatar 
  src={user.avatarUrl}
  alt="John Doe's profile picture"
  name="John Doe"
  size={64}
/>

// ✅ CORRECT: Pet detail page
<Avatar 
  src={pet.avatarUrl}
  alt="Buddy's profile picture"
  name="Buddy"
  species="dog"
  size={80}
/>
```

#### Decorative Images (Empty alt text)

```tsx
// ✅ CORRECT: Avatar in a list item (name is adjacent text)
<div>
  <Avatar 
    src={user.avatarUrl}
    alt=""
    name="John Doe"
    size={32}
  />
  <span>John Doe</span>
</div>

// ✅ CORRECT: Avatar in a menu
<button>
  <Avatar 
    src={user.avatarUrl}
    alt=""
    name="Jane Smith"
    size={24}
  />
  Jane Smith
</button>
```

#### Anti-patterns (Avoid)

```tsx
// ❌ WRONG: Generic alt text
<Avatar alt="avatar" ... />
<Avatar alt="profile picture" ... />

// ❌ WRONG: Redundant alt text
<div>
  <Avatar alt="John Doe" ... />
  <span>John Doe</span> {/* Screen reader reads "John Doe" twice */}
</div>

// ❌ WRONG: Meaningful avatar without alt text
<Avatar 
  src={user.avatarUrl}
  alt="" 
  name="John Doe"
  size={64}
/>
{/* This is the ONLY avatar on the profile page - needs alt text! */}
```

### Testing Alt Text

Run accessibility tests:

```bash
npm test -- Avatar.test.tsx
npm test -- a11y/core.test.tsx
```

## Layout Stability

All avatar components prevent Cumulative Layout Shift (CLS) by:

1. **Fixed dimensions**: Avatar always has explicit width/height
2. **Aspect ratio preservation**: CSS maintains 1:1 ratio
3. **Absolute positioning**: Fallback content positioned to match image
4. **No async loading states**: Fallback shown immediately

### CSS Implementation

```css
.avatar {
  position: relative;
  /* Explicit dimensions prevent collapse */
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
}

/* Maintain aspect ratio */
.avatar::before {
  content: '';
  display: block;
  padding-top: 100%;
}

/* Absolute positioning prevents shift */
.avatar > * {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

## Error Handling Strategy

### No Retry Approach

Unlike some image systems that retry failed loads, this system uses **immediate fallback**:

**Rationale:**
- ✅ Faster user experience (no waiting for retry timeout)
- ✅ Less bandwidth usage (no repeated requests)
- ✅ Better UX (user sees consistent content)
- ✅ No broken image flashing

**Implementation:**

```tsx
// Validation happens before rendering
const shouldShowImage = !imageError && src && isAllowedImageSrc(src) && mounted;

// Single error event → permanent fallback
const handleError = () => {
  setImageError(true);
  onFallback?.();
};
```

### Error State Reset

Image error state resets when `src` prop changes:

```tsx
useEffect(() => {
  setImageError(false);
}, [src]);
```

This allows the same component to display a new image after the previous one failed.

## Testing

### Test Coverage

- ✅ Image loading states (loading, success, error)
- ✅ Fallback generation (initials, species, generic)
- ✅ Layout stability across state changes
- ✅ Alt text semantics (meaningful vs decorative)
- ✅ File upload validation (size, type)
- ✅ Drag and drop functionality
- ✅ Accessibility (axe tests)

### Running Tests

```bash
# All avatar tests
npm test -- Avatar.test.tsx

# SafeImage tests
npm test -- SafeImage.test.tsx

# AvatarUpload tests
npm test -- AvatarUpload.test.tsx

# Accessibility tests
npm test -- a11y/core.test.tsx

# All tests
npm test
```

### Test Files

- `src/__tests__/components/Avatar.test.tsx` - Avatar component tests
- `src/__tests__/components/SafeImage.test.tsx` - SafeImage component tests
- `src/__tests__/components/AvatarUpload.test.tsx` - Upload component tests
- `src/__tests__/a11y/core.test.tsx` - Accessibility compliance tests

## Migration Guide

### Updating Existing Code

#### Before (using direct Image)

```tsx
import Image from 'next/image';

{pet.avatarUrl ? (
  <Image
    src={pet.avatarUrl}
    alt={pet.name}
    width={80}
    height={80}
  />
) : (
  <div className="placeholder">
    <PawPrint size={32} />
  </div>
)}
```

#### After (using Avatar)

```tsx
import { Avatar } from '@/components/Avatar';

<Avatar
  src={pet.avatarUrl}
  alt={`${pet.name}'s profile picture`}
  name={pet.name}
  species={pet.species}
  size={80}
/>
```

### Benefits of Migration

- ✅ Removes conditional rendering logic
- ✅ Automatic fallback handling
- ✅ Consistent styling across app
- ✅ Better accessibility
- ✅ Prevents layout shifts

## Performance Considerations

### Bundle Size

- Avatar component: ~3KB (gzipped)
- SafeImage component: ~1KB (gzipped)
- Total impact: Minimal (< 5KB)

### Runtime Performance

- **No retries**: Reduces network overhead
- **Deterministic fallbacks**: No external dependencies
- **CSS-based sizing**: No JavaScript layout calculations
- **Memoization**: Avatar fallback components are pure

### Next.js Integration

- Uses Next.js `Image` component for optimization
- Respects `priority` prop for above-fold images
- Supports responsive `sizes` attribute
- Maintains Next.js image optimization benefits

## Best Practices

### 1. Always Provide Name or Species

```tsx
// ✅ GOOD: Always provide fallback data
<Avatar src={url} alt="" name={name} size={48} />
<Avatar src={url} alt="" name={petName} species="dog" size={48} />

// ⚠️ AVOID: No fallback data (shows generic icon)
<Avatar src={url} alt="" size={48} />
```

### 2. Use Correct Alt Text

```tsx
// ✅ GOOD: Meaningful avatar
<Avatar src={url} alt="User's profile picture" name={name} />

// ✅ GOOD: Decorative avatar
<Avatar src={url} alt="" name={name} />

// ❌ BAD: Generic alt text
<Avatar src={url} alt="avatar" name={name} />
```

### 3. Choose Appropriate Size

```tsx
// ✅ GOOD: Sized for context
<Avatar size={24} /> // Navbar
<Avatar size={32} /> // List items
<Avatar size={48} /> // Cards, default
<Avatar size={64} /> // Profile headers
<Avatar size={128} /> // Detail pages
```

### 4. Match Shape to Design

```tsx
// User profiles: typically circle
<Avatar shape="circle" />

// Pet photos in grids: often rounded
<Avatar shape="rounded" />

// Thumbnails: sometimes square
<Avatar shape="square" />
```

## Troubleshooting

### Avatar shows fallback even with valid URL

**Check:** Is the remote host allowed?

```tsx
// Add host to: src/lib/images/remoteImageHosts.ts
export const ALLOWED_REMOTE_HOSTS = [
  'yourdomain.com',
  'cdn.yourdomain.com',
];
```

### Avatar flickers on mount

**Solution:** This is normal. The component waits for client mount to check image validity (prevents SSR/hydration issues).

### Initials not showing correctly

**Check:** Is the name being passed correctly?

```tsx
// ✅ CORRECT
<Avatar name="John Doe" />

// ❌ WRONG (undefined)
<Avatar name={user?.firstName} />

// ✅ CORRECT (fallback)
<Avatar name={user?.firstName || 'Unknown'} />
```

### Layout shift still occurring

**Check:** Is the avatar inside a flex/grid container that might be resizing?

```css
/* Ensure parent doesn't cause reflow */
.parent {
  display: flex;
  align-items: center;
  gap: 16px; /* Don't use margin on avatar */
}
```

## Future Enhancements

### Potential Features

- [ ] Blur placeholder (LQIP - Low Quality Image Placeholder)
- [ ] Image loading skeleton animation
- [ ] Custom color schemes for initials backgrounds
- [ ] Animated species icons (Lottie)
- [ ] Automatic color generation from name (consistent hashing)
- [ ] Badge overlay support (verified, premium, etc.)
- [ ] Status indicator (online/offline dot)

### API Improvements

- [ ] `onLoad` callback for analytics
- [ ] `loading="lazy"` support
- [ ] Srcset/responsive images for different densities
- [ ] WebP/AVIF format detection

## Related Documentation

- [Next.js Image Optimization](https://nextjs.org/docs/api-reference/next/image)
- [WCAG 2.1 Alt Text Guidelines](https://www.w3.org/WAI/tutorials/images/)
- [Cumulative Layout Shift (CLS)](https://web.dev/cls/)
- Remote Image Hosts Configuration: `src/lib/images/remoteImageHosts.ts`
- Image Orientation Service: `src/lib/images/imageOrientationService.ts`

## Support

For issues or questions:

1. Check this documentation
2. Review test files for examples
3. Check existing issues in the repository
4. Create a new issue with reproduction steps
