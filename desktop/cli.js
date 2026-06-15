#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
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
