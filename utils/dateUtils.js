"use strict";

function collectDates(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => action?.date).filter(Boolean);
}

function newestTimestamp(values) {
  const dates = values
    .map((value) => {
      const timestamp = new Date(value || 0).getTime();
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    })
    .filter((value) => value !== null);

  return new Date((dates.length ? Math.max(...dates) : Date.now())).toISOString();
}

module.exports = {
  collectDates,
  newestTimestamp
};
