# app.js Extraction Candidates (Maintainability Analysis)

## Major feature areas currently inside `app.js`

1. Boot/session/state hydration
- `loadPersistentState`, `loadSettingsMetadata`, `mutatePersistentState`, `initApp`
- Approx region: `~1965-2099`, `~9090-end`

2. Global render/router shell
- `render`, `setView`, shell toggles, view dispatch
- Approx region: `~2167-2266`, `~5734-6125`

3. Theme + app preferences
- `loadThemePreference`, `saveThemePreference`, `clearThemePreference`, `resolveTheme`, `applyTheme`
- plus toggle + media listeners
- Approx region: `~1329-1379`, `~6850-6865`

4. Shared time/expense filter orchestration
- `resetFilters`, `syncSharedEntriesFilterForms`, `syncSharedEntriesFiltersFromTime`, `syncSharedEntriesFiltersFromExpense`, `applyFiltersFromForm`
- plus filter event wiring
- Approx region: `~1832-1960`, `~6082-6121`, `~6966-7060`

5. Inputs: time/expense row editors + calendar summaries
- calendar data/render + row add/edit/save + pending edit consumption
- Approx region: `~2741-4724`, with handlers `~6513-6679`

6. Inbox feature
- normalization, read/unread, bulk selection/actions, render, deep-link routing/open
- Approx region: `~1513`, `~2144-2166`, `~6158-6402`, handlers `~6695-6742`

7. Audit log UX
- filters/download dialog/date bounds/load more
- Approx region: `~5047-5331`, handlers `~7062-7134`

8. Clients/projects feature controller
- client editor lifecycle, client list actions, project list actions, mobile clients back
- Approx region: `~8151-8508` (+ helper setup near `~576`, `~766`)

9. Members assignment modal + project staffing mutations
- `memberModalState` flow, modal confirm state-machine with many modes
- Approx region: state seed `~1305`, heavy mutation flow `~8594-9053`

10. Settings forms/actions wiring
- levels/categories/offices/corporate functions/departments and permissions gates
- Approx region: `~7346-8149`

11. Mobile-specific UI behavior
- members/clients drilldown and touch date adapters
- Approx region: `~2192-2247`, `~6904-6955`, `~8239`

12. Cross-module dependency export layer
- `window.settingsAdminDeps`, `window.catalogEditorDeps`, `window.timeEntriesDeps`, `window.expensesDeps`
- Approx region: `~8888-9049`

---

## Ranked top 10 extraction candidates

Scoring basis: clear boundary, low extraction risk, high change frequency, low entanglement, high payoff.

| Rank | Candidate | Boundary clarity | Regression risk if extracted | Ongoing change frequency | Cross-feature entanglement | Maintainability payoff | Why this rank |
|---|---|---|---|---|---|---|---|
| 1 | Inbox feature module (`inbox*`, `renderInboxList`, `routeInboxDeepLink`, handlers) | High | Low | High | Low | High | Very cohesive, mostly self-contained state + DOM refs, high UI churn potential. |
| 2 | Audit filters/download module (`syncAudit*`, download dialog, `loadAuditLogs` wiring) | High | Low | Medium | Low | High | Strongly bounded surface; extraction reduces event-wiring density with minimal shared coupling. |
| 3 | Shared entries/expenses filter orchestrator (`syncSharedEntries*`, form handlers) | High | Medium | High | Medium | High | Frequent change area; currently duplicated/time+expense coordination in one place. |
| 4 | Theme/preferences module (`load/save/resolve/applyTheme`, media/toggle listeners) | High | Low | Medium | Low | Medium | Small, clean boundary; low-risk immediate cleanup and testability improvement. |
| 5 | Mobile interaction adapter (drilldown + coarse-pointer date input adapters) | Medium-High | Low | Medium | Low-Medium | Medium-High | Distinct concerns mixed into main controller; can be isolated with little domain impact. |
| 6 | Clients/projects page action controller (client/project list listeners + CRUD dispatch) | Medium | Medium | High | Medium | High | High payoff but coupled to permissions and shared filters, so second wave. |
| 7 | Settings action wiring (levels/offices/categories/corporate/departments handlers) | Medium | Medium-High | High | Medium-High | High | Very large and active area, but many dependencies and mutation side effects. |
| 8 | Members modal assignment state-machine (`membersConfirm` flow) | Medium | High | Medium-High | High | High | Big maintainability win, but risk is high due to complex mode matrix and mutation ordering. |
| 9 | Render/view dispatcher (`render`, shell/nav toggles, per-view dispatch) | Medium | Medium-High | High | High | High | Central orchestration; valuable later once feature modules are extracted first. |
| 10 | Boot/state hydration pipeline (`loadPersistentState`, `loadSettingsMetadata`, `mutatePersistentState`, `initApp`) | Medium | Medium-High | Medium | High | Medium-High | Critical path code; extract only after feature boundaries are cleaner. |

---

## Top 5 candidates: what to move vs keep

### 1) Inbox feature module (Best first)
What should stay in `app.js` for now:
- `setView` ownership and the call sites that switch views.
- Global `mutatePersistentState` function (called by many features).

What could be safely moved first:
- `inboxUnreadCount`, `inboxReadCount`, `visibleInboxItems`
- `selectedInboxIds`, `setInboxSelected`, `clearInboxSelection`, `syncInboxBulkControls`
- `deleteInboxItem`, `deleteSelectedInboxItems`, `deleteAllReadInboxItems`, `markSelectedInboxRead`
- `renderInboxList`, `routeInboxDeepLink`, `openInboxItem`
- Inbox event bindings (`refs.inboxFilterAll`, `refs.inboxFilterUnread`, `refs.inboxList`, bulk buttons)

What NOT to move yet:
- `beginInboxVisit` / `commitInboxVisitRead` integration inside `setView` transitions.

Why:
- This keeps router semantics stable while extracting a highly cohesive feature block with minimal dependencies.

### 2) Audit filters/download module (Second-best)
What should stay in `app.js` for now:
- Top-level view gating (`if view === "audit" ...`) in `render`.

What could be safely moved first:
- `syncAuditLoadMoreButton`, `normalizeAuditDateValue`, `buildAuditServerFilters`, `auditDateBounds`, `applyAuditDownloadDateBounds`, `syncAuditDownloadActorOptions`, `open/closeAuditDownloadDialog`
- Audit download event handlers (`auditDownload*`, `auditLoadMore`, filter onchange bindings)

What NOT to move yet:
- Shared `feedback` implementation and generic CSV download plumbing if reused elsewhere.

Why:
- Highly bounded by `refs.audit*` and `state.audit*`; minimal cross-feature side effects.

### 3) Shared entries/expense filter orchestration
What should stay in `app.js` for now:
- Entry/expense table rendering calls in `render` (for now).

What could be safely moved first:
- `cloneEntriesFilterState`, `resolveTimeFilterUser`, `resolveExpenseFilterUser`
- `syncSharedEntriesFilterForms`, `syncSharedEntriesFiltersFromTime`, `syncSharedEntriesFiltersFromExpense`
- `applyFiltersFromForm` and paired expense filter glue handlers (`~6966-7060`)

What NOT to move yet:
- Domain-specific `currentEntries()` / `currentExpenses()` filtering internals if these live across modules.

Why:
- Frequent product tweaks happen here; extracting reduces repeated coupling bugs between time/expense tabs.

### 4) Theme/preferences module
What should stay in `app.js` for now:
- Single call site `applyTheme(resolveTheme())` and logout call `clearThemePreference()` invocation point.

What could be safely moved first:
- Entire theme preference/read/write/resolve/apply function set.
- Theme toggle click + `themeMedia` change listener registration.

What NOT to move yet:
- Any settings-menu behavior unrelated to theme (`closeSettingsMenu` coupling can stay as callback).

Why:
- Very clean boundary and low risk; fast win for readability, but lower payoff than Inbox/Audit/Filters.

### 5) Mobile interaction adapter
What should stay in `app.js` for now:
- Core `state.currentView` decisions and desktop render routing.

What could be safely moved first:
- `isMobileDrilldownViewport`, `syncClientsMobileDrilldownState`, `syncMembersMobileDrilldownState`, `onMobileMemberSelected`, `onMobileMembersBack`
- touch-only date initializer block (`initMobileFilterDate`, `initMobileExpenseFilterDate`)
- clients mobile back handler

What NOT to move yet:
- Feature-specific mutation calls triggered from mobile screens (keep in owning feature modules).

Why:
- Mobile behavior is currently spread across render + handlers; extraction improves mental model without touching core business logic.

---

## Single best and second-best first extraction

Best first extraction: **Inbox feature module**
- Why: highest boundary clarity + lowest extraction risk among high-change areas, with immediate payoff in reducing `app.js` event wiring and UI state complexity.

Second-best extraction: **Audit filters/download module**
- Why: similarly clean boundary and low risk; smaller than Inbox, but still high return by isolating dense, form-heavy logic from global controller flow.

