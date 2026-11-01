# Visual identity and direct-editing system

This document covers the site’s visual identity, its asset system and the built-in editor. It describes how things look and behave. Page layouts and implementation details are out of scope.

The guiding idea is directness. The identity stays restrained, and the owner changes content and appearance on the page itself rather than in a separate form.

## 1. Product definition

The site has two distinct experiences:

- Visitor mode: the published site, without editing controls or accidental editing interactions.
- Editor mode: an authenticated workspace where the owner can select elements, rewrite text, change colours, replace assets, adjust styling, and publish changes.

Editing happens on the finished site rather than in an administration form.

### Core principles

1. Content remains the focus.
2. Controls appear when relevant rather than staying permanently visible.
3. Local changes and site-wide changes are clearly distinguished.
4. Every destructive or broad change is reversible.
5. Draft work never changes the public site until published.
6. Reusable styles maintain consistency without preventing intentional exceptions.

## 2. Visual identity

### Creative direction

Dark, minimal and precise, with a small orbital motif.

The identity is built from:

- Near-black surfaces.
- Off-white typography.
- Restrained lavender accents.
- Fine outlines.
- Generous negative space.
- Small technical labels.
- Simple geometric artwork.
- Brief, functional motion.

It should read as one person’s considered work. Avoid the look of a corporate dashboard, a gaming peripheral or a generic AI product.

### Visual exclusions

The identity should not depend on:

- Glass effects across every surface.
- Large decorative gradients behind all content.
- Constantly moving backgrounds.
- Heavy shadows.
- Emoji as the main icon system.
- Multiple competing illustration styles.
- Decorative elements that interfere with reading.

## 3. Colour system

### Default theme

| Token | Value | Intended role |
|---|---|---|
| Canvas | `#0B0B0F` | Primary background |
| Surface | `#15151C` | Raised content surfaces |
| Elevated surface | `#1D1D27` | Menus, floating tools, dialogs |
| Primary text | `#F2F2F5` | Main readable content |
| Secondary text | `#A6A6B3` | Supporting content |
| Decorative border | `#2B2B36` | Nonessential separators |
| Accent | `#B5A0FF` | Identity and selected emphasis |
| Accent hover | `#C8B8FF` | Interactive accent variation |
| Positive | `#86D6A0` | Successful operations |
| Warning | `#E8C477` | Caution and unresolved issues |
| Destructive | `#EE8E98` | Destructive actions and errors |

These are proposed design values. Final combinations require contrast testing, including editing outlines, focus indicators, and disabled states.

### Colour behaviour

Colours are managed as named tokens rather than disconnected values.

An editable element can use:

- A theme token.
- A custom local colour.
- An inherited colour from its parent or component.

The interface must identify which of these is active.

Changing a theme token updates its linked uses. Changing a local colour affects only the selected element unless the user explicitly expands the scope.

### Theme variants

The system supports:

- The default dark theme.
- An optional light theme.
- Saved custom themes.
- Previewing a theme before applying it.
- Restoring the original theme.

A theme covers colours, typography, borders, corner radii and optional background treatments. An accent colour on its own is not a theme.

## 4. Typography

### Type direction

- Primary family: a clean sans-serif.
- Secondary family: monospace for technical labels, metadata, and code.
- Display treatment: the primary family at larger sizes, rather than a separate decorative font.

### Editable typography properties

- Font family.
- Size.
- Weight.
- Line height.
- Letter spacing.
- Alignment.
- Text colour.
- Underline and other supported emphasis.
- Maximum text width.
- Named text style.

### Named styles

The initial style library includes:

- Display.
- Heading 1.
- Heading 2.
- Heading 3.
- Body.
- Small body.
- Caption.
- Label.
- Technical metadata.
- Code.

Semantic heading level and visual styling remain separate. Making text look larger must not silently change its document meaning.

## 5. Asset system

### Required assets

| Asset | Specification |
|---|---|
| Primary identity mark | A simple symbol, monogram, or avatar treatment |
| Compact identity mark | Simplified version for small displays |
| Favicon | Recognisable at small sizes |
| Wordmark | Site name with consistent typography |
| Signature artwork | Orbital or diagrammatic composition |
| Thumbnail template | Repeatable visual treatment for content items |
| Social preview template | Identity, title, and optional supporting image |
| Icon library | Consistent stroke, proportions, and visual weight |
| Placeholder artwork | Neutral treatment for missing or unpublished media |
| Error/empty-state artwork | Small variations of the identity motif |

### Asset variants

Where applicable, assets include:

- Dark-background version.
- Light-background version.
- Monochrome version.
- Transparent-background version.
- Static version of animated artwork.

### Asset library behaviour

Each asset has:

- Name.
- Preview.
- File type and dimensions.
- Alternative text where relevant.
- Optional attribution.
- Usage locations.
- Replacement history.

Replacing an asset offers two explicit choices:

- Replace this instance.
- Replace every linked instance.

Deleting a referenced asset must show where it is used before proceeding.

## 6. Graphic language and motion

### Signature motif

The orbital motif consists of a central element and a small number of related points, paths, or symbols.

It can appear in:

- Identity artwork.
- Thumbnail compositions.
- Loading indicators.
- Empty states.
- Small decorative marks.

It should not become mandatory decoration on every surface.

### Motion rules

- Hover feedback is brief and subtle.
- Selection feedback is immediate.
- Panels enter and leave without dramatic movement.
- Background animation remains low-priority.
- Content does not move simply because the cursor passes nearby.
- A reduced-motion experience replaces nonessential animation with static states.

Proposed timing tokens:

| Token | Duration | Use |
|---|---:|---|
| Immediate | 0–80 ms | Selection feedback |
| Fast | 120 ms | Hover and button states |
| Standard | 180 ms | Menus and toolbars |
| Deliberate | 240 ms | Larger panel transitions |

## 7. Editor access and workspace

### Entering editor mode

Editing requires authentication and appropriate permission.

Visitor interactions must never trigger editing. Double-clicking text on the public site retains normal browser behaviour.

Editor mode provides:

- A persistent but compact editor indicator.
- Draft status.
- Undo and redo.
- Preview.
- Publish.
- Exit editing.

### Workspace states

| State | Meaning |
|---|---|
| Published | Public version is current |
| Draft changed | Local changes exist |
| Saving | Draft persistence is in progress |
| Saved | Draft is stored |
| Save failed | Changes are not confirmed saved |
| Publishing | A publication is in progress |
| Published successfully | The selected revision is live |
| Conflict | Another edit requires resolution |

“Saved” and “Published” must never be used interchangeably.

## 8. Selection model

### Pointer interactions

| Interaction | Behaviour |
|---|---|
| Hover | Show a subtle outline and element label |
| Single click | Select an editable element |
| Double-click text | Enter inline text editing |
| Double-click image | Open image replacement and crop controls |
| Double-click icon | Open icon selection |
| Double-click surface | Open its appearance controls |
| Right-click | Open a contextual action menu |
| Click empty space | Clear selection, unless a pending interaction requires resolution |

A visible Edit action provides an alternative to double-clicking.

### Selection indicators

The selected element shows:

- An outline.
- A short element label.
- A contextual toolbar.
- Optional resize handles where resizing is supported.
- An indicator when styling is inherited or shared.

Selection overlays are editor-only and never appear in published output.

### Nested elements

The editor includes a selection breadcrumb, such as:

`Section → Card → Title`

Users can move to a parent or child without repeatedly clicking through overlapping elements.

Locked and decorative elements are excluded from normal selection unless explicitly exposed.

## 9. Inline text editing

### Basic behaviour

Double-clicking an editable text element places the cursor inside it.

The user can:

- Rewrite the entire element.
- Select and replace individual words.
- Add supported formatting.
- Add or edit links.
- Paste text.
- Undo and redo text changes.

Existing text remains in place until replaced.

### Keyboard behaviour

- Enter inserts a paragraph in multiline text.
- Shift + Enter inserts a line break.
- Enter commits single-line fields.
- Escape exits text editing.
- Tab moves between editor controls when not actively entering text.

Leaving the element commits the edit to the draft. Undo remains available.

### Formatting toolbar

The toolbar offers controls appropriate to the selected text:

- Bold.
- Italic.
- Underline.
- Link.
- Text colour.
- Named text style.
- Alignment.
- Clear formatting.

Unsupported formatting is not offered.

### Pasted content

By default, pasted text adopts the destination style while preserving supported structure and links.

“Paste as plain text” removes formatting.

## 10. Rewrite functionality

Manual rewriting is part of the core editor. Assisted rewriting is an optional extension.

### Assisted actions

For selected text or a complete text element:

- Shorten.
- Expand.
- Clarify.
- Correct spelling and grammar.
- Make more formal.
- Make more conversational.
- Rewrite using a custom instruction.

### Review behaviour

A suggested rewrite appears as a proposal, never an automatic replacement.

The user can:

- Compare original and proposed text.
- Accept.
- Edit the proposal.
- Regenerate.
- Dismiss.

Changes to names, numbers, links, or factual statements should be highlighted for review. The system must not imply that rewritten claims have been fact-checked.

Only the approved replacement enters the draft.

## 11. Appearance editing

### Contextual controls

Selecting an element exposes only relevant properties.

| Element | Available controls |
|---|---|
| Text | Typography, colour, alignment, text style |
| Button | Label, destination, colours, border, radius, padding |
| Image | Replace, crop, focal point, fit, alt text, radius |
| Icon | Symbol, size, colour, stroke where supported |
| Surface | Fill, border, radius, spacing |
| Group | Alignment, spacing, visibility, shared style |

### Colour picker

The colour editor includes:

- Theme swatches.
- Recent colours.
- Custom colour selection.
- Hex and RGB entry.
- Opacity where supported.
- Reset to inherited value.
- Contrast feedback for applicable text/background pairs.

A colour change previews immediately in the draft.

### Change scope

Before a shared style changes, the editor identifies the scope:

- This element.
- This reusable component.
- Every use of this named style.
- Entire theme.

Broad changes require an explicit choice. The editor must not silently turn a local adjustment into a site-wide update.

## 12. Reusable styles and components

### Shared styles

Repeated visual treatments can be saved as named styles.

A style records applicable properties such as:

- Colours.
- Typography.
- Borders.
- Radius.
- Spacing.

Elements can inherit a style and retain intentional local overrides.

### Reusable components

Repeated elements can share a component definition.

Editing a linked component offers:

- Change content in this instance.
- Update the shared component.
- Detach this instance.

Before updating a shared component, the user sees how many instances are affected and can preview representative uses.

### Reset behaviour

Reset controls distinguish:

- Reset one property.
- Remove local overrides.
- Restore the shared style.
- Restore the original default.

These actions must not be presented as a single ambiguous “Reset” button.

## 13. Additional element actions

The contextual menu supports, where appropriate:

- Edit content.
- Edit appearance.
- Duplicate.
- Hide.
- Lock.
- Replace asset.
- Edit destination.
- Copy style.
- Paste style.
- Reset overrides.
- Delete.

Structural actions are available only for elements designed to support them. The editor is not required to behave like an unrestricted page builder.

### Links and buttons

Link controls include:

- Internal destination.
- External URL.
- Email destination.
- Same-tab or new-tab behaviour.
- Accessible label where needed.

In editor mode, the first click selects a link rather than navigating away. A separate Open link action allows testing.

### Visibility

Visibility settings distinguish:

- Published visibility.
- Temporary editor-only hiding.
- Device-specific visibility, where supported.

Hidden content remains discoverable through the element navigator.

## 14. Images and media

### Image editing

The editor supports:

- Upload or library selection.
- Replacement.
- Crop.
- Aspect-ratio selection.
- Focal-point positioning.
- Fit or fill.
- Alternative text.
- Decorative-image designation.
- Optional caption and attribution.

Replacing an image preserves its surrounding styling unless the user chooses otherwise.

### Upload feedback

Before accepting an upload, the editor reports:

- Unsupported file types.
- Files exceeding configured limits.
- Failed uploads.
- Missing required metadata.

A failed replacement must leave the previous asset intact.

## 15. Responsive editing

The editor provides desktop, tablet, and mobile previews, plus a custom viewport width.

### Inheritance model

- Base styles apply across sizes.
- Smaller-screen overrides are explicit.
- Content edits remain shared unless a separate content variant is deliberately enabled.

Every responsive property identifies whether it is inherited or overridden.

Changing a mobile font size must not unexpectedly alter desktop styling.

A breakpoint reset removes that override rather than creating another hardcoded value.

## 16. History and recovery

### Undo and redo

The history covers:

- Text changes.
- Style changes.
- Asset replacement.
- Visibility changes.
- Duplication.
- Deletion.
- Shared-style changes.

Continuous interactions, such as dragging a colour control, should form one meaningful history action rather than hundreds of steps.

### Revision history

Saved revisions record:

- Time.
- Editor identity.
- Revision label, if supplied.
- Publication status.
- Change summary.

Users can preview a previous revision and restore it as a new draft.

Restoring an old revision does not erase later history.

### Recovery

If saving fails:

- Unsaved status remains visible.
- The draft remains editable where possible.
- Retry is available.
- Exiting prompts the user when work may be lost.

The system must not display success before persistence is confirmed.

## 17. Preview and publication

### Preview

Preview temporarily removes editing overlays and presents the draft as a visitor would experience it.

Users can inspect:

- Viewport sizes.
- Hover and focus states.
- Links.
- Expanded or interactive content.
- Motion settings.

Returning to editing preserves the current selection where possible.

### Publish flow

Before publication, show:

- A summary of changes.
- Affected shared styles or components.
- Outstanding validation issues.
- The revision being published.

Publishing makes a specific saved revision public.

A publication failure leaves the previous public version unchanged.

Rollback restores a selected published revision through an explicit action.

## 18. Accessibility and permissions

### Editor accessibility

Core editing actions must be available without double-clicking or precise pointer movement.

Requirements include:

- Keyboard selection and navigation.
- Visible focus states.
- Labelled controls.
- Screen-reader-readable save and error statuses.
- Non-colour indicators for warnings and selection.
- Reduced-motion support.
- A touch-friendly alternative to hover interactions.

### Permissions

| Role | Capabilities |
|---|---|
| Owner | All editing, publishing, permission, and configuration actions |
| Editor | Content and styling changes within granted scope |
| Reviewer | Preview and review without direct publication |
| Visitor | Published experience only |

Editing permissions must be enforced beyond merely hiding the controls.

Untrusted pasted content, links, and uploaded assets require validation before they can enter published output.

## 19. Error and conflict handling

| Situation | Required behaviour |
|---|---|
| Draft save fails | Preserve work, show failure, allow retry |
| Upload fails | Keep the previous asset |
| Invalid value entered | Explain the issue without silently discarding input |
| Shared style changes | Show affected scope before confirmation |
| Concurrent edit detected | Show conflicting versions and resolution options |
| Element deleted accidentally | Offer immediate undo |
| Publication fails | Keep the previous live revision |
| Permission expires | Stop protected actions and preserve recoverable work |
| Content overflows | Flag the issue and identify affected preview sizes |

Concurrent changes must not silently overwrite another editor’s work.

## 20. Acceptance criteria

The core experience is complete when:

1. Visitors cannot activate editing controls.
2. An authorised user can enter editor mode and identify draft status.
3. Double-clicking text enables inline rewriting.
4. The same editing action is available through keyboard-accessible controls.
5. Text changes survive a confirmed save and reload.
6. Colours can be changed locally without altering unrelated elements.
7. Site-wide token changes identify their scope before application.
8. Images can be replaced without losing surrounding styles.
9. Undo restores text, styling, assets, and deleted editable elements.
10. Responsive overrides are visible and independently resettable.
11. Preview removes editor overlays without losing draft work.
12. Publishing affects only the selected saved revision.
13. Failed publishing leaves the live site unchanged.
14. Previous published revisions can be restored.
15. Editing controls and selection outlines never appear in public output.

## 21. Scope boundary

### Core release

- Visual identity and asset library.
- Authenticated editor mode.
- Element selection.
- Inline text rewriting.
- Colour and typography editing.
- Image replacement and cropping.
- Link editing.
- Named styles and theme tokens.
- Responsive previews.
- Undo and redo.
- Draft saving.
- Preview and publication.
- Revision restoration.

### Extensions

- Assisted rewriting.
- Multi-user review.
- Advanced shared-component management.
- Custom theme presets.
- Bulk asset replacement.
- Expanded animation controls.
- Approval workflows.

### Explicitly outside the core scope

- Arbitrary code execution through editing controls.
- Unrestricted drag-and-drop reconstruction of every page.
- Automatic publication of generated text.
- Silent site-wide changes.
- Live collaboration without conflict handling.
- A full illustration, photo-editing, or vector-drawing application.
