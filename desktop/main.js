#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { app: electronApp, BrowserWindow, Menu, nativeImage, shell } = require("electron");
const { version: PACKAGE_VERSION } = require("./package.json");
const APP_NAME = "KanbanQube";
const GITHUB_URL = "https://github.com/mathiasconradt/kanbanqube";

let server;
let mainWindow;
let aboutWindow;

electronApp.name = APP_NAME;
electronApp.setName(APP_NAME);
electronApp.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: PACKAGE_VERSION,
  copyright: "Copyright © Mathias Conradt"
});

function buildApplicationMenu(appDir) {
  if (process.platform !== "darwin") return;

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: APP_NAME,
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => showAboutWindow(appDir)
        },
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
  const icon = nativeImage.createFromPath(resolveResourcePath(appDir, "kanbanqube_icon_large.png", "public/icon_flat.png"));
  return icon.isEmpty() ? null : icon;
}

function resolveResourcePath(appDir, resourceFileName, fallbackRelativePath) {
  const packagedResourcePath = path.resolve(__dirname, "resources", resourceFileName);
  if (fs.existsSync(packagedResourcePath)) return packagedResourcePath;
  return path.resolve(appDir, fallbackRelativePath);
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

function systemBrowserUrl(value) {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "kanbanqube-external:") return "";
    const targetUrl = parsedUrl.searchParams.get("url") || "";
    return safeExternalUrl(targetUrl);
  } catch {
    return "";
  }
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
    () => path.resolve(__dirname, ".."),
    () => path.dirname(require.resolve("kanbanqube/package.json"))
  ];

  for (const resolveRoot of moduleRoots) {
    let appDir;
    try {
      appDir = resolveRoot();
      if (!isKanbanQubeRoot(appDir)) {
        continue;
      }
      return {
        appDir,
        createApp: require(path.join(appDir, "app")).createApp,
        createConfig: require(path.join(appDir, "config")).createConfig
      };
    } catch (error) {
      if (appDir && isKanbanQubeRoot(appDir)) {
        throw error;
      }
    }
  }

  throw new Error("KanbanQube server package not found.");
}

function isKanbanQubeRoot(appDir) {
  try {
    const packagePath = path.join(appDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return packageJson.name === "kanbanqube";
  } catch {
    return false;
  }
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
    const externalUrl = systemBrowserUrl(targetUrl);
    if (externalUrl) {
      shell.openExternal(externalUrl).catch(() => {});
      return { action: "deny" };
    }
    if (!safeExternalUrl(targetUrl)) return { action: "deny" };
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

function showAboutWindow(appDir) {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }

  const aboutImageUrl = imageDataUrl(resolveResourcePath(appDir, "about.jpg", "public/about.jpg"));
  const aboutHtml = aboutDocument(aboutImageUrl);
  aboutWindow = new BrowserWindow({
    title: `About ${APP_NAME}`,
    width: 688,
    height: 384,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    parent: mainWindow || undefined,
    modal: false,
    backgroundColor: "#10141a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(aboutHtml)}`);
  aboutWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl === GITHUB_URL) {
      shell.openExternal(GITHUB_URL);
    }
    return { action: "deny" };
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
}

function imageDataUrl(filePath) {
  const image = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${image.toString("base64")}`;
}

function aboutDocument(imageUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>About ${APP_NAME}</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #10141a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .surface {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        padding: 0;
      }
      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .meta {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 18px 22px 20px;
        color: white;
        text-align: center;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.72));
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.65);
        pointer-events: auto;
      }
      .details {
        display: block;
        font-size: 12px;
        line-height: 1.35;
        opacity: 0.86;
      }
      .repo-link {
        display: inline-block;
        margin-top: 5px;
        color: white;
        font-size: 12px;
        line-height: 1.35;
        opacity: 0.9;
        text-decoration: underline;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="surface" role="button" aria-label="Close about dialog" id="aboutSurface">
      <img src="${imageUrl}" alt="" />
      <span class="meta">
        <span class="details">${APP_NAME} · Version ${PACKAGE_VERSION} · © Mathias Conradt · Apache 2.0 License</span>
        <a class="repo-link" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer" id="repoLink">${GITHUB_URL}</a>
      </span>
    </div>
    <script>
      document.getElementById("aboutSurface").addEventListener("click", () => window.close());
      document.getElementById("repoLink").addEventListener("click", (event) => {
        event.stopPropagation();
      });
    </script>
  </body>
</html>`;
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
    const { appDir, url } = await startEmbeddedServer();
    buildApplicationMenu(appDir);
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
