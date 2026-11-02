// Registry of shipped identity assets. Uploaded replacements live in state.assets.
export const ASSET_GROUPS = [
  { id: "identity", label: "Identity" },
  { id: "artwork", label: "Social" },
  { id: "icons", label: "Icon library" },
];

export const ASSET_LIBRARY = [
  {
    id: "logo",
    group: "identity",
    name: "Compact identity mark",
    description: "A square seal containing 手. Used for the header, footer, favicon and editor bar.",
    files: {
      dark: "assets/img/brand/mark-dark-512.png",
      light: "assets/img/brand/mark-ink-512.png",
      tile: "assets/img/brand/mark-favicon-512.png?v=32",
    },
    preview: "assets/img/brand/mark-favicon-512.png?v=32",
    type: "PNG · SVG source",
    dims: "512 × 512",
    alt: "TenuGUI compact mark: a square containing the kanji 手",
    replaceable: "logo",
    targets: ["header.brandMark", "footer.brandMark", "favicon"],
    usage: ["Header brand mark", "Footer brand mark", "Browser favicon"],
  },
  {
    id: "wordmark",
    group: "identity",
    name: "Wordmark",
    description: "TenuGUI set in Dela Gothic One. Ink and paper variants for mixed backgrounds.",
    files: {
      dark: "assets/img/brand/wordmark-paper.png",
      light: "assets/img/brand/wordmark-ink.png",
    },
    preview: "assets/img/brand/wordmark-paper.png",
    type: "PNG · SVG source",
    dims: "1200 × 350",
    alt: "TenuGUI wordmark",
    replaceable: false,
    usage: ["Header wordmark", "Identity board"],
  },
  {
    id: "lockup",
    group: "identity",
    name: "Horizontal lockup",
    description: "The mark and wordmark together, sized for navigation bars and document headers.",
    files: {
      dark: "assets/img/brand/lockup-dark.png",
      light: "assets/img/brand/lockup-light.png",
    },
    preview: "assets/img/brand/lockup-dark.png",
    type: "PNG · SVG source",
    dims: "1200 × 315",
    alt: "TenuGUI mark and wordmark lockup",
    replaceable: false,
    usage: ["Press kit", "Repository README"],
  },
  {
    id: "favicon",
    group: "identity",
    name: "Favicon set",
    description: "16, 24, 32, 48, 64, 180, 192 and 512px, plus a multi-size ICO.",
    files: {
      dark: "assets/img/brand/favicon-32.png?v=32",
      light: "assets/img/brand/favicon-32.png?v=32",
    },
    preview: "assets/img/brand/favicon-512.png?v=32",
    type: "PNG · ICO",
    dims: "512 × 512",
    alt: "TenuGUI favicon",
    replaceable: false,
    usage: ["Browser tab", "Home screen"],
  },
  {
    id: "social",
    group: "artwork",
    name: "Social preview",
    description: "1200 × 630 open-graph template with the mark and headline.",
    files: {
      dark: "assets/img/social/og-dark.png",
      light: "assets/img/social/og-light.png",
    },
    preview: "assets/img/social/og-dark.png",
    type: "PNG",
    dims: "1200 × 630",
    alt: "TenuGUI social preview with the headline Edit what you see",
    replaceable: false,
    usage: ["Open Graph meta", "Social cards"],
  },
  {
    id: "icons",
    group: "icons",
    name: "Icon library",
    description: "One stroke weight, 24px grid, round joins. Shared by the site and the editor chrome.",
    files: {
      dark: "assets/icons/tenugui-icons.svg",
      light: "assets/icons/tenugui-icons.svg",
    },
    preview: "assets/icons/icons-preview.svg",
    type: "SVG sprite",
    dims: "24 × 24 grid",
    alt: "TenuGUI icon library",
    replaceable: false,
    usage: ["Site interface", "Editor chrome"],
  },
];

export function getAsset(id) {
  return ASSET_LIBRARY.find((a) => a.id === id) || null;
}

export function assetPreview(asset, mode = "dark") {
  return asset.files?.[mode] || asset.preview;
}

export const REPLACE_TARGETS = {
  logo: ["header.brandMark", "footer.brandMark", "favicon"],
};

export const UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;
