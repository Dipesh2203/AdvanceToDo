# Phase 3: Cleanup & Finalization

This document guides you through finalizing the database migration and removing all dual-write logic.

## Overview

- **Goal**: Make SUBJECTS table the exclusive source of truth
- **Approach**: Remove dual-write, enforce constraints, update docs
- **Irreversible**: This is the final step; backup DB before proceeding
- **Timeline**: 1-2 hours

## ⚠️ Prerequisites

Before starting Phase 3:
- [ ] Phase 2 has been running in production for 1-2 weeks
- [ ] No errors in logs related to SUBJECTS table
- [ ] All frontend CRUD operations verified working
- [ ] Database backup created

## Changes to Make

### Step 1: Run Cleanup Script

```bash
node scripts/phase3-cleanup.js
```

**What it does:**
- Enforces NOT NULL constraints on SUBJECTS columns
- Drops DIARY_ENTRIES_REBUILT (migration artifact)
- Verifies data integrity
- Confirms all subjects have valid user references

### Step 2: Update server.js - Remove Dual-Write

**Remove these lines** (around line 11-20):

```javascript
// REMOVE THIS BLOCK - no longer needed after Phase 3
const dualWriteHelper = (() => {
  try {
    return require("./scripts/dual-write-helper.js");
  } catch {
    console.warn("[Phase2] Dual-write helper not available; graceful fallback enabled");
    return null;
  }
})();
```

**Update `/api/state` GET endpoint** - simplify:

```javascript
app.get("/api/state", requireAuth, async (request, response) => {
  try {
    const row = await get("SELECT state_json, updated_at FROM user_state WHERE user_id = ?", [request.currentUser.id]);

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

    // Phase 3: Load subjects from SUBJECTS table (exclusive source)
    if (parsedState) {
      try {
        const subjects = await all(
          "SELECT id, subject, target, frequency, due_date, skill_tags, factor_tags, archived FROM subjects WHERE user_id = ?",
          [request.currentUser.id]
        );
        parsedState.subjects = subjects.map(s => ({
          id: s.id,
          subject: s.subject,
          target: s.target,
          frequency: s.frequency,
          dueDate: s.due_date,
          skillTags: s.skill_tags ? JSON.parse(s.skill_tags) : [],
          factorTags: s.factor_tags ? JSON.parse(s.factor_tags) : [],
          archived: Boolean(s.archived)
        }));
      } catch (error) {
        console.warn("[Phase3] Failed to load subjects:", error);
      }
    }

    response.json({ state: parsedState, updatedAt: row.updated_at });
  } catch (error) {
    response.status(500).json({ error: "Failed to read state" });
  }
});
```

**Update `/api/state` PUT endpoint** - remove dual-write, only update SUBJECTS:

```javascript
app.put("/api/state", requireAuth, async (request, response) => {
  try {
    const incomingState = request.body && request.body.state;
    if (!incomingState || typeof incomingState !== "object") {
      response.status(400).json({ error: "Invalid payload. Expected { state: object }." });
      return;
    }

    const now = new Date().toISOString();

    // Update state_json (for backward compat, subjects are separate now)
    const stateWithoutSubjects = { ...incomingState };
    delete stateWithoutSubjects.subjects; // Remove subjects from state_json

    await run(
      `INSERT INTO user_state (user_id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`,
      [request.currentUser.id, JSON.stringify(stateWithoutSubjects), now]
    );

    // Phase 3: Write subjects directly to SUBJECTS table (exclusive)
    const subjects = incomingState.subjects || [];
    const existingSubjects = await all("SELECT id FROM subjects WHERE user_id = ?", [request.currentUser.id]);
    const existingIds = new Set(existingSubjects.map(s => s.id));

    for (const subject of subjects) {
      const id = subject.id || `subject-${request.currentUser.id}-${Date.now()}`;
      const skillTags = subject.skillTags ? JSON.stringify(subject.skillTags) : null;
      const factorTags = subject.factorTags ? JSON.stringify(subject.factorTags) : null;

      if (existingIds.has(id)) {
        await run(
          `UPDATE subjects SET subject = ?, target = ?, frequency = ?, due_date = ?, skill_tags = ?, factor_tags = ?, archived = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
          [subject.subject, subject.target, subject.frequency, subject.dueDate, skillTags, factorTags, subject.archived ? 1 : 0, now, id, request.currentUser.id]
        );
      } else {
        await run(
          `INSERT INTO subjects (id, user_id, subject, target, frequency, due_date, skill_tags, factor_tags, archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, request.currentUser.id, subject.subject, subject.target, subject.frequency, subject.dueDate, skillTags, factorTags, subject.archived ? 1 : 0, now, now]
        );
      }
    }

    // Delete removed subjects
    const incomingIds = new Set(subjects.map(s => s.id));
    const toDelete = Array.from(existingIds).filter(id => !incomingIds.has(id));
    for (const id of toDelete) {
      await run("DELETE FROM subjects WHERE id = ? AND user_id = ?", [id, request.currentUser.id]);
    }

    response.json({ ok: true, updatedAt: now });
  } catch (error) {
    response.status(500).json({ error: "Failed to save state" });
  }
});
```

**Keep or remove validation endpoint:**

You can keep `/api/debug/validate-subjects` for monitoring, or remove it if no longer needed.

### Step 3: Update ER Diagram

Update `static/assets/er-diagram-viewer.html` with new schema:

```text
USERS
  ├── SESSIONS (FK: user_id)
  ├── USER_STATE (FK: user_id)
  ├── SUBJECTS (FK: user_id) ← NEW PRIMARY TABLE
  ├── DIARY_ENTRIES (FK: user_id)
  ├── REMINDERS_SENT (FK: user_id, task_id→subjects.id)
  └── REMINDER_SCAN_STATE_V2 (FK: user_id)

APP_STATE (singleton)
```

### Step 4: Update Documentation

Update `MODULAR_STRUCTURE.md`:

```markdown
## Database Schema (Final - Phase 3)

### SUBJECTS (Normalized)
- **Primary Key**: `id` (TEXT)
- **Foreign Key**: `user_id` → USERS.id
- **Unique Constraint**: None (allows multiple subjects per user)
- **Columns**:
  - `id`: TEXT NOT NULL - Unique subject identifier
  - `user_id`: INTEGER NOT NULL - User who owns this subject
  - `subject`: TEXT NOT NULL - Subject name/title
  - `target`: INTEGER - Target value for the subject
  - `frequency`: TEXT - Frequency of occurrence
  - `due_date`: TEXT - Due date for completion
  - `skill_tags`: TEXT (JSON) - Array of skill tags
  - `factor_tags`: TEXT (JSON) - Array of factor tags
  - `archived`: BOOLEAN DEFAULT 0 - Whether subject is archived
  - `created_at`: TEXT - Timestamp when created
  - `updated_at`: TEXT - Last update timestamp

### Removed Tables
- `DIARY_ENTRIES_REBUILT` - Migration artifact, no longer needed

### Migration Complete
All SUBJECTS data is now exclusively in the normalized table.
State_json no longer contains subject data.
```

## Testing Checklist

### Local Testing

```bash
# Restart server
npm start

# Test API
curl http://localhost:3000/api/state -H "Cookie: advance_todo_session=YOUR_TOKEN"

# Should return subjects from SUBJECTS table
```

### Frontend Tests

- [ ] Create new subject → appears immediately
- [ ] Edit subject → changes persist after refresh
- [ ] Delete subject → removed from view
- [ ] Archive subject → hidden from active list
- [ ] Refresh page → all data present
- [ ] Browser restart → data persists

### Monitoring

```bash
# Check for errors
grep "ERROR\|WARN" server.log | tail -20

# Verify query performance
grep "SELECT.*subjects" server.log
```

## Success Criteria

✅ All CRUD operations work with SUBJECTS table
✅ No errors in server logs
✅ Frontend displays all subjects correctly
✅ Data persists after page refresh/restart
✅ ER diagram updated
✅ Documentation reflects final schema
✅ No dual-write logic in code

## Rollback Plan

If critical issues arise:

1. **Restore database backup** from before Phase 3
2. **Revert server.js** to Phase 2 version
3. **Restart server**
4. **Investigate** what went wrong
5. **Fix** issues before trying Phase 3 again

## What's Next?

After Phase 3 is complete and stable:

- Archive this migration documentation
- Update team documentation
- Plan next improvements (e.g., REMINDER_SCAN_STATE_V2 optimization)
- Monitor production for issues

---

**Need help?**
- Review `plan.md` for overall strategy
- Check server logs for diagnostic info
- Reach out to team for questions
