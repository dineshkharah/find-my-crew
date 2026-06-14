import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const svgPath = fileURLToPath(new URL("../public/icon.svg", import.meta.url));
const iconsDir = fileURLToPath(new URL("../public/icons/", import.meta.url));
mkdirSync(iconsDir, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "maskable-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const target of targets) {
  await sharp(svgPath)
    .resize(target.size, target.size)
    .png()
    .toFile(iconsDir + target.name);
  console.log(`wrote ${target.name}`);
}
