"use strict";

const { gravatarUrlForEmail } = require("../utils/userUtils");
const { systemUserName } = require("../utils/systemIdentity");

function createConfigController(config, gitService) {
  async function getConfig(_request, response) {
    const gitUserName = await gitService.gitUserName(config.workspaceDir);
    const gitUserEmail = await gitService.gitUserEmail(config.workspaceDir);
    response.json({
      boardFile: config.boardFileName,
      storagePath: config.boardDirName,
      workspacePath: config.workspaceDir,
      hasGitRepo: await gitService.hasGitRepository(config.workspaceDir),
      gitRemote: await gitService.gitRemoteOrigin(config.workspaceDir),
      gitUserName: gitUserName || await systemUserName(),
      gitUserEmail,
      gravatarUrl: gravatarUrlForEmail(gitUserEmail)
    });
  }

  return {
    getConfig
  };
}

module.exports = {
  createConfigController
};
