# Settings UI Spec (Baseline)

## 1) Tab Classification

| Tab | Interaction Type | Notes |
|---|---|---|
| Member levels (`levels`) | Structured/grid editor | Row has plain label + editable text + editable select + delete |
| Practice departments (`departments`) | Simple list editor | Single editable text field per row + delete |
| Expense categories (`categories`) | Simple list editor | Single editable text field per row + delete |
| Office locations (`locations`) | Structured/grid editor | Editable text + editable select per row + delete |
| Corporate Functions (`corporate_functions`) | Hierarchical editor | Editable group rows containing nested editable category rows + delete at both levels |
| Member information (`rates`) | Read-only/info view with actions | Card/list info view; edit via action button, remove action present |
| Messaging Rules (`messaging_rules`) | Structured/grid editor | Table rows with toggle controls (inbox/email), recipient column read-only |
| Delegations (`delegations`) | Structured/grid editor | 3-column form: delegate picker, capability toggles, delegated-member pills |
| Member access levels (`permissions`) | Structured/grid editor | Capability x role matrix with toggle switches |
| Bulk Upload (`bulk_upload`) | Read-only/info tool view | Action-driven workflow (upload/download/import), no inline row editing |

## 2) Editability Model By Tab

### Simple list editors
- `departments`, `categories`:
  - Plain labels: section title/header labels only
  - Inline editable text: row name input
  - Inline selectable dropdowns: none
  - Delete location: far right of each row

### Structured/grid editors
- `levels`:
  - Plain labels: `Level N` column + header labels
  - Inline editable text: level title input
  - Inline selectable dropdowns: permission group select (`staff/manager/...`)
  - Delete location: far right of each row
- `locations`:
  - Plain labels: header row (`OFFICE`, `OFFICE LEAD`)
  - Inline editable text: office name input
  - Inline selectable dropdowns: office lead select
  - Delete location: far right of each row
- `messaging_rules`:
  - Plain labels: event + recipient text
  - Inline editable text: none
  - Inline selectable dropdowns: none
  - Inline controls: toggle switches for inbox/email
  - Delete location: none
- `delegations`:
  - Plain labels: section labels (`Delegate`, `Capabilities`, `Delegated members`)
  - Inline editable text: delegate search input
  - Inline selectable dropdowns: none (uses picker options + toggles)
  - Delete location: none explicit; removal by saving empty capabilities for selected delegate
- `permissions`:
  - Plain labels: capability names and role headers
  - Inline editable text: none
  - Inline selectable dropdowns: none
  - Inline controls: toggle matrix cells
  - Delete location: none

### Hierarchical editor
- `corporate_functions`:
  - Plain labels: section title/subtitle
  - Inline editable text: group name input, category name input
  - Inline selectable dropdowns: none
  - Delete location: group delete at group row right; category delete at category row right

### Read-only/info/tool views
- `rates`:
  - Plain labels: identity/metadata fields in card rows
  - Inline editable text/select: not in row; editing launched via `Edit` action
  - Delete location: remove icon in action area
- `bulk_upload`:
  - Plain labels/instructions only
  - Editability is workflow actions (buttons/file inputs), not inline row editing

## 3) One Consistent UI Ruleset Per Interaction Type

### A) Simple list editor
- Row structure: `[editable text field] [delete icon]`
- Field appearance: standard input surface (1px light border, subtle control background, consistent height/radius/padding)
- Delete style: inline red trash icon only
- Header/actions: title + add on left, save on right
- Dividers/spacing: light row separators, consistent vertical gap between rows

### B) Structured/grid editor
- Row structure: `[plain label (if present)] [field group] [delete or control area]`
- Field appearance: same surface tokens for text/select across tabs
- Select appearance: same chevron, same right padding and arrow inset
- Delete style: same inline red trash icon where delete exists
- Header/actions: same as A
- Dividers/spacing: stronger header boundary than row separators; row rhythm consistent

### C) Hierarchical editor
- Row structure: group row with editable group name + delete; nested child rows with editable child field + delete
- Field appearance: same as A/B
- Hierarchy cues: indentation and grouping container only (no heavy cards)
- Delete style: same icon system at both levels
- Header/actions: same as A/B
- Dividers/spacing: spacing-first hierarchy, minimal borders

### D) Read-only/info/tool view
- Row structure: informational cards/rows + actions
- Field appearance: label/value text, not fake inputs unless directly editable
- Delete style: same inline icon for destructive action
- Header/actions: same left/right action model
- Dividers/spacing: keep lightweight, avoid over-boxing

## 4) Top 3 Shared Settings Patterns

1. **Standard section header**
- Left: title (+ optional add button)
- Right: primary save/action button
- Consistent spacing and bottom divider

2. **Editable row with trailing delete**
- Main editable region on left
- Delete icon fixed at right edge
- Single row rhythm and divider model

3. **Scoped interactive matrix/list panels**
- Delegations and Permissions both use dense control rows (toggles/options)
- Require strong label hierarchy + consistent control sizing

## 5) Recommended Implementation Order (Safest)

1. **Lock a single style authority for Settings**
- Use one owner for Settings layout/row/field styles (currently runtime `#settings-layout-style` in `settingsAdmin.js`)
- Remove/avoid duplicate competing overrides in `styles.css` for same selectors

2. **Normalize field surfaces for list + structured editors first**
- Apply shared field tokens only to true editable controls in:
  - `levels`, `departments`, `categories`, `locations`, `corporate_functions`
- Keep labels/header rows untouched

3. **Normalize select chevron once**
- One select-arrow rule scoped to Settings editable selects
- Explicit opt-outs only for components that intentionally do not use chevrons

4. **Then align hierarchy + spacing**
- Corporate Functions nested spacing/indent
- Row divider hierarchy (header stronger, row lighter)

5. **Finally tune read-only/tool tabs**
- `rates`, `bulk_upload`, `delegations`, `permissions`, `messaging_rules` only for consistency polish, not layout shifts

## 6) Risks To Avoid

- Competing rules between `settingsAdmin.js` injected CSS and `styles.css` for the same selectors
- Blanket selectors that affect non-settings controls (`select`, `input`) globally
- Styling header/label rows as editable fields
- Mixing delete paradigms (icon + text + boxed buttons)
- Making hierarchical tabs card-heavy via per-row boxed containers
- Mobile-specific overrides accidentally overriding desktop editability cues
