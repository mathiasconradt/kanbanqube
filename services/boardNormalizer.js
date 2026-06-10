"use strict";

const { collectDates, newestTimestamp } = require("../utils/dateUtils");
const { createHexId } = require("../utils/idUtils");
const { normalizePos } = require("../utils/positionUtils");
const { initialsFor, nonEmptyString, slugify, stringOrDefault } = require("../utils/stringUtils");

function createBoardNormalizer(options = {}) {
  const boardFileName = options.boardFileName || "board.json";

  return {
    normalizeBoard: (candidate) => normalizeBoard(candidate, boardFileName),
    defaultBoardSkeleton
  };
}

function normalizeBoard(candidate, boardFileName = "board.json") {
  const seededDefaults = defaultBoardSkeleton();
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const board = { ...seededDefaults, ...source };
  const boardId = nonEmptyString(board.id) || seededDefaults.id;
  const baseShortLink = nonEmptyString(source.shortLink) || boardId.slice(-8);
  const now = newestTimestamp([source.dateLastActivity]);

  const lists = normalizeLists(source.lists, boardId);
  const labels = normalizeLabels(source.labels, boardId);
  const members = normalizeMembers(source.members);
  const checklists = normalizeChecklists(source.checklists, boardId);
  const cards = normalizeCards(source.cards, boardId, lists, checklists);
  const actions = normalizeActions(source.actions, boardId, cards, lists, members);
  const badgeMap = buildBadgeMap(cards, checklists, actions);

  const normalizedCards = cards
    .map((card, index) => ({
      ...card,
      idShort: Number.isFinite(card.idShort) ? card.idShort : index + 1,
      badges: badgeMap.get(card.id)
    }))
    .sort((left, right) => left.pos - right.pos);
  lists.sort((left, right) => left.pos - right.pos);

  return {
    ...board,
    id: boardId,
    nodeId: nonEmptyString(source.nodeId) || `kanbanqube:board:${boardId}`,
    name: nonEmptyString(board.name) || "KanbanQube Board",
    desc: stringOrDefault(board.desc, ""),
    descData: board.descData ?? null,
    closed: Boolean(board.closed),
    creationMethod: board.creationMethod ?? null,
    creationMethodError: board.creationMethodError ?? null,
    creationMethodLoadingStartedAt: board.creationMethodLoadingStartedAt ?? null,
    creationMethodLoadingPhase: board.creationMethodLoadingPhase ?? null,
    dateClosed: board.dateClosed ?? null,
    dateLastActivity: source.dateLastActivity || now,
    dateLastView: source.dateLastView || now,
    datePluginDisable: source.datePluginDisable ?? null,
    enterpriseOwned: Boolean(source.enterpriseOwned),
    idBoardSource: source.idBoardSource ?? null,
    idEnterprise: source.idEnterprise ?? null,
    idMemberCreator: source.idMemberCreator ?? (members[0]?.id || null),
    idOrganization: source.idOrganization ?? null,
    idTags: Array.isArray(source.idTags) ? source.idTags : [],
    ixUpdate: Number.isFinite(source.ixUpdate) ? source.ixUpdate : Date.now(),
    labelNames: source.labelNames ?? buildLabelNames(labels),
    labels,
    limits: source.limits ?? {},
    lists,
    members,
    memberships: Array.isArray(source.memberships) ? source.memberships : [],
    cards: normalizedCards,
    actions,
    checklists,
    customFields: Array.isArray(source.customFields) ? source.customFields : [],
    pinned: Boolean(source.pinned),
    pluginData: Array.isArray(source.pluginData) ? source.pluginData : [],
    powerUps: Array.isArray(source.powerUps) ? source.powerUps : [],
    prefs: normalizePrefs(source.prefs),
    premiumFeatures: Array.isArray(source.premiumFeatures) ? source.premiumFeatures : [],
    shortLink: baseShortLink,
    shortUrl: nonEmptyString(source.shortUrl) || `https://kanbanqube.local/b/${baseShortLink}`,
    starred: Boolean(source.starred),
    subscribed: Boolean(source.subscribed),
    templateGallery: source.templateGallery ?? null,
    type: source.type ?? "board",
    url: nonEmptyString(source.url) || `https://kanbanqube.local/b/${baseShortLink}`,
    kanbanQubeMeta: {
      ...(source.kanbanQubeMeta && typeof source.kanbanQubeMeta === "object" ? source.kanbanQubeMeta : {}),
      version: 1,
      savedAt: source.kanbanQubeMeta?.savedAt || source.dateLastActivity || now,
      boardFile: boardFileName
    }
  };
}

function normalizeLists(candidateLists, boardId) {
  const defaults = defaultBoardSkeleton().lists;
  const source = Array.isArray(candidateLists) && candidateLists.length > 0 ? candidateLists : defaults;
  return source.map((list, index) => ({
    ...list,
    id: nonEmptyString(list.id) || createHexId(),
    name: nonEmptyString(list.name) || `Lane ${index + 1}`,
    closed: Boolean(list.closed),
    color: list.color ?? null,
    idBoard: nonEmptyString(list.idBoard) || boardId,
    pos: normalizePos(list.pos, index)
  }));
}

function normalizeCards(candidateCards, boardId, lists, checklists) {
  const listIds = new Set(lists.map((list) => list.id));
  const checklistIds = new Set(checklists.map((checklist) => checklist.id));
  return (Array.isArray(candidateCards) ? candidateCards : []).map((card, index) => {
    const cardId = nonEmptyString(card.id) || createHexId();
    const targetListId = listIds.has(card.idList) ? card.idList : lists[0]?.id || null;
    const shortLink = nonEmptyString(card.shortLink) || cardId.slice(-8);
    const attachments = Array.isArray(card.attachments) ? card.attachments : [];
    return {
      ...card,
      id: cardId,
      idBoard: nonEmptyString(card.idBoard) || boardId,
      idList: targetListId,
      name: stringOrDefault(card.name, ""),
      desc: stringOrDefault(card.desc, ""),
      closed: Boolean(card.closed),
      pos: normalizePos(card.pos, index),
      idLabels: Array.isArray(card.idLabels) ? card.idLabels.filter(Boolean) : [],
      idMembers: Array.isArray(card.idMembers) ? card.idMembers.filter(Boolean) : [],
      idChecklists: Array.isArray(card.idChecklists)
        ? card.idChecklists.filter((checklistId) => checklistIds.has(checklistId))
        : [],
      attachments,
      cover: normalizeCover(card.cover),
      due: card.due ?? null,
      dueComplete: Boolean(card.dueComplete),
      start: card.start ?? null,
      subscribed: Boolean(card.subscribed),
      shortLink,
      shortUrl: nonEmptyString(card.shortUrl) || `https://kanbanqube.local/c/${shortLink}`,
      url: nonEmptyString(card.url) || `https://kanbanqube.local/c/${shortLink}`,
      dateLastActivity: newestTimestamp([
        card.dateLastActivity,
        ...collectDates(card.actions)
      ]),
      labels: Array.isArray(card.labels) ? card.labels : []
    };
  });
}

function normalizeChecklists(candidateChecklists, boardId) {
  return (Array.isArray(candidateChecklists) ? candidateChecklists : []).map((checklist, checklistIndex) => ({
    ...checklist,
    id: nonEmptyString(checklist.id) || createHexId(),
    idBoard: nonEmptyString(checklist.idBoard) || boardId,
    idCard: nonEmptyString(checklist.idCard) || null,
    name: nonEmptyString(checklist.name) || `Checklist ${checklistIndex + 1}`,
    checkItems: (Array.isArray(checklist.checkItems) ? checklist.checkItems : []).map((item, itemIndex) => ({
      ...item,
      id: nonEmptyString(item.id) || createHexId(),
      name: nonEmptyString(item.name) || `Item ${itemIndex + 1}`,
      pos: normalizePos(item.pos, itemIndex),
      state: item.state === "complete" ? "complete" : "incomplete",
      due: item.due ?? null,
      dueReminder: Number.isFinite(item.dueReminder) ? item.dueReminder : -1,
      idMember: item.idMember ?? null,
      idChecklist: nonEmptyString(item.idChecklist) || nonEmptyString(checklist.id) || null,
      nameData: item.nameData ?? { emoji: {} }
    }))
  }));
}

function normalizeLabels(candidateLabels, boardId) {
  return (Array.isArray(candidateLabels) ? candidateLabels : []).map((label) => ({
    ...label,
    id: nonEmptyString(label.id) || createHexId(),
    idBoard: nonEmptyString(label.idBoard) || boardId,
    name: stringOrDefault(label.name, ""),
    color: nonEmptyString(label.color) || "blue",
    uses: Number.isFinite(label.uses) ? label.uses : 0
  }));
}

function normalizeMembers(candidateMembers) {
  return (Array.isArray(candidateMembers) ? candidateMembers : []).map((member) => ({
    ...member,
    id: nonEmptyString(member.id) || createHexId(),
    fullName: nonEmptyString(member.fullName) || nonEmptyString(member.username) || "Unknown User",
    username: nonEmptyString(member.username) || slugify(nonEmptyString(member.fullName) || "user"),
    initials: nonEmptyString(member.initials) || initialsFor(member.fullName || member.username || "U"),
    nonPublic: member.nonPublic ?? {
      fullName: nonEmptyString(member.fullName) || nonEmptyString(member.username) || "Unknown User",
      initials: nonEmptyString(member.initials) || initialsFor(member.fullName || member.username || "U")
    }
  }));
}

function normalizeActions(candidateActions, boardId, cards, lists, members) {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const listMap = new Map(lists.map((list) => [list.id, list]));
  const memberMap = new Map(members.map((member) => [member.id, member]));

  return (Array.isArray(candidateActions) ? candidateActions : []).map((action) => {
    const cardId = action?.data?.idCard || action?.data?.card?.id || null;
    const listId = action?.data?.list?.id || action?.data?.listAfter?.id || action?.data?.listBefore?.id || null;
    return {
      ...action,
      id: nonEmptyString(action.id) || createHexId(),
      idMemberCreator: action.idMemberCreator ?? action.memberCreator?.id ?? null,
      type: nonEmptyString(action.type) || "updateCard",
      date: newestTimestamp([action.date]),
      data: normalizeActionData(action.data, boardId, cardId ? cardMap.get(cardId) : null, listId ? listMap.get(listId) : null),
      memberCreator: action.memberCreator?.id && memberMap.has(action.memberCreator.id)
        ? memberMap.get(action.memberCreator.id)
        : action.memberCreator ?? null
    };
  }).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

function defaultBoardSkeleton() {
  const boardId = createHexId();
  const names = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
  const lists = names.map((name, index) => ({
    id: createHexId(),
    idBoard: boardId,
    name,
    closed: false,
    pos: (index + 1) * 16384
  }));

  return {
    id: boardId,
    nodeId: `kanbanqube:board:${boardId}`,
    name: "KanbanQube Board",
    desc: "",
    descData: null,
    closed: false,
    creationMethod: null,
    creationMethodError: null,
    creationMethodLoadingStartedAt: null,
    creationMethodLoadingPhase: null,
    dateClosed: null,
    dateLastActivity: new Date().toISOString(),
    enterpriseOwned: false,
    idBoardSource: null,
    idEnterprise: null,
    idMemberCreator: null,
    idOrganization: null,
    idTags: [],
    ixUpdate: Date.now(),
    labelNames: {},
    labels: [],
    limits: {},
    lists,
    members: [],
    memberships: [],
    cards: [],
    actions: [],
    checklists: [],
    customFields: [],
    pinned: false,
    pluginData: [],
    powerUps: [],
    prefs: normalizePrefs({}),
    premiumFeatures: [],
    shortLink: boardId.slice(-8),
    shortUrl: `https://kanbanqube.local/b/${boardId.slice(-8)}`,
    starred: false,
    subscribed: false,
    templateGallery: null,
    type: "board",
    url: `https://kanbanqube.local/b/${boardId.slice(-8)}`
  };
}

function normalizeActionData(data, boardId, card, list) {
  const source = data && typeof data === "object" ? data : {};
  return {
    ...source,
    board: source.board ?? { id: boardId },
    card: source.card ?? (card ? {
      id: card.id,
      name: card.name,
      idShort: card.idShort ?? null,
      shortLink: card.shortLink
    } : undefined),
    list: source.list ?? (list ? {
      id: list.id,
      name: list.name
    } : undefined)
  };
}

function normalizeCover(cover) {
  return {
    idAttachment: cover?.idAttachment ?? null,
    color: cover?.color ?? null,
    idUploadedBackground: cover?.idUploadedBackground ?? null,
    size: cover?.size ?? "normal",
    brightness: cover?.brightness ?? "dark",
    yPosition: Number.isFinite(cover?.yPosition) ? cover.yPosition : 0.5,
    idPlugin: cover?.idPlugin ?? null
  };
}

function normalizePrefs(prefs) {
  return {
    background: prefs?.background ?? "blue",
    backgroundColor: prefs?.backgroundColor ?? "#123c84",
    backgroundDarkColor: prefs?.backgroundDarkColor ?? "#0a214a",
    backgroundTopColor: prefs?.backgroundTopColor ?? "#174a98",
    backgroundBottomColor: prefs?.backgroundBottomColor ?? "#0a214a",
    canBePublic: prefs?.canBePublic ?? true,
    canBeEnterprise: prefs?.canBeEnterprise ?? true,
    canBeOrg: prefs?.canBeOrg ?? true,
    canInvite: prefs?.canInvite ?? true,
    cardAging: prefs?.cardAging ?? "regular",
    comments: prefs?.comments ?? "members",
    hideVotes: Boolean(prefs?.hideVotes),
    invitations: prefs?.invitations ?? "members",
    permissionLevel: prefs?.permissionLevel ?? "private",
    selfJoin: Boolean(prefs?.selfJoin),
    voting: prefs?.voting ?? "disabled"
  };
}

function buildBadgeMap(cards, checklists, actions) {
  const checklistsByCard = new Map();
  for (const checklist of checklists) {
    if (!checklist.idCard) continue;
    const current = checklistsByCard.get(checklist.idCard) || [];
    current.push(checklist);
    checklistsByCard.set(checklist.idCard, current);
  }

  const commentsByCard = new Map();
  for (const action of actions) {
    const cardId = action?.data?.idCard || action?.data?.card?.id;
    if (!cardId) continue;
    if (action.type === "commentCard") {
      commentsByCard.set(cardId, (commentsByCard.get(cardId) || 0) + 1);
    }
  }

  const badgeMap = new Map();
  for (const card of cards) {
    const cardChecklists = checklistsByCard.get(card.id) || [];
    const checklistItems = cardChecklists.flatMap((checklist) => checklist.checkItems);
    const checkedItems = checklistItems.filter((item) => item.state === "complete");

    badgeMap.set(card.id, {
      attachments: Array.isArray(card.attachments) ? card.attachments.length : 0,
      attachmentsByType: {
        trello: {
          board: 0,
          card: Array.isArray(card.attachments) ? card.attachments.length : 0
        }
      },
      checkItems: checklistItems.length,
      checkItemsChecked: checkedItems.length,
      checkItemsEarliestDue: null,
      comments: commentsByCard.get(card.id) || 0,
      description: Boolean(card.desc?.trim()),
      due: card.due ?? null,
      dueComplete: Boolean(card.dueComplete),
      externalSource: null,
      fogbugz: "",
      lastUpdatedByAi: false,
      location: false,
      maliciousAttachments: 0,
      start: card.start ?? null,
      subscribed: Boolean(card.subscribed),
      viewingMemberVoted: false,
      votes: 0
    });
  }
  return badgeMap;
}

function buildLabelNames(labels) {
  const labelNames = {
    green: "",
    yellow: "",
    orange: "",
    red: "",
    purple: "",
    blue: "",
    sky: "",
    lime: "",
    pink: "",
    black: "",
    green_dark: "",
    yellow_dark: "",
    orange_dark: "",
    red_dark: "",
    purple_dark: "",
    blue_dark: "",
    sky_dark: "",
    lime_dark: "",
    pink_dark: "",
    black_dark: ""
  };

  for (const label of labels) {
    if (label.color in labelNames && label.name && !labelNames[label.color]) {
      labelNames[label.color] = label.name;
    }
  }

  return labelNames;
}

module.exports = {
  createBoardNormalizer,
  normalizeBoard,
  normalizePrefs,
  defaultBoardSkeleton
};
