# Inputs Style Audit

## 1) Top 10 Inputs-related selectors/rule groups causing style inflation
1. `#inputs-view .input-row-head` + `#inputs-view .input-row-head .cell-*` + `#inputs-view #inputs-panel-*.input-row-head::after`
- Header surface/divider behavior is split across row, cells, and pseudo-elements.

2. `#inputs-view .cell-project, .cell-date, .cell-category, .cell-hours, .cell-amount, .cell-billable, .cell-notes, .cell-actions`
- Core grid borders are centralized here, but several cell-specific overrides later alter edge behavior.

3. `#inputs-view .input-row-head .cell-actions`
- Action-column header has repeated special-casing (`border: none !important`, separate left-edge logic, background overrides).

4. `#inputs-view input:not([type="checkbox"]), #inputs-view select, #inputs-view button`
- Very broad Inputs-wide control rule, followed by many narrow overrides for row controls.

5. `#inputs-view .input-row-body[data-saved="true"] .cell-*`
- Saved-row state is controlled in one place, but visual intent is sensitive and repeatedly tweaked.

6. `#inputs-view .inputs-drilldown-item`, `:hover/:focus-visible`, `.is-active`, `.is-zero`
- Base state plus multiple state variants create a growing state matrix.

7. `#inputs-view .inputs-drilldown-layout > .inputs-drilldown-col:nth-child(1|2) ...`
- Column-specific hover/active variables and overrides are cleaner than before, but still verbose due to `nth-child` routing.

8. `body[data-theme="dark"] #inputs-view ... inputs-drilldown-item...`
- Dark-mode text/value and zero-state handling repeats parallel logic from light mode.

9. `#inputs-view .inputs-drilldown-detail-row` + hover/focus + dark hover/focus + button-on-row-hover rules
- Details interaction behavior is split across container and secondary button emphasis rules.

10. Legacy pre-`#inputs-view` Inputs-like rules around `.input-grid`, `.input-row-head`, `#inputs-panel-time ...`
- Older general selectors still coexist with the isolated `#inputs-view` block, increasing cascade complexity.

## 2) Specific conflicts/duplications
- **Duplicate system layers**: legacy `.input-row*` / `#inputs-panel-time*` rules and newer `#inputs-view ...` rules both target the same conceptual UI.
- **Header divider complexity**: divider outcome is produced by row border + cell border suppression + optional `::after` background bridging.
- **Action-cell special casing**: rightmost header cell repeatedly diverges, then is normalized, then diverges again in follow-up edits.
- **Broad-to-narrow overrides**: global Inputs control styles are repeatedly overridden by row-specific control rules (`border-radius`, `border`, `height`, etc.).
- **Drilldown state fan-out**: base + per-column + zero-state + dark-mode state rules govern the same visual outcomes.
- **Theme duplication**: several dark rules are direct mirrors with different values rather than shared tokenized mappings.

## 3) Maintainability ratings
- **Border system complexity**: **High**
- **Hover/selected-state complexity**: **Medium-High**
- **Theme override complexity**: **Medium-High**
- **Overall style inflation (Inputs only)**: **High**

## 4) Recommended path
**B. Targeted cleanup only**

Rationale:
- The page has many incremental overrides, but structure and behavior are now known/stable.
- A full rewrite is unnecessary risk for a UI that has already undergone many micro-adjustments.
- High-value consolidation can materially reduce complexity without changing appearance.

## 5) The 3 highest-value cleanup targets
1. **Unify top section to one ruleset source of truth**
- Consolidate or retire legacy pre-`#inputs-view` input-grid/header/time-panel blocks that overlap the isolated Inputs system.
- Biggest offender: overlapping `.input-row*` + `#inputs-panel-time*` rule clusters outside the `#inputs-view` section.

2. **Flatten header/border ownership model**
- Keep exactly one owner per border edge (header divider, vertical separators, row bottoms).
- Keep `::after` only for fill/coverage use-cases, not edge semantics.

3. **Compress drilldown state matrix**
- Keep current visual behavior, but collapse repeated per-column/per-theme state declarations into shared tokenized state maps.
- Prioritize consolidating `nth-child(1|2)` hover/active and dark-mode parallel overrides.

