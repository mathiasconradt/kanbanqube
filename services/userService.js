"use strict";

const { createGitService } = require("./gitService");
const { gravatarUrlForEmail, initialsForUser, userIdForIdentity } = require("../utils/userUtils");
const { nonEmptyString } = require("../utils/stringUtils");
const { systemUserName } = require("../utils/systemIdentity");

function createUserService(config) {
  const gitService = createGitService(config);

  return {
    listUsers: () => listUsers(config, gitService)
  };
}

async function listUsers(config, gitService) {
  const usersByKey = new Map();
  await addCurrentGitUser(config, gitService, usersByKey);
  await addCommitAuthors(config, gitService, usersByKey);
  return [...usersByKey.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function addCurrentGitUser(config, gitService, usersByKey) {
  const [name, email] = await Promise.all([
    gitService.gitUserName(config.workspaceDir),
    gitService.gitUserEmail(config.workspaceDir)
  ]);
  addUser(usersByKey, name || await systemUserName(), email, true);
}

async function addCommitAuthors(config, gitService, usersByKey) {
  if (!(await gitService.hasGitRepository(config.workspaceDir))) return;
  const result = await gitService.runGit(config.workspaceDir, ["log", "--format=%aN%x00%aE%x00%ct"]);
  if (result.code !== 0 || !result.stdout.trim()) return;

  for (const line of result.stdout.split("\n")) {
    const [name, email, timestamp] = line.split("\0");
    addUser(usersByKey, name, email, false, Number(timestamp) || 0);
  }
}

function addUser(usersByKey, nameValue, emailValue, isCurrentUser = false, lastCommitTime = 0) {
  const name = nonEmptyString(nameValue);
  const email = nonEmptyString(emailValue).toLowerCase();
  if (!name && !email) return;

  const key = email || `name:${name.toLowerCase()}`;
  const existing = usersByKey.get(key);
  const next = {
    id: userIdForIdentity(name, email),
    name: name || email,
    email,
    initials: initialsForUser(name, email),
    avatarUrl: gravatarUrlForEmail(email),
    isCurrentUser: Boolean(existing?.isCurrentUser || isCurrentUser),
    lastCommitTime: Math.max(existing?.lastCommitTime || 0, lastCommitTime)
  };
  usersByKey.set(key, next);
}

module.exports = {
  createUserService,
  listUsers
};
