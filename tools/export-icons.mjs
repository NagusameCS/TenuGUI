import { ICONS, ICON_NAMES } from "../assets/js/icons.js";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("assets/icons", { recursive: true });
const names = ICON_NAMES.filter((n) => ICONS[n]);
const symbol = (name) =>
  `<symbol id="i-${name}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g></symbol>`;

const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${names.map(symbol).join("\n")}
</svg>
`;
writeFileSync("assets/icons/tenugui-icons.svg", sprite, "utf8");

const cols = 8;
const cell = 84;
const rows = Math.ceil(names.length / cols);
const width = cols * cell;
const height = rows * cell + 96;
const tiles = names
  .slice(0, 40)
  .map((name, i) => {
    const x = (i % cols) * cell + cell / 2;
    const y = Math.floor(i / cols) * cell + cell / 2 + 38;
    return `<g transform="translate(${x} ${y})" color="#F4F0E6">
      <rect x="-31" y="-31" width="62" height="62" rx="10" fill="#191816" stroke="#35322C"/>
      <use href="#i-${name}" x="-12" y="-12" width="24" height="24"/>
    </g>`;
  })
  .join("");
const preview = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${names.map(symbol).join("")}</defs>
  <rect width="${width}" height="${height}" fill="#11100E"/>
  <text x="20" y="34" fill="#B9B2A5" font-family="monospace" font-size="13" letter-spacing="2">TENUGUI / ICON LIBRARY — 24PX GRID</text>
  <text x="20" y="54" fill="#9C9588" font-family="monospace" font-size="10">ONE STROKE WEIGHT · ROUND JOINS · CURRENTCOLOR</text>
  ${tiles}
</svg>
`;
writeFileSync("assets/icons/icons-preview.svg", preview, "utf8");
console.log(`✓ ${names.length} icons · sprite + preview`);
