"use strict";

const path = require("node:path");

function resolveWorkspaceDirectory(argument) {
  if (typeof argument === "string" && argument.trim()) {
    return path.resolve(argument);
  }
  return process.cwd();
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
    boardFilePath: path.join(workspaceDir, boardFileName),
    demoBoardFileName,
    demoBoardFilePath: path.join(appDir, demoBoardFileName),
    boardDirName,
    boardDir: path.join(workspaceDir, boardDirName),
    boardMetaFilePath: path.join(workspaceDir, boardDirName, "meta.json"),
    uploadsDirName,
    uploadsDir: path.join(workspaceDir, uploadsDirName),
    sampleExportDir: path.join(workspaceDir, "trello_export"),
    port: Number(options.port || process.env.PORT || 3000),
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
  createConfig,
  resolveWorkspaceDirectory
};
