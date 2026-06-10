"use strict";

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");

function createGitService(config) {
  async function hasGitRepository(rootPath = config.workspaceDir) {
    try {
      const stat = await fs.stat(path.join(rootPath, ".git"));
      return stat.isDirectory() || stat.isFile();
    } catch {
      return false;
    }
  }

  async function gitRemoteOrigin(rootPath = config.workspaceDir) {
    const result = await runGit(rootPath, ["remote", "get-url", "origin"]);
    return result.code === 0 ? result.stdout.trim() : null;
  }

  async function gitUserName(rootPath = config.workspaceDir) {
    const hasRepo = await hasGitRepository(rootPath);
    if (hasRepo) {
      const localResult = await runGit(rootPath, ["config", "--local", "--get", "user.name"]);
      const localName = localResult.code === 0 ? localResult.stdout.trim() : "";
      if (localName) return localName;
    }

    const globalResult = await runGit(rootPath, ["config", "--global", "--get", "user.name"]);
    const globalName = globalResult.code === 0 ? globalResult.stdout.trim() : "";
    return globalName || null;
  }

  async function gitUserEmail(rootPath = config.workspaceDir) {
    const hasRepo = await hasGitRepository(rootPath);
    if (hasRepo) {
      const localResult = await runGit(rootPath, ["config", "--local", "--get", "user.email"]);
      const localEmail = localResult.code === 0 ? localResult.stdout.trim() : "";
      if (localEmail) return localEmail;
    }

    const globalResult = await runGit(rootPath, ["config", "--global", "--get", "user.email"]);
    const globalEmail = globalResult.code === 0 ? globalResult.stdout.trim() : "";
    return globalEmail || null;
  }

  async function checkSshAuth(rootPath, remoteUrl, output) {
    if (!remoteUrl || remoteUrl.startsWith("http://") || remoteUrl.startsWith("https://")) return;
    const hostMatch = remoteUrl.match(/[@/]([a-zA-Z0-9._-]+)[:/]/);
    if (!hostMatch) return;

    const host = hostMatch[1];
    const sshExecutable = await resolveSshExecutable();
    await new Promise((resolve) => {
      execFile(
        sshExecutable,
        ["-T", `git@${host}`, "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new"],
        { env: { SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "" } },
        (error, _stdout, stderr) => {
          const text = (stderr || "").toLowerCase();
          const authenticated = !error || text.includes("successfully authenticated") || text.includes("welcome to");
          if (!authenticated) {
            output.push(`Warning: SSH authentication to ${host} failed.\n${stderr.trim()}`.trim());
          }
          resolve();
        }
      );
    });
  }

  async function runGit(rootPath, args) {
    const gitExecutable = await resolveGitExecutable();
    return new Promise((resolve) => {
      const child = spawn(gitExecutable, args, {
        cwd: rootPath,
        env: {
          HOME: process.env.HOME || "",
          LANG: process.env.LANG || "en_US.UTF-8",
          LC_ALL: process.env.LC_ALL || "",
          SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "",
          GIT_TERMINAL_PROMPT: "0",
          PATH: config.gitSafePath
        }
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 120000);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        resolve({
          code: 1,
          signal: null,
          stdout,
          stderr,
          error: error.message
        });
      });
      child.on("close", (code, signal) => {
        clearTimeout(timeout);
        resolve({
          code: timedOut ? 1 : (code || 0),
          signal: timedOut ? "timeout" : signal,
          stdout,
          stderr,
          error: timedOut ? "Command timed out." : ""
        });
      });
    });
  }

  async function resolveGitExecutable() {
    for (const candidate of config.gitExecutableCandidates) {
      if (await isSafeExecutable(candidate)) return candidate;
    }
    throw new Error("Git executable was not found in a trusted system location.");
  }

  async function resolveSshExecutable() {
    for (const candidate of config.sshExecutableCandidates) {
      if (await isSafeExecutable(candidate)) return candidate;
    }
    throw new Error("SSH executable was not found in a trusted system location.");
  }

  async function isSafeExecutable(candidate) {
    try {
      const stat = await fs.stat(candidate);
      if (!stat.isFile()) return false;
      await fs.access(candidate, fsSync.constants.X_OK);
      const parent = await fs.stat(path.dirname(candidate));
      return (parent.mode & 0o002) === 0;
    } catch {
      return false;
    }
  }

  return {
    hasGitRepository,
    gitRemoteOrigin,
    gitUserName,
    gitUserEmail,
    checkSshAuth,
    runGit
  };
}

function formatGitCommandOutput(command, result, emptyOutput = "") {
  const status = result.code === 0 ? "OK" : `FAILED (${result.signal || result.code})`;
  const parts = [`$ ${command}`, status];
  if (result.stdout.trim()) parts.push("", result.stdout.trim());
  else if (emptyOutput) parts.push("", emptyOutput);
  if (result.stderr.trim()) parts.push("", result.stderr.trim());
  if (result.error && result.code !== 0 && !result.stderr.trim()) parts.push("", result.error);
  return parts.join("\n");
}

module.exports = {
  createGitService,
  formatGitCommandOutput
};
