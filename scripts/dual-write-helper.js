/**
 * Dual-Write Helper for SUBJECTS Migration
 * Ensures SUBJECTS table stays in sync with state_json during Phase 2
 *
 * Usage:
 * - When reading subjects: use loadSubjectsForUser()
 * - When writing subjects: use syncSubjectChanges()
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "tracker.sqlite");
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

/**
 * Load subjects from the new SUBJECTS table (Phase 2 approach)
 * This is where we gradually transition from state_json to the table
 */
async function loadSubjectsForUser(userId) {
  try {
    const subjects = await all(
      "SELECT id, subject, target, frequency, due_date, skill_tags, factor_tags, archived FROM subjects WHERE user_id = ?",
      [userId],
    );

    // Parse JSON fields if they exist
    return subjects.map((s) => ({
      id: s.id,
      subject: s.subject,
      target: s.target,
      frequency: s.frequency,
      dueDate: s.due_date,
      skillTags: s.skill_tags ? JSON.parse(s.skill_tags) : [],
      factorTags: s.factor_tags ? JSON.parse(s.factor_tags) : [],
      archived: Boolean(s.archived),
    }));
  } catch (error) {
    console.error(`Failed to load subjects for user ${userId}:`, error);
    return [];
  }
}

/**
 * Sync subject changes when state is saved
 * Implements dual-write: updates both SUBJECTS table AND state_json
 */
async function syncSubjectChanges(userId, stateJson) {
  if (!stateJson || !Array.isArray(stateJson.subjects)) {
    return; // Nothing to sync
  }

  try {
    const incomingSubjects = stateJson.subjects;
    const existingSubjects = await all(
      "SELECT id FROM subjects WHERE user_id = ?",
      [userId],
    );
    const existingIds = new Set(existingSubjects.map((s) => s.id));

    // UPSERT each subject (insert or update)
    for (const subject of incomingSubjects) {
      const id = subject.id || `subject-${userId}-${Date.now()}`;
      const skillTags = subject.skillTags
        ? JSON.stringify(subject.skillTags)
        : null;
      const factorTags = subject.factorTags
        ? JSON.stringify(subject.factorTags)
        : null;

      if (existingIds.has(id)) {
        // Update
        await run(
          `UPDATE subjects 
                     SET subject = ?, target = ?, frequency = ?, due_date = ?, skill_tags = ?, factor_tags = ?, archived = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND user_id = ?`,
          [
            subject.subject,
            subject.target,
            subject.frequency,
            subject.dueDate,
            skillTags,
            factorTags,
            subject.archived ? 1 : 0,
            id,
            userId,
          ],
        );
      } else {
        // Insert
        await run(
          `INSERT INTO subjects (id, user_id, subject, target, frequency, due_date, skill_tags, factor_tags, archived)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            userId,
            subject.subject,
            subject.target,
            subject.frequency,
            subject.dueDate,
            skillTags,
            factorTags,
            subject.archived ? 1 : 0,
          ],
        );
      }
    }

    // Delete subjects that were removed from state
    const incomingIds = new Set(incomingSubjects.map((s) => s.id));
    const toDelete = Array.from(existingIds).filter(
      (id) => !incomingIds.has(id),
    );

    for (const id of toDelete) {
      await run("DELETE FROM subjects WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);
    }

    console.log(
      `[dual-write] Synced ${incomingSubjects.length} subjects for user ${userId}`,
    );
  } catch (error) {
    console.error(`[dual-write] Sync failed for user ${userId}:`, error);
    // Don't throw - allow state save to continue even if sync fails
  }
}

/**
 * Validate that SUBJECTS table matches state_json
 * Used for monitoring and debugging
 */
async function validateDataIntegrity(userId, stateJson) {
  try {
    const jsonSubjectsCount =
      stateJson && Array.isArray(stateJson.subjects)
        ? stateJson.subjects.length
        : 0;
    const tableSubject = await get(
      "SELECT COUNT(*) as count FROM subjects WHERE user_id = ?",
      [userId],
    );
    const tableCount = tableSubject?.count || 0;

    if (jsonSubjectsCount !== tableCount) {
      console.warn(
        `[validation] User ${userId}: state_json has ${jsonSubjectsCount} subjects, table has ${tableCount}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[validation] Check failed for user ${userId}:`, error);
    return false;
  }
}

module.exports = {
  loadSubjectsForUser,
  syncSubjectChanges,
  validateDataIntegrity,
  closeDb: () => db.close(),
};
