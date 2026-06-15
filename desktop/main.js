#!/usr/bin/env node
"use strict";

const http = require("node:http");
const path = require("node:path");
const { app: electronApp, BrowserWindow, Menu, nativeImage } = require("electron");
const { version: PACKAGE_VERSION } = require("./package.json");
const APP_NAME = "KanbanQube";

let server;
let mainWindow;

electronApp.name = APP_NAME;
electronApp.setName(APP_NAME);
electronApp.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: PACKAGE_VERSION,
  copyright: "Copyright © Mathias Conradt"
});

function buildApplicationMenu() {
  if (process.platform !== "darwin") return;

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: APP_NAME,
      submenu: [
        { role: "about", label: `About ${APP_NAME}` },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide", label: `Hide ${APP_NAME}` },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: `Quit ${APP_NAME}` }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" }
      ]
    }
  ]));
}

function loadAppIcon(appDir) {
  const icon = nativeImage.createFromPath(path.resolve(appDir, "public", "icon_flat.png"));
  return icon.isEmpty() ? null : icon;
}

function safeExternalUrl(value) {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.toString();
    }
  } catch {
    return "";
  }
  return "";
}

function printHelp() {
  console.log("KanbanQube Desktop");
  console.log("");
  console.log("Usage:");
  console.log("  kanbanqube-desktop [vault-directory]");
  console.log("  Default vault: ~/.kanbanqube");
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(PACKAGE_VERSION);
  process.exit(0);
}

function workspaceArgumentFromCli(argv) {
  const userArgs = argv.slice(2);
  return userArgs.find((argument) => argument && !argument.startsWith("-"));
}

function loadKanbanQube() {
  const moduleRoots = [
    () => path.dirname(require.resolve("kanbanqube/package.json")),
    () => path.resolve(__dirname, "..")
  ];

  for (const resolveRoot of moduleRoots) {
    let appDir;
    try {
      appDir = resolveRoot();
      return {
        appDir,
        createApp: require(path.join(appDir, "app")).createApp,
        createConfig: require(path.join(appDir, "config")).createConfig
      };
    } catch (error) {
      if (appDir === path.resolve(__dirname, "..")) {
        throw error;
      }
    }
  }

  throw new Error("KanbanQube server package not found.");
}

async function startEmbeddedServer() {
  const { appDir, createApp, createConfig } = loadKanbanQube();
  const config = createConfig({
    appDir,
    workspaceArgument: workspaceArgumentFromCli(process.argv),
    port: 0
  });
  const { app, services } = createApp(config);

  await services.boardService.ensureBoardStorage();

  return new Promise((resolve, reject) => {
    server = http.createServer(app);
    server.once("error", reject);
    server.listen(config.port, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        appDir,
        url: `http://127.0.0.1:${port}`
      });
    });
  });
}

function createMainWindow(url, appDir) {
  const appIcon = loadAppIcon(appDir);
  mainWindow = new BrowserWindow({
    title: "KanbanQube",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#1f2833",
    icon: appIcon || path.resolve(appDir, "public", "icon_flat.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === "darwin" && electronApp.dock && appIcon) {
    electronApp.dock.setIcon(appIcon);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    const externalUrl = safeExternalUrl(targetUrl);
    if (!externalUrl) return { action: "deny" };
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        title: APP_NAME,
        width: 1200,
        height: 800,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      }
    };
  });
  mainWindow.loadURL(url);
}

function stopEmbeddedServer() {
  if (server) {
    server.close();
    server = null;
  }
}

async function main() {
  try {
    await electronApp.whenReady();
    buildApplicationMenu();
    const { appDir, url } = await startEmbeddedServer();
    createMainWindow(url, appDir);

    electronApp.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow(url, appDir);
      }
    });
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

electronApp.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electronApp.quit();
  }
});

electronApp.on("before-quit", stopEmbeddedServer);

main(); // NOSONAR: CommonJS Electron entry point cannot use top-level await.
