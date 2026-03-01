import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = process.cwd();
const buildDir = path.join(root, "build");
const svgPath = path.join(buildDir, "icon-source.svg");
const pngPath = path.join(buildDir, "icon.png");
const icoPath = path.join(buildDir, "icon.ico");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#9333EA"/>
    </linearGradient>
    <linearGradient id="star" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E9D5FF"/>
    </linearGradient>
  </defs>
  <rect x="96" y="96" width="832" height="832" rx="236" fill="url(#bg)"/>
  <path fill="url(#star)" d="M512 282l54 132 142 54-142 54-54 142-54-142-142-54 142-54 54-132z"/>
</svg>
`;

async function run() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(svgPath, svg, "utf8");

  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(pngPath);

  const icoBuffer = await pngToIco([
    await sharp(pngPath).resize(256, 256).png().toBuffer(),
    await sharp(pngPath).resize(128, 128).png().toBuffer(),
    await sharp(pngPath).resize(64, 64).png().toBuffer(),
    await sharp(pngPath).resize(48, 48).png().toBuffer(),
    await sharp(pngPath).resize(32, 32).png().toBuffer(),
    await sharp(pngPath).resize(16, 16).png().toBuffer(),
  ]);

  await fs.writeFile(icoPath, icoBuffer);
  console.log("Icones gerados:", { pngPath, icoPath });
}

run().catch((err) => {
  console.error("Falha ao gerar icones:", err);
  process.exit(1);
});
