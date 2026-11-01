# TenuGUI · 手拭い

A browser editor for any page. Add it to your bookmarks bar, click it on any page, edit in place, and export the changed HTML.

## Use it

1. Open [nagusamecs.github.io/TenuGUI](https://nagusamecs.github.io/TenuGUI/).
2. Go to **Use it** and open the **browser editor**.
3. Drag **TenuGUI · edit this page** to your bookmarks bar.
4. Open any page, click the bookmark, edit, then use **Export HTML**.

No download, extension, account or server. The bookmarklet contains the editor.

## Run locally for development

```bash
git clone https://github.com/NagusameCS/TenuGUI.git
cd TenuGUI
python3 tools/serve.py
# open http://localhost:4174/
```

The local server is only for developing the site itself; the published browser editor does not use it.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) publishes the repository root on every push to `main`.
4. Optional: update the Open Graph URLs in `index.html` if you want absolute social images.

Asset paths are relative, so the site works at `https://user.github.io/repo/` without configuration. `content.json` is fetched relative to the page as well.

## What is on the page

### Visitor mode
What the public sees. There are no selection outlines, inspector panels or editing controls. The theme toggle switches between the dark **Ink** palette and the light **Paper** palette.

### Try it
**Try it on this page** opens the full editor. You can:

- Hover to identify, click to select, double-click to edit text.
- Use the breadcrumb and outline to reach nested elements.
- Edit typography, colours, links, icons, images, spacing, borders and radii.
- Replace and frame images, set focal points, alt text and aspect ratios.
- Browse the asset library, replace one instance or every linked use.
- Edit dark and light theme variants, named text styles, radii, type families and background treatment.
- Edit responsive overrides at desktop, tablet and mobile widths.
- Insert headings, text, images, buttons and dividers into any section.
- Select whole sections from the breadcrumb, then delete them like any other element.
- Drag any selected element to offset it; use **Reset position** in the toolbar or context menu to clear the offset.
- Delete any element. Deletion is written to the draft and exported `content.json`; undo remains available.
- Undo and redo, with silent autosave to this browser.
- Generate a new accessible light/dark palette from the Theme panel.
- Export `content.json` from the toolbar, then commit it to the repository to update the source for everyone.

The editor saves to this browser only. Selection is drawn with CSS on the element itself, so it stays attached while you scroll. While editing, links and buttons select on pointer-down instead of activating.

When a local draft exists, opening the editor asks **Continue draft** or **Start over**. Starting over discards the local draft and opens the published page unchanged. Closing the editor always returns the page to its published state; the draft is kept until you start over or clear site data.

## Export model

The editor runs entirely in the browser. The toolbar **Export** button downloads the complete current state as `content.json`: content, theme, text overrides, styles, node state, insertions and embedded assets.

Commit that file to the repository root and GitHub Pages loads it at boot. The local MCP server reads and writes the same file, using the same stable node IDs, text overrides and node state.

## Editing model

The page is rendered from a single content state:

```text
state = {
  meta, theme, content,
  text:      { nodeId: sanitized HTML },
  styles:    { nodeId: { style, base, tablet, mobile } },
  nodeState: { nodeId: { hidden, deleted, locked, link, icon, image, offset } },
  insertions: [ { section, kind, text, src, alt } ],
  dynamics:  [ { id, section, description, position, size, html } ],
  assets:    { instances, uploads, history }
}
```

- Editable nodes are marked with `data-node-id`, `data-node-kind` and `data-node-label`.
- Dynamic elements are model-filled boxes. Each one exports its `section`, `description`, `position: {x,y}`, `size: {width,height}` and optional `html`. Empty boxes are editor-only and stay hidden for visitors.
- Text edits live in `state.text`; local visual edits in `state.styles`; structural state in the content arrays.
- Responsive rules are generated as container queries for `.site` at 900px and 640px.
- Drafts and revisions are stored in IndexedDB (`tenugui-studio`). Theme presets and preferences use `localStorage`.
- `content.json` in the repository is the default source; the app fetches it with `cache: "no-store"` and merges it over the bundled defaults.
- Undo/redo stores full state snapshots; the history is capped, and large image payloads shorten the cap further.

### Keyboard shortcuts

| Action | Keys |
|---|---|
| Start / stop editing | `T` |
| Insert element | **Insert** toolbar button |
| Select next element | `Tab` |
| Edit text / label | `F2` or double-click |
| Finish editing | `Escape` or **Done** |
| Bold / italic / underline | `Ctrl/Cmd + B` · `I` · `U` |
| Insert link while editing | `Ctrl/Cmd + K` |
| Paste as plain text | `Shift + V` while editing |
| Undo / redo | `Ctrl/Cmd + Z` · `Ctrl/Cmd + Shift + Z` |
| Save draft | `Ctrl/Cmd + S` |
| Export content.json | **Export** toolbar button |
| Delete selected element | `Delete` |
| Toggle inspector | `I` |
| Shortcut help | `?` |

Touch: tap to select, use the selection toolbar for **Edit text** / **Appearance**, long-press for the context menu, and use the bottom-sheet inspector.

## Project structure

```text
index.html                    landing page shell
bookmarklet.html              full direct editor for any page (bookmarklet)
content.json                  published content source
site.webmanifest              PWA metadata
404.html                      themed not-found page
LICENSE                       MIT license
assets/
  css/tokens.css              fonts, tokens, primitives
  css/site.css                published layout and components
  css/editor.css              selection, toolbar, inspector, dialogs
  js/app.js                   boot, visitor interactions, theme/motion
  js/store.js                 state, IndexedDB, autosave, insertions, conflict
  js/render.js                site rendering, added blocks, theme CSS
  js/editor.js                editor shell, selection, inline editing, insert/export
  js/anywhere.js              standalone direct editor injected by the browser button
  js/inspector.js             element/theme/assets panels
  js/theme-generator.js       accessible palette generation
  js/assets-registry.js       shipped asset metadata
  js/content.js               defaults; imported by the browser and Node
  js/icons.js                 inline icon library
  js/ui.js                    toasts and dialogs
  js/utils.js                 sanitising, diffing, colour maths, storage helpers
  img/textures/               asanoha, seigaiha, kagome, uroko, shippo, kikko, chidori and tatewaku
  fonts/                      self-hosted subset webfonts + OFL licences
  img/brand/                  marks, wordmarks, signatures, identity boards
  img/social/                 Open Graph images
  img/thumbs/                 thumbnail templates
  img/states/                 placeholder, empty and error artwork
  icons/                      icon sprite and preview sheet
tools/
  build-fonts.sh              subset Dela/Inter/IBM Plex Mono to woff2
  build-assets.py             generate every PNG brand asset from SVG/font outlines
  export-icons.mjs            build the icon sprite + preview sheet
  export-content.mjs          regenerate content.json from defaults
  mcp-server.mjs              local MCP server over content.json
  serve.py                    no-store local dev server
```

### Regenerating assets

```bash
python3 -m pip install fonttools brotli pillow
./tools/build-fonts.sh
python3 tools/build-assets.py
node tools/export-icons.mjs
node tools/export-content.mjs
npm run build
```

`npm run build` regenerates the file-mode fonts, the embedded browser-editor source, and the classic `assets/js/app.bundle.js` used by a double-clicked `index.html`. The bundle step uses `npx esbuild`; the generated files are committed so end users do not need Node.

`build-assets.py` uses ImageMagick (`magick`) to rasterise the generated SVGs. The Dela Gothic One outlines are converted to SVG paths, so the PNG assets do not depend on system fonts.

## Identity assets

The site ships with:

- Compact identity mark (used for the header, footer, editor bar and favicon)
- Wordmark and horizontal lockup
- Favicon set (16/24/32/48/64/180/192/512 + ICO)
- Open Graph template, light and dark
- A 24px icon library sprite with a preview sheet
- SVG sources for the marks, wordmark, lockup and social preview

The asset library in the editor exposes names, previews, formats, dimensions, alt text, usage locations, replacement history and scope choices (this instance vs. every linked use).

## Dynamic elements

Choose **Insert → Dynamic** in the editor. Give the slot a description and a pixel box (`x`, `y`, `width`, `height`) measured from the selected section's top-left. It exports as:

```json
{
  "id": "dyn-...",
  "section": "features",
  "description": "A small annotated diagram showing the editor selecting a headline",
  "position": { "x": 60, "y": 140 },
  "size": { "width": 300, "height": 120 },
  "html": ""
}
```

An MCP client can fill `html` with sanitised markup; the box remains fixed at that position and size. Empty dynamic slots are visible only while editing and are hidden from visitors.

## Browser editor

`bookmarklet.html` provides a draggable browser button and needs no server. It embeds the generated `assets/js/anywhere-source.js` inside the bookmarklet, so the editor is fully self-contained and works offline. No backend, extension or hosting is involved.

Once launched, the editor lets you select elements, edit text inline, change typography, colours, spacing and links, replace images, drag elements, duplicate, hide or delete them, undo/redo, and export the edited HTML. It uses the page's own CSS and assets and does not inject TenuGUI textures or state. Sites with a restrictive content security policy may block bookmarklets.

## Local MCP server

The repository includes `tools/mcp-server.mjs`, a stdio MCP server with no npm dependencies. It reads and writes `content.json` directly; run it from the repository root or pass a different file:

```bash
node tools/mcp-server.mjs
node tools/mcp-server.mjs --content path/to/content.json
```

Example client configuration:

```json
{
  "mcpServers": {
    "tenugui": {
      "command": "node",
      "args": ["/absolute/path/to/TenuGUI/tools/mcp-server.mjs"]
    }
  }
}
```

Tools: `inspect_page`, `set_style`, `replace_asset`, `fill_dynamic`, `export_content`. After a tool writes the file, reload the page to fetch the updated state.

## Fonts and licences

- **Dela Gothic One** — SIL Open Font License. Subset to Latin, punctuation and 手拭い to keep the file small.
- **Inter** — SIL Open Font License.
- **IBM Plex Mono** — SIL Open Font License.

Licence texts are in `assets/fonts/`. The fonts are self-hosted. The site makes no external requests at runtime and has no analytics or tracking.

## Textures

- `assets/img/textures/seigaiha.svg` — public domain, Wikimedia Commons.
- `assets/img/textures/asanoha.svg` — CC BY-SA 4.0, Fred the Oyster, Wikimedia Commons.
- `assets/img/textures/kagome.svg` — public domain, Wikimedia Commons.
- `assets/img/textures/uroko.svg` — CC0, Fred the Oyster, Wikimedia Commons.
- `assets/img/textures/shippo.svg` — original vector interpretation, CC0.
- `assets/img/textures/kikko.svg` — original vector interpretation, CC0.
- `assets/img/textures/chidori.svg` — original vector interpretation, CC0.
- `assets/img/textures/tatewaku.svg` — original vector interpretation, CC0.

The page background defaults to **Uroko** and is drawn once behind the whole page from the local SVG in `assets/img/textures/`; it is not repeated on cards or headers. See `assets/img/textures/ATTRIBUTION.md` for sources.

## Known limitations

- **Export is explicit.** The editor autosaves to this browser, but the source only changes when you commit the exported `content.json`.
- **Uploads are limited** to PNG, JPEG and WebP, 2.5 MB each, and are embedded in the draft and in `content.json` as data URLs. SVG uploads are rejected rather than sanitised.
- **Drafts and revisions live in IndexedDB.** Clearing site data removes them.
- **The Dela subset** covers Latin, punctuation and 手拭い. Other Japanese glyphs fall back to the system font.
- **Not built:** multi-user approval, bulk asset replacement and shared-component management, which the specification lists as extensions, and arbitrary page building, which it rules out.

## Licence

MIT; see `LICENSE`.

## Specification

The full identity and direct-editing specification is in [`designSpecs.md`](./designSpecs.md). Its colour table is the original proposal; the shipped Ink and Paper palettes are the ones in `content.json`.
