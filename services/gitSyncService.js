"use strict";

const { getSyncStatus, updateSyncStatus } = require("../models/syncStatusStore");
const { createGitService, formatGitCommandOutput } = require("./gitService");

function createGitSyncService(config) {
  const gitService = createGitService(config);

  async function syncBoardRepository() {
    updateSyncStatus({
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: "",
      ok: null,
      output: "Syncing with git..."
    });

    if (!(await gitService.hasGitRepository(config.workspaceDir))) {
      const result = {
        ok: false,
        output: `This folder does not contain a .git directory.\nWorkspace: ${config.workspaceDir}`,
        startedAt: getSyncStatus().startedAt,
        finishedAt: new Date().toISOString()
      };
      updateSyncStatus({ running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
      return result;
    }

    const remote = await gitService.gitRemoteOrigin(config.workspaceDir);
    const output = [];
    const updateOutput = () => {
      updateSyncStatus({ output: output.join("\n\n") || "Syncing with git..." });
    };
    const startCommand = (label) => {
      output.push(`${label}\n\nRunning...`);
      updateOutput();
      return output.length - 1;
    };
    const finishCommand = (index, text) => {
      output[index] = text;
      updateOutput();
    };

    await gitService.checkSshAuth(config.workspaceDir, remote, output);
    updateOutput();

    let commandIndex = startCommand("git status --porcelain");
    const status = await gitService.runGit(config.workspaceDir, ["status", "--porcelain"]);
    finishCommand(commandIndex, formatGitCommandOutput("git status --porcelain", status, status.stdout.trim() ? "" : "Repository is clean."));
    if (status.code !== 0) return finishFailure(output);

    if (status.stdout.trim()) {
      commandIndex = startCommand("git add --all");
      const add = await gitService.runGit(config.workspaceDir, ["add", "--all"]);
      finishCommand(commandIndex, formatGitCommandOutput("git add --all", add));
      if (add.code !== 0) return finishFailure(output);

      commandIndex = startCommand("git commit -m \"Update KanbanQube vault\"");
      const commit = await gitService.runGit(config.workspaceDir, ["commit", "-m", "Update KanbanQube vault"]);
      finishCommand(commandIndex, formatGitCommandOutput("git commit -m \"Update KanbanQube vault\"", commit));
      if (commit.code !== 0) return finishFailure(output);
    }

    commandIndex = startCommand("git pull --rebase");
    const pull = await gitService.runGit(config.workspaceDir, ["pull", "--rebase"]);
    finishCommand(commandIndex, formatGitCommandOutput("git pull --rebase", pull));
    if (pull.code !== 0) return finishFailure(output);

    commandIndex = startCommand("git push");
    const push = await gitService.runGit(config.workspaceDir, ["push"]);
    finishCommand(commandIndex, formatGitCommandOutput("git push", push));
    const result = {
      ok: push.code === 0,
      output: output.join("\n\n"),
      startedAt: getSyncStatus().startedAt,
      finishedAt: new Date().toISOString()
    };
    updateSyncStatus({ running: false, ok: result.ok, output: result.output, finishedAt: result.finishedAt });
    return result;
  }

  function finishFailure(output) {
    const result = {
      ok: false,
      output: output.join("\n\n"),
      startedAt: getSyncStatus().startedAt,
      finishedAt: new Date().toISOString()
    };
    updateSyncStatus({ running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
    return result;
  }

  return {
    syncBoardRepository,
    gitService
  };
}

module.exports = {
  createGitSyncService
};
