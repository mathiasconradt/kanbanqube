"use strict";

const path = require("node:path");
const os = require("node:os");
const { canonicalWorkspacePath, safePathInsideRoot } = require("../utils/pathUtils");

function resolveWorkspaceDirectory(argument) {
  const candidatePath = typeof argument === "string" && argument.trim()
    ? argument
    : path.join(os.homedir(), ".kanbanqube");
  return canonicalWorkspacePath(candidatePath, allowedWorkspaceRoots());
}

function allowedWorkspaceRoots() {
  const roots = [os.homedir(), process.cwd(), os.tmpdir()];
  if (process.platform !== "win32") roots.push("/tmp");
  if (process.platform === "darwin") roots.push("/private/tmp");
  return roots;
}

function createConfig(options = {}) {
  const appDir = options.appDir || path.resolve(__dirname, "..");
  const workspaceDir = resolveWorkspaceDirectory(options.workspaceArgument);
  const boardFileName = "board.json";
  const demoBoardFileName = "demo_board.json";
  const boardDirName = "board";
  const uploadsDirName = "uploads";

  return {
    appDir,
    workspaceDir,
    publicDir: path.join(appDir, "public"),
    boardFileName,
    boardFilePath: safePathInsideRoot(path.join(workspaceDir, boardFileName), workspaceDir),
    demoBoardFileName,
    demoBoardFilePath: safePathInsideRoot(path.join(appDir, demoBoardFileName), appDir),
    boardDirName,
    boardDir: safePathInsideRoot(path.join(workspaceDir, boardDirName), workspaceDir),
    boardMetaFilePath: safePathInsideRoot(path.join(workspaceDir, boardDirName, "meta.json"), workspaceDir),
    uploadsDirName,
    uploadsDir: safePathInsideRoot(path.join(workspaceDir, uploadsDirName), workspaceDir),
    sampleExportDir: safePathInsideRoot(path.join(workspaceDir, "trello_export"), workspaceDir),
    port: Number(options.port ?? process.env.PORT ?? 3888),
    gitExecutableCandidates: [
      "/usr/bin/git",
      "/bin/git",
      "/usr/local/bin/git",
      "/opt/homebrew/bin/git"
    ],
    sshExecutableCandidates: [
      "/usr/bin/ssh",
      "/bin/ssh",
      "/usr/local/bin/ssh",
      "/opt/homebrew/bin/ssh"
    ],
    gitSafePath: "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"
  };
}

module.exports = {
  allowedWorkspaceRoots,
  createConfig,
  resolveWorkspaceDirectory
};
