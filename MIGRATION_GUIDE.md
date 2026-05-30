# Module Integration Guide

This guide shows you how to integrate the new modular structure into your codebase.

## Step 1: Update HTML to Use Modules

Change any HTML files that reference `script.js`:

**Before:**
```html
<script src="/static/js/script.js"></script>
```

**After:**
```html
<script type="module" src="/static/js/script.js"></script>
```

This enables ES6 module support.

---

## Step 2: Import Modules in script.js

Add these imports at the **top** of `static/js/script.js`:

```javascript
// Import modular functions
import { renderYearInsightCard, getISOWeek, diffDays } from './modules/insights.js';
import { 
    renderContributionGraph, 
    setupContributionYearFilter, 
    getContributionYears, 
    populateContributionYearFilter,
    formatLoggedHours 
} from './modules/contributions.js';
import { 
    setupAuthInterface, 
    resolveAuthState, 
    injectAuthStyles,
    setAuthenticatedUser,
    showAuthGate,
    hideAuthGate,
    updateAuthHeader,
    setupAuthControls,
    signOutUser,
    authState
} from './modules/auth.js';
import { 
    setupThemeToggle,
    applyTheme,
    THEME_KEY
} from './modules/theme.js';

// Keep existing constants but can be moved to constants module later
const STORE_KEY_BASE = "study-tracker-v1";
// ... other constants
```

---

## Step 3: Replace Function Calls

Search and replace in `script.js`:

### Example 1: renderYearInsightCard

**Before:**
```javascript
// Was defined in script.js
function renderYearInsightCard() {
    const statsEl = document.getElementById("yearInsightStats");
    // ... 100+ lines of logic
}

// Called in initialize()
renderYearInsightCard();
```

**After:**
```javascript
// Function is now imported
// Called in initialize()
renderYearInsightCard(state);  // Pass state as parameter
```

### Example 2: Contribution Graph

**Before:**
```javascript
// Multiple functions mixed in script.js
function renderContributionGraph() { /* ... */ }
function getContributionYears() { /* ... */ }
function populateContributionYearFilter() { /* ... */ }

// In initialize()
setupContributionYearFilter();
// Later in render()
renderContributionGraph();
```

**After:**
```javascript
// Import all at top
import { 
    renderContributionGraph, 
    setupContributionYearFilter 
} from './modules/contributions.js';

// In initialize()
setupContributionYearFilter(() => renderContributionGraph());

// In render()
renderContributionGraph(state, () => state.subjects, isSingletonTask);
```

### Example 3: Auth Setup

**Before:**
```javascript
// Multiple auth functions in script.js
function setupAuthInterface() { /* ... */ }
function resolveAuthState() { /* ... */ }
async function signOutUser() { /* ... */ }

// In initialize()
setupAuthInterface();
injectAuthStyles();
await resolveAuthState();
```

**After:**
```javascript
// Import auth functions
import { 
    setupAuthInterface, 
    resolveAuthState,
    injectAuthStyles
} from './modules/auth.js';

// In initialize()
injectAuthStyles();
setupAuthInterface();
await resolveAuthState();
```

---

## Step 4: Complete Migration Checklist

Track your migration with this checklist:

### Insights Module
- [ ] Remove `renderYearInsightCard()` from script.js
- [ ] Remove `getISOWeek()` from script.js
- [ ] Remove `diffDays()` from script.js
- [ ] Test year insight card renders correctly
- [ ] Verify streak calculations work

### Contributions Module
- [ ] Remove `renderContributionGraph()` from script.js
- [ ] Remove `getContributionYears()` from script.js
- [ ] Remove `populateContributionYearFilter()` from script.js
- [ ] Remove `setupContributionYearFilter()` from script.js
- [ ] Remove helper functions (createContributionCell, formatLoggedHours, etc.)
- [ ] Test contribution calendar renders
- [ ] Test year filter dropdown works
- [ ] Verify colors and layout are correct

### Auth Module
- [ ] Remove all auth functions from script.js
- [ ] Remove `authState` object from script.js
- [ ] Remove auth UI element variables
- [ ] Import `authState` from module instead
- [ ] Test login works
- [ ] Test registration works
- [ ] Test logout works
- [ ] Test guest mode works
- [ ] Verify auth header updates

### Theme Module
- [ ] Remove `setupThemeToggle()` from script.js
- [ ] Remove `applyTheme()` from script.js
- [ ] Remove `THEME_KEY` from script.js
- [ ] Test theme toggle works
- [ ] Verify theme persists across page refreshes

---

## Step 5: Testing After Migration

After migrating each module:

1. **Test in browser:**
   ```
   Open DevTools (F12)
   Check Console for errors
   ```

2. **Specific tests:**
   - Year Insight: Check `/reports` page
   - Contribution Graph: Check `/reports` page for calendar
   - Auth: Try login, logout, guest mode
   - Theme: Toggle theme button multiple times

3. **Check console for:**
   - No 404 errors for module imports
   - No "function not defined" errors
   - No CORS issues

---

## Module Function Signatures

When calling imported functions, use these signatures:

### insights.js
```javascript
renderYearInsightCard(state)
getISOWeek(date) → number
diffDays(dateKey1, dateKey2) → number
```

### contributions.js
```javascript
renderContributionGraph(state, getSubjects, isSingletonTask) → void
setupContributionYearFilter(renderCallback) → void
getContributionYears(state) → string[]
populateContributionYearFilter() → string
formatLoggedHours(totalMinutes) → string
```

### auth.js
```javascript
setupAuthInterface() → void
resolveAuthState() → Promise<User|null>
setAuthenticatedUser(user) → void
showAuthGate(message) → void
hideAuthGate() → void
updateAuthHeader() → void
setupAuthControls(onSignOut) → void
signOutUser(onComplete) → Promise<void>
```

### theme.js
```javascript
setupThemeToggle() → void
applyTheme(isDark) → void
```

---

## Troubleshooting

### Issue: "Module not found" Error
**Solution:** Ensure file paths in import statements are correct:
```javascript
// ✅ Correct
import { ... } from './modules/insights.js';

// ❌ Wrong (missing .js extension or wrong path)
import { ... } from './modules/insights';
import { ... } from './insights.js';
```

### Issue: Function is "not defined"
**Solution:** Make sure you're importing it and using the correct name:
```javascript
// Must import first
import { renderYearInsightCard } from './modules/insights.js';

// Then use it
renderYearInsightCard(state);  // ✅

// Not like this
render YearInsightCard(state);  // ❌ (space)
RenderYearInsightCard(state);   // ❌ (wrong case)
```

### Issue: State object not available in module
**Solution:** Pass state as a parameter to module functions:
```javascript
// In your initialize() or render()
renderYearInsightCard(state);  // Pass state

// In module function
export function renderYearInsightCard(state) {
    const logs = state.logs;  // Access state here
}
```

---

## Next Steps After Module Integration

1. **Create filters.js** - Extract log filter and task time filter logic
2. **Create api.js** - Centralize all API calls
3. **Create state.js** - Manage state updates
4. **Create ui.js** - UI rendering helpers
5. **Consider TypeScript** - Add type safety for better maintainability

---

## Quick Reference

**Where to find each piece of logic:**

| What | Where |
|------|-------|
| Year statistics | `modules/insights.js` |
| Contribution calendar | `modules/contributions.js` |
| Login/Logout | `modules/auth.js` |
| Theme toggle | `modules/theme.js` |
| Everything else | `script.js` (for now) |

---

**Remember:** Migration can be done gradually. You don't have to migrate everything at once!
