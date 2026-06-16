"use strict";

const fs = require("node:fs");
const path = require("node:path");

const appName = "KanbanQube";
const repoRoot = path.resolve(__dirname, "..");
const bundleDirs = fs.readdirSync(repoRoot)
  .filter((name) => name.startsWith(`${appName}-darwin-`))
  .map((name) => path.join(repoRoot, name, `${appName}.app`, "Contents"));

for (const contentsDir of bundleDirs) {
  const resourcesDir = path.join(contentsDir, "Resources");
  const sourceIcon = path.join(resourcesDir, "electron.icns");
  const targetIcon = path.join(resourcesDir, "kanbanqube.icns");
  const plistPath = path.join(contentsDir, "Info.plist");

  if (!fs.existsSync(sourceIcon) || !fs.existsSync(plistPath)) continue;

  fs.copyFileSync(sourceIcon, targetIcon);
  fs.writeFileSync(plistPath, updateIconPlist(fs.readFileSync(plistPath, "utf8")));
}

function updateIconPlist(plist) {
  const withIconFile = plist.replace(
    /(<key>CFBundleIconFile<\/key>\s*<string>)[^<]+(<\/string>)/,
    "$1kanbanqube.icns$2"
  );

  if (withIconFile.includes("<key>CFBundleIconName</key>")) {
    return withIconFile.replace(
      /(<key>CFBundleIconName<\/key>\s*<string>)[^<]+(<\/string>)/,
      "$1KanbanQube$2"
    );
  }

  return withIconFile.replace(
    /(<key>CFBundleIconFile<\/key>\s*<string>kanbanqube\.icns<\/string>)/,
    "$1\n  <key>CFBundleIconName</key>\n  <string>KanbanQube</string>"
  );
}
