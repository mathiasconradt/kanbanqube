"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoIconPath = path.resolve(__dirname, "..", "..", "public", "icon_flat.png");
const packageIconPath = path.resolve(__dirname, "..", "node_modules", "kanbanqube", "public", "icon_flat.png");
const sourceIconPath = fs.existsSync(repoIconPath) ? repoIconPath : packageIconPath;
const outputDir = path.resolve(__dirname, "..", "assets", "icons");
const outputPath = path.join(outputDir, "kanbanqube-icon.icns");
const sipsPath = "/usr/bin/sips";

if (!fs.existsSync(sourceIconPath)) {
  throw new Error("Could not find icon_flat.png.");
}

if (!fs.existsSync(sipsPath)) {
  throw new Error("Could not find /usr/bin/sips.");
}

fs.mkdirSync(outputDir, { recursive: true });

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kanbanqube-icon-"));
const resizedPngPath = path.join(tempDir, "icon_1024.png");

try {
  childProcess.execFileSync(sipsPath, [
    "-z",
    "1024",
    "1024",
    sourceIconPath,
    "--out",
    resizedPngPath
  ], { stdio: "ignore" });

  const png = fs.readFileSync(resizedPngPath);
  const entrySize = 8 + png.length;
  const totalSize = 8 + entrySize;
  const icon = Buffer.alloc(totalSize);

  icon.write("icns", 0, "ascii");
  icon.writeUInt32BE(totalSize, 4);
  icon.write("ic10", 8, "ascii");
  icon.writeUInt32BE(entrySize, 12);
  png.copy(icon, 16);

  fs.writeFileSync(outputPath, icon);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
