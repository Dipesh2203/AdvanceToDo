# Phase 2: Backend Integration & Testing

This document guides you through integrating the new SUBJECTS table into the backend with dual-write logic.

## Overview

- **Goal**: Make `/api/state` return subjects from both sources (with SUBJECTS table as primary)
- **Approach**: Implement dual-write so changes sync to both places
- **Safety**: State.json stays updated; can rollback anytime
- **Timeline**: 3-4 hours active work

## Changes to Make

### Step 1: Import Dual-Write Helper

In `server.js`, add this import near the top:

```javascript
// Phase 2: Dual-write helper for SUBJECTS normalization
const dualWriteHelper = (() => {
  try {
    return require("./scripts/dual-write-helper.js");
  } catch {
    return null; // Helper optional; graceful fallback if not available
  }
})();
```

### Step 2: Update `/api/state` Endpoint

**Current code** (around line 1850):

```javascript
app.get("/api/state", requireAuth, async (request, response) => {
    try {
        const row = await get("SELECT state_json, updated_at FROM user_state WHERE user_id = ?", [request.currentUser.id]);
        // ... parse and return
    }
});
```

**New code** (dual-read):

```javascript
app.get("/api/state", requireAuth, async (request, response) => {
  try {
    const row = await get(
      "SELECT state_json, updated_at FROM user_state WHERE user_id = ?",
      [request.currentUser.id],
    );

    if (!row) {
      response.json({ state: null, updatedAt: null });
      return;
    }

    let parsedState = null;
    try {
      parsedState = JSON.parse(row.state_json);
    } catch (_error) {
      parsedState = null;
    }

    // Phase 2: If SUBJECTS table exists and has data, use it as primary
    if (dualWriteHelper && parsedState) {
      try {
        const tableSubjects = await dualWriteHelper.loadSubjectsForUser(
          request.currentUser.id,
        );
        if (tableSubjects.length > 0) {
          // Use table as primary source
          parsedState.subjects = tableSubjects;
          // Optionally log for monitoring:
          // console.log(`[Phase2] Returned ${tableSubjects.length} subjects from table for user ${request.currentUser.id}`);
        }
      } catch (error) {
        console.warn(
          "[Phase2] Failed to load from SUBJECTS table, using state_json fallback:",
          error,
        );
      }
    }

    response.json({
      state: parsedState,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    response.status(500).json({ error: "Failed to read state" });
  }
});
```

### Step 3: Update `/api/state/save` Endpoint (PUT or POST)

Find where state is saved. Usually looks like:

```javascript
app.put("/api/state/save", requireAuth, async (request, response) => {
  // ... validation
  // ... update user_state table
});
```

Add dual-write sync after updating state_json:

```javascript
app.put("/api/state/save", requireAuth, async (request, response) => {
  try {
    const { state } = request.body;

    // ... existing validation ...

    // Update state_json (existing code)
    const updatedAt = new Date().toISOString();
    await run(
      "UPDATE user_state SET state_json = ?, updated_at = ? WHERE user_id = ?",
      [JSON.stringify(state), updatedAt, request.currentUser.id],
    );

    // Phase 2: Sync subjects to SUBJECTS table (new code)
    if (dualWriteHelper) {
      try {
        await dualWriteHelper.syncSubjectChanges(request.currentUser.id, state);
      } catch (error) {
        console.error("[Phase2] Dual-write sync failed:", error);
        // Don't fail the request; state_json is still updated
      }
    }

    response.json({ success: true, updatedAt });
  } catch (error) {
    response.status(500).json({ error: "Failed to save state" });
  }
});
```

### Step 4: Add Validation Endpoint (Optional but Recommended)

Add this endpoint to monitor data integrity during Phase 2:

```javascript
app.get(
  "/api/debug/validate-subjects",
  requireAuth,
  async (request, response) => {
    if (!dualWriteHelper) {
      response.status(501).json({ error: "Validation helper not available" });
      return;
    }

    try {
      const row = await get(
        "SELECT state_json FROM user_state WHERE user_id = ?",
        [request.currentUser.id],
      );
      const stateJson = row ? JSON.parse(row.state_json || "{}") : {};

      const isValid = await dualWriteHelper.validateDataIntegrity(
        request.currentUser.id,
        stateJson,
      );
      const tableSubjects = await dualWriteHelper.loadSubjectsForUser(
        request.currentUser.id,
      );
      const jsonSubjects = stateJson.subjects || [];

      response.json({
        valid: isValid,
        sourceOfTruth: "SUBJECTS table (Phase 2)",
        comparison: {
          stateJsonCount: jsonSubjects.length,
          tableCount: tableSubjects.length,
          match: jsonSubjects.length === tableSubjects.length,
        },
      });
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  },
);
```

## Testing Checklist

### Local Testing (Before Deploy)

- [ ] Restart server: `npm start`
- [ ] Check console for errors on startup
- [ ] Open DevTools (F12) and check Network tab

### API Tests

```bash
# Test 1: Read state (should pull from SUBJECTS table now)
curl http://localhost:3000/api/state \
  -H "Cookie: advance_todo_session=YOUR_TOKEN"

# Test 2: Create a subject (frontend)
# Open app, create a new subject, check console logs

# Test 3: Validate data integrity
curl http://localhost:3000/api/debug/validate-subjects \
  -H "Cookie: advance_todo_session=YOUR_TOKEN"
```

### Frontend Tests

1. **Create Subject**: Add new task → should appear immediately
2. **Edit Subject**: Change name/target → should persist
3. **Archive Subject**: Archive task → should hide from active list
4. **Delete Subject**: Delete task → should be gone
5. **Refresh Page**: F5 → subjects should still be there
6. **Browser Restart**: Close & reopen → data should persist

### Monitoring in Production

#### Logs to Watch

```bash
# Dual-write sync messages
grep "dual-write" server.log

# Validation warnings
grep "validation" server.log

# Phase2 debug info
grep "Phase2" server.log
```

#### Metrics to Check

- Error rate for `/api/state` (should be 0%)
- Response time for `/api/state` (should be <100ms)
- Database size (SUBJECTS table should have ~27 rows for now)

## Rollback Plan

If issues arise in Phase 2:

1. **Immediate**: Modify `/api/state` to ignore SUBJECTS table
   ```javascript
   // Comment out Phase 2 code in /api/state
   // parsedState.subjects will come from state_json only
   ```
2. **Restart**: Restart Node server
3. **Data Safety**: All data in state_json is unchanged; no data loss
4. **Decision**: Analyze logs and decide whether to:
   - Fix the issue and re-enable dual-write
   - Skip Phase 2 entirely (run on state_json-only)
   - Troubleshoot further

## Success Criteria

✅ All CRUD operations work
✅ Subjects display correctly on frontend
✅ Refresh persists data
✅ No console errors
✅ API response times acceptable (<100ms)
✅ Validation endpoint shows data match

## Next (Phase 3)

After 1-2 weeks of monitoring:

- Remove dual-write code
- Drop state_json subject data
- Add NOT NULL constraints
- Update ER diagram
- Complete documentation

## Questions?

- Check `plan.md` for overall strategy
- Review `dual-write-helper.js` for implementation details
- Check server logs for diagnostic info
