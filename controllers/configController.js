"use strict";

const crypto = require("node:crypto");

function createConfigController(config, gitService) {
  async function getConfig(_request, response) {
    const gitUserEmail = await gitService.gitUserEmail(config.workspaceDir);
    response.json({
      boardFile: config.boardFileName,
      storagePath: config.boardDirName,
      workspacePath: config.workspaceDir,
      hasGitRepo: await gitService.hasGitRepository(config.workspaceDir),
      gitRemote: await gitService.gitRemoteOrigin(config.workspaceDir),
      gitUserName: await gitService.gitUserName(config.workspaceDir),
      gitUserEmail,
      gravatarUrl: gravatarUrlForEmail(gitUserEmail)
    });
  }

  return {
    getConfig
  };
}

function gravatarUrlForEmail(email) {
  if (typeof email !== "string" || !email.trim()) return "";
  const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=64&d=404`;
}

module.exports = {
  createConfigController,
  gravatarUrlForEmail
};
