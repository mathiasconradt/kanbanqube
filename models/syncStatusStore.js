"use strict";

const syncStatus = {
  running: false,
  startedAt: "",
  finishedAt: "",
  ok: null,
  output: ""
};

function getSyncStatus() {
  return { ...syncStatus };
}

function updateSyncStatus(values) {
  Object.assign(syncStatus, values);
  return getSyncStatus();
}

module.exports = {
  getSyncStatus,
  updateSyncStatus
};
