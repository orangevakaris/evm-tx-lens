import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// GitHub Pages serves docs alone, so keep its browser module in sync with the library.
await copyFile(new URL("src/index.js", `file://${root}`), new URL("docs/decoder.js", `file://${root}`));
