#!/usr/bin/env node
"use strict";

const { version: PACKAGE_VERSION } = require("./package.json");
const http = require("node:http");
const { createConfig } = require("./config");
const { createApp } = require("./app");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("KanbanQube");
  console.log("");
  console.log("Usage:");
  console.log("  kanbanqube [vault-directory]");
  console.log("");
  console.log("Environment:");
  console.log("  PORT=3888  HTTP port to listen on");
  process.exit(0);
}

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(PACKAGE_VERSION);
  process.exit(0);
}

async function main() {
  const config = createConfig({ appDir: __dirname, workspaceArgument: process.argv[2] });
  const { app, services } = createApp(config);

  await services.boardService.ensureBoardStorage();
  http.createServer(app).listen(config.port, () => {
    console.log(`KanbanQube running on http://localhost:${config.port} (workspace: ${config.workspaceDir})`);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
