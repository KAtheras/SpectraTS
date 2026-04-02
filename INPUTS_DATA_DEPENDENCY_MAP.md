# INPUTS Data Dependency Map (`state.entries` / `state.expenses`)

Scope: Inputs-only behavior (Enter Time / Enter Expenses), including weekly summary/calendar and Inputs edit handoff.

## Inputs > Time

### 1) Consumers of `state.entries` used by Inputs

| File | Function | Purpose |
|---|---|---|
| `app.js` | `getInputsTimeUserDateBounds()` (around line 2522) | Scans current user time entries to compute min/max date bounds for Inputs Time week navigation. |
| `app.js` | `getInputsTimeCalendarBounds()` / `getInputsTimeCalendarDates()` (around lines 2572, 2596) | Clamps current week-end pointer (`state.inputsTimeCalendarEndDate`) to loaded min/max bounds. |
| `app.js` | `buildInputsTimeCalendarData()` (around line 2667) | Scans time entries for current user, aggregates by project/date, builds per-day totals and detail rows for the Inputs Time week grid. |
| `app.js` | `renderInputsTimeSummaryAndCalendarMeta()` (around line 2745) | Uses aggregated week data to show week total, today total, peak day, and prev/next enabled state. |
| `app.js` | `renderInputsTimeCalendar()` (around line 2792) | Renders Inputs Time week table from the aggregated data. |
| `app.js` | `consumePendingInputsTimeEdit()` (around line 3762) | Finds entry by `pendingInputsTimeEditId` in `state.entries` when opening Inputs edit mode from Entries/Inbox deep-link. |
| `app.js` | Inputs week nav handlers (`inputsTimeCalendarPrev/Next`, around lines 5997/6012) | Moves week back/forward, then re-renders summary/calendar; behavior depends on loaded min date and available rows. |

Notes:
- `syncInputsTimeRow()` and row save flows do **not** depend on full `state.entries` history for normal add-new behavior.
- Inputs Time client/project row options are driven by `assignedProjectTuplesForCurrentUser()` (assignments/catalog), not by `state.entries`.

### 2) Dependency type by consumer

| Function | Dependency type |
|---|---|
| `getInputsTimeUserDateBounds` | Depends on loaded min/max date |
| `getInputsTimeCalendarBounds` / `getInputsTimeCalendarDates` | Depends on loaded min/max date + weekly calendar navigation |
| `buildInputsTimeCalendarData` | Needs current week only for output, but currently scans loaded history; depends on summary calculations |
| `renderInputsTimeSummaryAndCalendarMeta` | Depends on summary calculations + weekly calendar navigation |
| `renderInputsTimeCalendar` | Needs current week only (render target), depends on weekly navigation |
| `consumePendingInputsTimeEdit` | Depends on edit-by-id lookup |
| Prev/Next handlers | Depends on weekly calendar navigation + loaded min/max date |

### 3) Risk notes if Time Inputs used a date window

- Week back navigation would stop too early if loaded minimum date is window minimum rather than true historical minimum.
- Week summary (week total/today/peak) would remain correct only for loaded week, but user could not reach older weeks unless older data is fetched.
- `consumePendingInputsTimeEdit()` would fail for older entries not currently loaded (edit intent opens Inputs but row cannot hydrate).
- Calendar “no entries” state could be falsely shown for older weeks not loaded.

Implication:
- Older-week navigation needs auto-fetch (or explicit load-more) before clamping at current loaded minimum.

---

## Inputs > Expenses

### 1) Consumers of `state.expenses` used by Inputs

| File | Function | Purpose |
|---|---|---|
| `app.js` | `getInputsExpenseUserDateBounds()` (around line 2544) | Scans current user expenses to compute min/max date bounds for Inputs Expense week navigation. |
| `app.js` | `getInputsExpenseCalendarBounds()` / `getInputsExpenseCalendarDates()` (around lines 2584, 2618) | Clamps week-end pointer (`state.inputsExpenseCalendarEndDate`) to loaded min/max bounds. |
| `app.js` | `buildInputsExpenseCalendarData()` (around line 2934) | Scans expenses for current user, aggregates by project/date, builds week totals + detail rows for Inputs Expense week grid. |
| `app.js` | `renderInputsExpenseSummaryAndCalendarMeta()` (around line 3020) | Uses aggregated week data to show totals, peak day, and nav states. |
| `app.js` | `renderInputsExpenseCalendar()` (around line 3067) | Renders Inputs Expense week table from aggregated data. |
| `app.js` | `consumePendingInputsExpenseEdit()` (around line 4194) | Finds expense by `pendingInputsExpenseEditId` in `state.expenses` when editing from Entries/Inbox deep-link. |
| `app.js` | Inputs expense week nav handlers (`inputsExpenseCalendarPrev/Next`, around lines 6033/6048) | Moves week back/forward, then re-renders summary/calendar; depends on loaded min date and available rows. |

Notes:
- `syncInputsExpenseRow()` add-new form behavior does not require full historical expenses.
- Inputs Expense client/project options use assignments (`assignedProjectTuplesForCurrentUser()`), not expense history.

### 2) Dependency type by consumer

| Function | Dependency type |
|---|---|
| `getInputsExpenseUserDateBounds` | Depends on loaded min/max date |
| `getInputsExpenseCalendarBounds` / `getInputsExpenseCalendarDates` | Depends on loaded min/max date + weekly calendar navigation |
| `buildInputsExpenseCalendarData` | Needs current week only for output, but currently scans loaded history; depends on summary calculations |
| `renderInputsExpenseSummaryAndCalendarMeta` | Depends on summary calculations + weekly calendar navigation |
| `renderInputsExpenseCalendar` | Needs current week only (render target), depends on weekly navigation |
| `consumePendingInputsExpenseEdit` | Depends on edit-by-id lookup |
| Prev/Next handlers | Depends on weekly calendar navigation + loaded min/max date |

### 3) Risk notes if Expense Inputs used a date window

- Prev-week navigation would clamp to loaded window minimum unless older blocks are fetched.
- Older week totals/details would appear unavailable even when historical expenses exist.
- `consumePendingInputsExpenseEdit()` would fail for an older expense id outside loaded window.
- Inputs Expense summary/peak values are week-local, but users would not be able to navigate to older valid weeks without expansion.

Implication:
- Older-week navigation needs auto-fetch (or explicit load-more) before min-bound clamp.

---

## Cross-file support that affects Inputs behavior

### `entryForm.js`

- `syncFilterCatalogs()` uses `currentEntries(...)` for Entries filter options, not Inputs row rendering.
- No direct Inputs-time/expense weekly calendar dependency on `state.entries`/`state.expenses` from this file.

### `timeEntries.js` / `expenses.js`

- `currentEntries()` / `currentExpenses()` are primary history consumers for Entries tab filtering/tables.
- Inputs weekly summary/calendar in current architecture is built directly in `app.js` from raw `state.entries` / `state.expenses` (not via `currentEntries/currentExpenses`).

---

## 4) Recommended Inputs-only loading model (analysis recommendation)

### Safest default window

- Use the same model for both Time and Expenses for consistency.
- Default Inputs history window: **last 180 days** for the active scope user.
  - Rationale: usually covers day-to-day review while materially reducing payload for larger histories.
  - Keeps weekly summaries useful without immediate expansion for most users.

### Safest trigger for older-week loading

- Trigger expansion on **exact Inputs weekly back-navigation controls** (Prev week click path), before applying min-bound clamp.
- Expansion should continue in chunks until one of:
  - requested target week is covered, or
  - backend reports no older rows.

### Time vs Expenses: same or different?

- **Same behavior recommended** (same trigger semantics and stop conditions).
- Different policies increase UX inconsistency and regression risk in shared Inputs interaction patterns.

### Why this is Inputs-safe

- Inputs add/save row flows do not depend on full historical arrays.
- Inputs historical dependency is concentrated in:
  - weekly calendar aggregates,
  - week navigation bounds,
  - pending edit-by-id hydration.
- Therefore, windowing is feasible if and only if older-week navigation + edit-id hydration can demand-load older slices.
