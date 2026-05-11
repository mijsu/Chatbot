# BACKUP-EXPORT Agent Work Record

## Task: Add Data Backup/Export and Import functionality to the Settings screen

### Files Created:
1. `/home/z/my-project/src/lib/data-export.ts` — Export/Import utility module

### Files Modified:
1. `/home/z/my-project/src/components/chatbot/settings-screen.tsx` — Added Backup UI section

### Changes Made:

#### 1. Created `/home/z/my-project/src/lib/data-export.ts`
- `exportAllData()`: Exports all Dexie.js tables to a JSON string with version stamp and timestamp
  - Tables: tasks, reminders, conversations, messages, profile, settings, goals, habits, moods, notifications, conversationMemories, globalMemories, insightLog, contextCache
  - Uses optional chaining (`?.`) for tables that may not exist (conversationMemories, globalMemories, insightLog, contextCache)
- `importAllData()`: Validates and imports a JSON backup, replacing all existing data
  - Validates backup format (checks for `version` and `tasks` fields)
  - Clears all existing tables before import
  - Uses `bulkAdd` for batch insert of each table
  - Handles profile/settings as single-record tables (clear + bulkAdd)
  - Returns success/error with descriptive message

#### 2. Modified `/home/z/my-project/src/components/chatbot/settings-screen.tsx`
- Added `Upload` icon import from lucide-react
- Added `exportAllData`, `importAllData` import from `@/lib/data-export`
- Added state variables: `exporting`, `importing`, `importStatus`, `importInputRef`
- Added `handleExportData` callback:
  - Calls `exportAllData()` to get JSON string
  - Creates Blob with `application/json` MIME type
  - Triggers browser download as `syntra-backup-{date}.json`
  - Shows `[SAVED]` status on success, `[ERROR: EXPORT FAILED]` on failure
  - Cleans up ObjectURL after download
- Added `handleImportData` callback:
  - Reads selected file via `FileReader.text()`
  - Calls `importAllData()` with file contents
  - On success: shows `[RESTORED]` with counts, reloads tasks/reminders/conversations hooks
  - On error: shows `[ERROR]` with message
  - Resets file input after import (allows re-importing same file)
- Added UI in the DATA section, before Factory Reset:
  - **Export Data** card: Download icon, "Download all data as JSON backup" description, loading state
  - **Import Data** card: Upload icon, "Restore from a JSON backup file" description, loading state, inline status message
  - Hidden `<input type="file" accept=".json">` triggered by Import Data click
  - Both cards match existing Nothing Design System style (nd-surface bg, nd-border, rounded-full icon containers)

### Verification:
- Lint passes clean (0 errors on changed files)
- Dev server compiles without errors
- Pre-existing lint errors in global-search.tsx are unrelated
