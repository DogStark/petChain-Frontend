# Reduced Data Mode Feature

## Overview

The Reduced Data Mode feature allows low-bandwidth users to defer loading of large images and non-essential chart detail while keeping emergency and critical care actions immediately available.

## Issue Reference

- **Issue #1157**: [Frontend] Add reduced-data mode for low-bandwidth users
- **Repository**: DogStark/petChain-Frontend

## Implementation Details

### Components

#### 1. **DataModeContext** (`src/contexts/DataModeContext.tsx`)
- Provides global data mode state management
- Supports two modes: `full` (default) and `reduced`
- Stores preference in localStorage (client-side only)
- Privacy by default: preference never sent to backend

#### 2. **DataModeImage** (`src/components/DataModeImage.tsx`)
- Image component that respects data mode
- In reduced mode:
  - Shows placeholder with "Load Image" button
  - Priority images (emergency/critical) always load
  - Thumbnails always load (assumed small)
  - User can opt-in to load specific images
- Fully keyboard accessible

#### 3. **DataModeChart** (`src/components/DataModeChart.tsx`)
- Chart wrapper that respects data mode
- In reduced mode:
  - Shows summary with "View Chart" button
  - Priority charts (emergency indicators) always render
  - User can opt-in to view specific charts
- Supports simplified text summaries

#### 4. **DataModeSettings** (`src/components/Settings/DataModeSettings.tsx`)
- User-facing settings component
- Clear radio button interface
- Available in `/preferences` page under "Data Mode" tab
- Emphasizes privacy and emergency action availability

### Integration Points

#### Updated Files:

1. **`src/pages/_app.tsx`**
   - Added `DataModeProvider` to app context hierarchy
   - Wraps all pages with data mode functionality

2. **`src/pages/analytics.tsx`**
   - Wrapped all charts with `DataModeChart` component
   - Marked health-related charts as priority
   - Added summary text for better UX in reduced mode

3. **`src/pages/preferences.tsx`**
   - Added "Data Mode" tab
   - Integrated `DataModeSettings` component

### Usage Examples

#### Using DataModeImage

```tsx
import DataModeImage from '@/components/DataModeImage';

// Regular image - deferred in reduced mode
<DataModeImage 
  src="/large-photo.jpg" 
  alt="Pet photo" 
  width={800} 
  height={600} 
/>

// Priority image - always loads (emergency)
<DataModeImage 
  src="/emergency-contact.jpg" 
  alt="Emergency contact" 
  width={200} 
  height={200} 
  priority={true}
/>

// Thumbnail - always loads (small size)
<DataModeImage 
  src="/thumb.jpg" 
  alt="Thumbnail" 
  width={100} 
  height={100} 
  sizeCategory="thumbnail"
/>
```

#### Using DataModeChart

```tsx
import DataModeChart from '@/components/DataModeChart';
import { VaccinationChart } from './charts';

// Priority chart - always renders (critical health data)
<DataModeChart
  title="Vaccination Status"
  priority={true}
>
  <VaccinationChart data={data} />
</DataModeChart>

// Regular chart - deferred in reduced mode
<DataModeChart
  title="User Engagement"
  summary="View daily active user statistics"
>
  <UserEngagementChart data={data} />
</DataModeChart>
```

#### Using the Context Directly

```tsx
import { useDataMode } from '@/hooks/useDataMode';

function MyComponent() {
  const { mode, isReducedMode, setMode, toggleMode } = useDataMode();
  
  // Check if in reduced mode
  if (isReducedMode) {
    // Show simplified view
  }
  
  // Toggle mode
  <button onClick={toggleMode}>
    Toggle Data Mode
  </button>
}
```

## Accessibility Features

### Keyboard Navigation
- All "Load Image" and "View Chart" buttons are keyboard accessible
- Supports Enter and Space key activation
- Proper focus indicators

### Screen Reader Support
- Descriptive ARIA labels for deferred content
- Announces state changes
- Proper semantic HTML structure
- Heading hierarchy maintained

### Visual Indicators
- Clear visual feedback for interactive elements
- High contrast placeholders
- Loading state indicators
- Hover states for better discoverability

## Privacy & Security

### Privacy by Default
- All preferences stored in `localStorage` only
- Never transmitted to backend servers
- No tracking or analytics on preference changes
- Clear privacy notice in settings UI

### Authorization
- Backend maintains full control over data authorization
- Frontend only controls rendering/deferral
- Emergency and critical data always accessible
- No security-sensitive decisions made client-side

## Testing

### Test Files
1. `src/contexts/DataModeContext.test.tsx` - Context behavior (12 tests) ✓
2. `src/components/DataModeImage.test.tsx` - Image deferral logic
3. `src/components/DataModeChart.test.tsx` - Chart deferral logic
4. `src/components/Settings/DataModeSettings.test.tsx` - Settings UI

### Test Coverage
- Full mode behavior
- Reduced mode behavior  
- Priority content handling
- User opt-in flow
- Keyboard navigation
- Screen reader compatibility
- Accessibility compliance (axe)
- Edge cases and error handling
- Privacy compliance

### Running Tests

```bash
# Run all data mode tests
npm test -- --testPathPattern="DataMode"

# Run specific test file
npm test -- src/contexts/DataModeContext.test.tsx

# Run with coverage
npm test -- --coverage --testPathPattern="DataMode"
```

## Browser Compatibility

- **Modern browsers**: Full support (Chrome, Firefox, Safari, Edge)
- **localStorage**: Required (feature gracefully degrades if unavailable)
- **Fallback**: Defaults to full mode if localStorage blocked

## Performance Benefits

### In Reduced Mode:
- **Images**: Deferred until user request (saves bandwidth)
- **Charts**: Deferred rendering (saves CPU/GPU)
- **Initial load**: Faster page load times
- **Network**: Reduced data transfer

### Emergency Actions:
- Always immediately available
- No degradation in critical functionality
- Priority content bypasses deferral

## User Experience

### Opt-In Model
- Users explicitly choose to load deferred content
- Per-item granularity (load specific images/charts)
- Choice persists during session
- Easy mode switching in settings

### Clear Communication
- Visual indicators for deferred content
- "Reduced data mode" labels
- Explanatory text in settings
- Emphasis on emergency action availability

## Future Enhancements

### Potential Improvements:
1. **Auto-detection**: Detect slow connections and suggest reduced mode
2. **Data usage tracker**: Show bandwidth saved
3. **Granular controls**: Separate settings for images vs. charts
4. **Progressive loading**: Load lower quality first, enhance on demand
5. **Network quality indicator**: Show current connection speed

### Backend Integration Ideas:
1. **Optimized endpoints**: Backend serves lighter payloads for reduced mode
2. **Image resizing**: Serve smaller images when reduced mode detected
3. **API rate limiting**: Adjust limits based on data mode
4. **Analytics**: Track adoption and bandwidth savings (with consent)

## Acceptance Criteria Status

- ✅ **Implemented in appropriate layers**: Context, hooks, components
- ✅ **Authorization owned by backend**: Frontend only controls rendering
- ✅ **Focused tests**: Context, images, charts, settings tested
- ✅ **Empty/denied states**: Placeholder UIs with clear messaging
- ✅ **Boundary cases**: Null/undefined/empty content handled
- ✅ **Failure cases**: localStorage errors handled gracefully
- ✅ **Privacy by default**: Local storage only, clear notice
- ✅ **Keyboard navigation**: Full keyboard support
- ✅ **Screen reader support**: ARIA labels and semantic HTML
- ✅ **Emergency actions**: Priority content always available

## Questions & Support

For questions or issues with this feature, please refer to:
- Issue #1157 in the GitHub repository
- This documentation file
- Component inline documentation (JSDoc comments)

## Screenshots & Demo

To see the feature in action:

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3000/preferences
3. Click the "Data Mode" tab
4. Toggle between Full and Reduced modes
5. Visit http://localhost:3000/analytics to see deferred charts
6. Test image deferral on pet profile pages

### Key Pages:
- **Settings**: `/preferences` → "Data Mode" tab
- **Analytics**: `/analytics` (charts deferred in reduced mode)
- **Clinics**: `/clinics/[id]` (clinic images deferred)
- **Pets**: `/pets/[id]` (pet photos deferred)
