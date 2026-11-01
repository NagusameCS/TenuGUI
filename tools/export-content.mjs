import { createDefaultState } from "../assets/js/content.js";
import { writeFileSync } from "node:fs";

const state = createDefaultState();
const now = Date.now();
state.updatedAt = now;
state.publishedAt = now;

writeFileSync("content.json", JSON.stringify(state, null, 2) + "\n", "utf8");
console.log("✓ content.json");
