# JavaScript Modules Documentation

This directory contains modularized JavaScript for the Advance Todo tracker. The codebase has been organized into focused, maintainable modules.

## Module Overview

### 📊 **insights.js**
**Purpose:** Year insight card rendering and statistics
- `renderYearInsightCard()` - Renders annual statistics (focus time, sessions, streaks, best days/weeks/months)
- `getISOWeek()` - Calculates ISO week numbers
- `diffDays()` - Calculates day differences

**Use Case:** Debugging or enhancing year overview metrics

---

### 🎨 **contributions.js**
**Purpose:** GitHub-style contribution graph visualization
- `renderContributionGraph()` - Renders contribution calendar
- `setupContributionYearFilter()` - Year selection dropdown
- `getContributionYears()` - Extracts available years from data
- `populateContributionYearFilter()` - Populates dropdown options
- `formatLoggedHours()` - Formats time display

**Use Case:** Fixing contribution chart misbehavior or styling issues

---

### 🔐 **auth.js**
**Purpose:** Authentication and user session management
- `resolveAuthState()` - Check current user (calls `/api/me`)
- `setAuthenticatedUser()` - Update auth state
- `setupAuthInterface()` - Inject login/register UI
- `showAuthGate()` / `hideAuthGate()` - Control auth modal
- `signInUser()` / `signOutUser()` - User actions
- `updateAuthHeader()` - Update user badge display

**Use Case:** Debugging login issues or modifying auth flow

---

### 🌙 **theme.js**
**Purpose:** Dark/light theme management
- `setupThemeToggle()` - Initialize theme toggle with persistence
- `applyTheme()` - Apply theme class and update UI

**Use Case:** Theme system modifications

---

## Migration Status

The following functions have been extracted into modules:
- ✅ Year Insight (`renderYearInsightCard`)
- ✅ Contribution Graph (`renderContributionGraph`)
- ✅ Authentication (all auth functions)
- ✅ Theme Toggle (theme setup and application)

**Next Steps:**
- [ ] Extract filters module (log filters, task filters)
- [ ] Extract API utilities module
- [ ] Create state management module
- [ ] Extract UI helpers (render functions, element updates)
- [ ] Update main `script.js` to import modules

## How to Use Modules

### Import in script.js
```javascript
import { renderYearInsightCard, getISOWeek } from './modules/insights.js';
import { renderContributionGraph, setupContributionYearFilter } from './modules/contributions.js';
import { setupAuthInterface, resolveAuthState } from './modules/auth.js';
import { setupThemeToggle } from './modules/theme.js';
```

### In HTML
```html
<script type="module" src="/static/js/script.js"></script>
```

## Benefits of Modularization

1. **Easy Maintenance:** Related code is grouped together
   - Year Insight issues? Look in `insights.js`
   - Contribution chart misbehaves? Check `contributions.js`

2. **Reusability:** Functions can be imported in other files

3. **Clear Dependencies:** Each module shows what it needs

4. **Scalability:** New features can be added in dedicated modules

5. **Testing:** Modules can be tested independently

## Common Tasks

### Debug Year Insight
1. Open `modules/insights.js`
2. Find `renderYearInsightCard()` function
3. Check calculation logic for stats, streaks, etc.

### Fix Contribution Chart
1. Open `modules/contributions.js`
2. Check `renderContributionGraph()` for year handling
3. Look at `createContributionCell()` for styling issues

### Modify Auth Flow
1. Open `modules/auth.js`
2. Update relevant auth functions
3. Ensure state changes are reflected in `updateAuthHeader()`

## Future Improvements

- Add TypeScript for type safety
- Create filters module for log/task filters
- Extract API calls into dedicated module
- Implement event emitter pattern for state changes
- Add comprehensive error handling
