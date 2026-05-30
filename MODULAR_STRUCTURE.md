# Modular Project Structure - Quick Start

Your project has been refactored into **modular JavaScript files** for better maintainability.

## 🎯 What's Changed

### Before (Hard to Maintain)
- Single 4,063-line `script.js` file
- Hard to find Year Insight logic
- Contribution chart bugs scattered throughout
- All functions mixed together

### After (Organized & Maintainable)
```
static/js/
├── modules/
│   ├── insights.js          ← Year Insight card rendering
│   ├── contributions.js      ← Contribution graph (GitHub-style)
│   ├── auth.js              ← Login/logout/user management
│   ├── theme.js             ← Dark/light theme toggle
│   └── README.md            ← Full module documentation
├── script.js                ← Main app logic (gradually being migrated)
├── report.js
├── account-controls.js
└── ... other files
```

## 📍 Finding Code Now

### Year Insight Issues?
→ Open `static/js/modules/insights.js`

### Contribution Chart Problems?
→ Open `static/js/modules/contributions.js`

### Authentication Bugs?
→ Open `static/js/modules/auth.js`

## 🚀 How to Use

1. **Open your HTML file** (e.g., `tracker.html`)
2. **Change the script tag** from:
   ```html
   <script src="/static/js/script.js"></script>
   ```
   To use modules:
   ```html
   <script type="module" src="/static/js/script.js"></script>
   ```

3. **In script.js, import modules** at the top:
   ```javascript
   import { renderYearInsightCard } from './modules/insights.js';
   import { renderContributionGraph } from './modules/contributions.js';
   import { setupAuthInterface, resolveAuthState } from './modules/auth.js';
   ```

4. **Replace function calls** in script.js with imported versions

## 📚 Module Details

| Module | Exports | Location | Use When |
|--------|---------|----------|----------|
| **insights.js** | `renderYearInsightCard`, `getISOWeek`, `diffDays` | `modules/insights.js` | Editing yearly statistics or streak logic |
| **contributions.js** | `renderContributionGraph`, `setupContributionYearFilter`, `formatLoggedHours` | `modules/contributions.js` | Fixing contribution calendar or year filtering |
| **auth.js** | Auth functions, endpoints, auth state | `modules/auth.js` | Modifying login/logout flow or auth UI |
| **theme.js** | `setupThemeToggle`, `applyTheme`, `THEME_KEY` | `modules/theme.js` | Changing theme behavior |

## ✅ Benefits You Get

1. **Find bugs faster** - Related code is in one file
2. **Easier debugging** - Smaller files = clearer logic flow
3. **Better organization** - Clear folder structure
4. **Reusable code** - Import modules in other files
5. **Collaborative** - Team members know where code lives

## 🔄 Migration Path

The transition is gradual:

**Phase 1 (Complete)** ✅
- ✅ Extract insights, contributions, auth, theme modules
- ✅ Create module structure

**Phase 2 (Next)**
- [ ] Create `filters.js` for log/task filters
- [ ] Create `api.js` for API calls
- [ ] Update `script.js` to import all modules
- [ ] Update HTML files to use `<script type="module">`

**Phase 3 (Future)**
- [ ] Create `state.js` for state management
- [ ] Create `ui.js` for UI rendering helpers
- [ ] Fully migrate `script.js`

## 🆘 Need Help?

- **View module details**: Open `modules/README.md`
- **Find a function**: Search in the appropriate module file
- **Understand flow**: Check the function's JSDoc comments

## 💡 Example: Debug Year Insight Issue

If "Best Streak" is calculating wrong:

1. Open `static/js/modules/insights.js`
2. Find `renderYearInsightCard()` function
3. Look for the streak calculation section:
   ```javascript
   // Streaks (ignore 0-day streaks)
   const sortedDays = Array.from(sessionDays).sort();
   ```
4. Debug the loop that builds streaks
5. Fix and test!

---

**Status:** Modularization in progress | **Phase:** 1/3 ✅ | **Modules Created:** 4 | **Lines Organized:** ~1000+
