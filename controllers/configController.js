"use strict";

function createConfigController(config, gitService) {
  async function getConfig(_request, response) {
    response.json({
      boardFile: config.boardFileName,
      storagePath: config.boardDirName,
      workspacePath: config.workspaceDir,
      hasGitRepo: await gitService.hasGitRepository(config.workspaceDir),
      gitRemote: await gitService.gitRemoteOrigin(config.workspaceDir),
      gitUserName: await gitService.gitUserName(config.workspaceDir),
      gitUserEmail: await gitService.gitUserEmail(config.workspaceDir)
    });
  }

  return {
    getConfig
  };
}

module.exports = {
  createConfigController
};
