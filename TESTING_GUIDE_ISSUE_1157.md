# Testing Guide: Reduced Data Mode (Issue #1157)

## 🎯 Quick Start

### Prerequisites
- Dev server running: `npm run dev`
- Browser open to http://localhost:3000
- DevTools console open (optional, for debugging)

---

## 🧪 Manual Testing Checklist

### Test 1: Header Toggle Button

**Steps:**
1. Navigate to http://localhost:3000
2. Look at the header navigation bar
3. Find the Data Mode toggle button (Wifi icon)
4. **Expected**: Button shows "Full" with Wifi icon

**Test Actions:**
5. Click the toggle button
6. **Expected**: Button changes to "Reduced" with WifiOff icon
7. Click toggle again
8. **Expected**: Returns to "Full" mode

**Keyboard Test:**
9. Tab to the toggle button
10. Press Enter or Space
11. **Expected**: Mode toggles, focus visible

✅ **Pass Criteria**: Toggle works, icon changes, keyboard accessible

---

### Test 2: Settings Page

**Steps:**
1. Navigate to http://localhost:3000/preferences
2. Click the "Data Mode" tab
3. **Expected**: See two radio button options

**Test Full Mode:**
4. Select "Full Mode" radio button
5. **Expected**: 
   - Radio button selected
   - Wifi icon displayed
   - Description: "Load all images and charts automatically"

**Test Reduced Mode:**
6. Select "Reduced Data Mode" radio button
7. **Expected**:
   - Radio button selected
   - WifiOff icon displayed
   - Description mentions "emergency and critical care actions"
   - Blue privacy notice visible

**Privacy Notice:**
8. Read the privacy notice
9. **Expected**: States "stored locally" and "never shared with servers"

**Persistence Test:**
10. Select Reduced mode
11. Refresh the page (F5)
12. **Expected**: Reduced mode still selected

✅ **Pass Criteria**: Settings work, persist, privacy notice clear

---

### Test 3: Analytics Page - Chart Deferral

**Setup:**
1. Navigate to http://localhost:3000/preferences
2. Set Data Mode to "Reduced"
3. Navigate to http://localhost:3000/analytics

**Expected Behavior:**
- "Pet Health Overview" chart loads immediately (priority)
- "Vaccination Compliance" chart loads immediately (priority)
- Other charts show placeholders with:
  - Chart title
  - Summary text
  - "View Chart" button
  - "Reduced data mode" label

**Test Chart Loading:**
4. Find "User Engagement" chart placeholder
5. Click "View Chart" button
6. **Expected**: Chart renders immediately
7. Scroll to other deferred charts
8. **Expected**: They remain as placeholders until clicked

**Test Priority Charts:**
9. **Expected**: Health-related charts visible without clicking

**Test Keyboard:**
10. Tab to a "View Chart" button
11. Press Enter
12. **Expected**: Chart loads

**Toggle to Full Mode:**
13. Click header toggle to switch to Full mode
14. **Expected**: All charts render immediately

✅ **Pass Criteria**: Charts defer correctly, priority charts load, toggle works

---

### Test 4: Image Deferral (if clinics available)

**Note**: This tests the DataModeImage component if clinic pages with images exist.

**Setup:**
1. Set Data Mode to "Reduced"
2. Navigate to a clinic page with images (if available)

**Expected Behavior:**
- Large images show placeholders with:
  - Image icon
  - "Load Image" button
  - "Reduced data mode" label
- Priority images (if marked) load immediately
- Thumbnails load immediately

**Test Image Loading:**
3. Click "Load Image" button
4. **Expected**: Image loads and displays
5. Refresh page
6. **Expected**: Image deferred again (per-session state)

✅ **Pass Criteria**: Images defer, load on demand, priority/thumbs load

---

### Test 5: Accessibility - Keyboard Navigation

**Keyboard-Only Test:**
1. Close your mouse (or don't use it)
2. Use Tab to navigate through deferred content
3. **Expected**: All "Load Image" and "View Chart" buttons reachable
4. Press Enter or Space on buttons
5. **Expected**: Content loads

**Focus Indicators:**
6. **Expected**: Clear blue outline on focused buttons
7. **Expected**: No keyboard traps

**Tab Order:**
8. **Expected**: Logical flow (top to bottom, left to right)

✅ **Pass Criteria**: Fully keyboard accessible, visible focus

---

### Test 6: Accessibility - Screen Reader

**Using a Screen Reader (NVDA, JAWS, VoiceOver):**

**Test Placeholders:**
1. Navigate to deferred image/chart
2. **Expected**: Announces "deferred to save bandwidth"
3. **Expected**: Reads full alt text/title

**Test Buttons:**
4. Tab to "Load Image" button
5. **Expected**: Announces "Load image: [alt text]"
6. Tab to "View Chart" button
7. **Expected**: Announces "View [chart title] chart"

**Test Settings:**
8. Navigate to /preferences → Data Mode tab
9. **Expected**: Radio buttons properly labeled
10. **Expected**: Descriptions associated with options

✅ **Pass Criteria**: Content properly announced, buttons labeled

---

### Test 7: Privacy & Security

**localStorage Verification:**
1. Open DevTools → Application → Local Storage
2. Find key: `petchain-data-mode`
3. Toggle mode
4. **Expected**: Value changes between "full" and "reduced"

**Network Tab Test:**
5. Open DevTools → Network tab
6. Clear network log
7. Toggle data mode multiple times
8. **Expected**: NO network requests made
9. **Expected**: Preference stays client-side only

**Cross-Tab Test:**
10. Open same site in two tabs
11. Change mode in Tab 1
12. Refresh Tab 2
13. **Expected**: Tab 2 reflects new mode (localStorage shared)

✅ **Pass Criteria**: Local storage only, no network calls

---

### Test 8: Edge Cases

**Empty/Null Content:**
1. Create a DataModeImage with `src={null}`
2. **Expected**: Shows fallback, "Load Image" still works

**Missing alt Text:**
3. Create DataModeImage without alt
4. **Expected**: Still defers, button says "Load image"

**localStorage Blocked:**
5. In DevTools, block cookies/storage
6. Toggle mode
7. **Expected**: Defaults to full mode, no errors
8. Enable storage
9. **Expected**: Mode selection works again

**JavaScript Disabled:**
10. Disable JavaScript
11. Navigate to pages
12. **Expected**: All content visible (progressive enhancement)

✅ **Pass Criteria**: Graceful handling, no crashes

---

### Test 9: Performance

**Full Mode Baseline:**
1. Set mode to Full
2. Navigate to /analytics
3. Open DevTools → Network tab
4. Note total transfer size

**Reduced Mode Comparison:**
5. Clear browser cache
6. Set mode to Reduced
7. Navigate to /analytics
8. **Expected**: Smaller initial transfer
9. Click one "View Chart" button
10. **Expected**: Only that chart's data loads

**Visual Performance:**
11. Navigate to page with many images
12. In Reduced mode: **Expected** Fast initial render
13. In Full mode: **Expected** Slower initial render (loading images)

✅ **Pass Criteria**: Reduced mode saves bandwidth, faster initial load

---

## 🤖 Automated Testing

### Run All Tests
```bash
npm test -- --testPathPattern="DataMode"
```

### Expected Output
```
Test Suites: 4 passed, 4 total
Tests:       50+ passed, 50+ total
```

### Run Individual Suites
```bash
# Context tests
npm test -- src/contexts/DataModeContext.test.tsx

# Image tests
npm test -- src/components/DataModeImage.test.tsx

# Chart tests
npm test -- src/components/DataModeChart.test.tsx

# Settings tests
npm test -- src/components/Settings/DataModeSettings.test.tsx
```

### Coverage Report
```bash
npm test -- --coverage --testPathPattern="DataMode"
```

**Expected Coverage:**
- Statements: 90%+
- Branches: 85%+
- Functions: 90%+
- Lines: 90%+

---

## 🐛 Known Issues / Limitations

### Current Scope
- ✅ Frontend implementation only
- ✅ Per-session image opt-in (doesn't persist which images loaded)
- ✅ localStorage required (fallback to full mode if blocked)

### Out of Scope (Future)
- Backend-optimized endpoints
- Auto-detection of slow connections
- Bandwidth usage statistics
- Progressive image loading

---

## 📋 Test Results Template

```
Tester: ___________
Date: ___________
Browser: ___________

[ ] Test 1: Header Toggle - PASS/FAIL
[ ] Test 2: Settings Page - PASS/FAIL
[ ] Test 3: Analytics Charts - PASS/FAIL
[ ] Test 4: Image Deferral - PASS/FAIL
[ ] Test 5: Keyboard Navigation - PASS/FAIL
[ ] Test 6: Screen Reader - PASS/FAIL
[ ] Test 7: Privacy & Security - PASS/FAIL
[ ] Test 8: Edge Cases - PASS/FAIL
[ ] Test 9: Performance - PASS/FAIL

Notes:
___________________________________________
___________________________________________
___________________________________________

Overall Result: PASS / FAIL / NEEDS WORK
```

---

## ✅ Final Checklist

Before marking as complete:

- [ ] Dev server starts without errors
- [ ] All automated tests pass
- [ ] Manual tests completed
- [ ] Accessibility verified (keyboard + screen reader)
- [ ] Privacy verified (no network calls)
- [ ] Performance improvement measured
- [ ] Documentation reviewed
- [ ] Code reviewed
- [ ] Screenshots captured
- [ ] Issue #1157 acceptance criteria met

---

## 📸 Screenshot Locations

Capture screenshots for:
1. Settings page - Full mode selected
2. Settings page - Reduced mode selected
3. Analytics page - Full mode (all charts visible)
4. Analytics page - Reduced mode (placeholders visible)
5. Chart placeholder close-up
6. After clicking "View Chart"
7. DevTools showing localStorage
8. DevTools Network tab (no requests on toggle)

---

## 🎓 Demo Script

For presenting the feature:

1. **Introduction** (30 sec)
   - "Reduced data mode helps low-bandwidth users save data"
   - "Emergency actions always available"

2. **Settings Demo** (1 min)
   - Show /preferences page
   - Explain Full vs Reduced modes
   - Point out privacy notice

3. **Analytics Demo** (2 min)
   - Navigate to /analytics in Reduced mode
   - Show placeholders
   - Click "View Chart" to load
   - Toggle to Full mode to show difference
   - Highlight priority charts

4. **Privacy Demo** (1 min)
   - Open DevTools localStorage
   - Toggle mode
   - Show Network tab (no requests)
   - Emphasize local-only storage

5. **Accessibility Demo** (1 min)
   - Navigate with keyboard only
   - Show focus indicators
   - (Optional) Demonstrate with screen reader

**Total: ~5-6 minutes**

---

## 🔗 Related Documents

- `REDUCED_DATA_MODE.md` - Complete feature documentation
- `IMPLEMENTATION_ISSUE_1157.md` - Implementation summary
- Issue #1157 - Original requirements
- Component inline documentation - JSDoc comments

---

**Ready to test!** If you find any issues, please document them with:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
