#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { version: PACKAGE_VERSION } = require("./package.json");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("KanbanQube Desktop");
  console.log("");
  console.log("Usage:");
  console.log("  kanbanqube-desktop [vault-directory]");
  console.log("  Default vault: ~/.kanbanqube");
  process.exit(0);
}

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(PACKAGE_VERSION);
  process.exit(0);
}

normalizeTemporaryDirectoryEnvironment();

const electronPath = require("electron");

if (typeof electronPath !== "string") {
  console.error("Could not resolve Electron executable.");
  process.exit(1);
}

const child = childProcess.spawn(electronPath, [
  path.resolve(__dirname),
  ...process.argv.slice(2)
], {
  stdio: "inherit",
  env: process.env
});

child.on("error", (error) => {
  console.error(error.message || error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function normalizeTemporaryDirectoryEnvironment() {
  const tempDirectory = usableTempDirectory();
  for (const variableName of ["TMPDIR", "TMP", "TEMP"]) {
    process.env[variableName] = tempDirectory;
  }
}

function usableTempDirectory() {
  const candidates = [
    { directory: defaultTemporaryDirectory(), create: false },
    { directory: path.join(os.homedir(), ".kanbanqube", "tmp"), create: true }
  ].filter((candidate) => candidate.directory);

  for (const candidate of candidates) {
    const tempDirectory = path.resolve(candidate.directory);
    try {
      if (candidate.create) {
        fs.mkdirSync(tempDirectory, { recursive: true });
      }
      fs.accessSync(tempDirectory, fs.constants.R_OK | fs.constants.W_OK);
      return tempDirectory;
    } catch {
      // Try the next candidate.
    }
  }

  return os.tmpdir();
}

function defaultTemporaryDirectory() {
  if (process.platform === "win32") return os.tmpdir();
  return "/tmp";
}
