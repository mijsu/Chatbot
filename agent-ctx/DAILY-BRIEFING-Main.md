# Task: DAILY-BRIEFING

## Summary
Enhanced the existing Daily Summary card on the Home Screen into a full "Daily Briefing" card that appears prominently at the top of the home content.

## Changes Made

### File: `/home/z/my-project/src/components/chatbot/home-screen.tsx`

1. **New State Variables** (after line 643):
   - `briefingDismissed` — per-day localStorage persistence (`syntra_briefing_dismissed_YYYY-MM-DD`)
   - `briefingManuallyToggled` — tracks explicit user toggle
   - `isBeforeTenAM` — computed from current hour
   - `briefingExpanded` — derived: manual override > time-based default

2. **New Callbacks**:
   - `getBriefingDismissKey()` — generates localStorage key for today's date
   - `handleDismissBriefing()` — collapses card, persists to localStorage
   - `handleExpandBriefing()` — re-expands card, removes localStorage entry
   - `classifyHighlight(text)` — regex classifier for urgency (urgent/pending/completed)

3. **New Computed Values**:
   - `suggestedFirstTask` — useMemo: highest-priority pending task from todayTasks

4. **Daily Summary → Daily Briefing Transformation**:
   - New header with DotmTriangle11 animated icon + "DAILY BRIEFING" label
   - "MORNING" badge (shown before 10 AM)
   - "MARK AS READ" dismiss button
   - Highlights with colored dots (🔴 red=urgent, 🟠 orange=pending, 🟢 green=completed)
   - "SUGGESTED FIRST TASK" section with priority-colored card
   - Collapsed state: compact one-liner tappable to re-expand

5. **Skeleton Updated**: Matches new header/body layout

## Verification
- ✅ Lint passes clean (0 errors, 0 warnings)
- ✅ Dev server compiles without errors
