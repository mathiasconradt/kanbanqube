"use strict";

const USER_STORAGE_KEY = "kanbanqube.userName";
const USER_EMAIL_STORAGE_KEY = "kanbanqube.userEmail";
const SHOW_CARD_DESCRIPTIONS_STORAGE_KEY = "kanbanqube.showCardDescriptions";

const state = {
  board: null,
  config: null,
  currentUserName: localStorage.getItem(USER_STORAGE_KEY) || "",
  currentUserEmail: localStorage.getItem(USER_EMAIL_STORAGE_KEY) || "",
  showCardDescriptions: localStorage.getItem(SHOW_CARD_DESCRIPTIONS_STORAGE_KEY) === "true",
  searchTerm: "",
  labelSearchTerm: "",
  labelEditorOpen: false,
  descriptionEditing: false,
  selectedCardId: null,
  saveTimer: null,
  isSaving: false,
  saveMessage: "Loading board…",
  syncStatusMessage: "",
  lastSyncLog: "",
  isSyncing: false,
  drag: null
};

const boardScroller = document.getElementById("boardScroller");
const boardTitle = document.getElementById("boardTitle");
const boardFileBadge = document.getElementById("boardFileBadge");
const userBadge = document.getElementById("userBadge");
const searchInput = document.getElementById("searchInput");
const saveStatus = document.getElementById("saveStatus");
const syncButton = document.getElementById("syncButton");
const settingsButton = document.getElementById("settingsButton");
const syncLogDialog = document.getElementById("syncLogDialog");
const syncLogContent = document.getElementById("syncLogContent");
const closeSyncLogButton = document.getElementById("closeSyncLogButton");

const cardDialog = document.getElementById("cardDialog");
const cardTitleInput = document.getElementById("cardTitleInput");
const cardDescriptionDisplay = document.getElementById("cardDescriptionDisplay");
const cardDescriptionInput = document.getElementById("cardDescriptionInput");
const editDescriptionButton = document.getElementById("editDescriptionButton");
const checklistsContainer = document.getElementById("checklistsContainer");
const cardLabels = document.getElementById("cardLabels");
const labelEditorContainer = document.getElementById("labelEditorContainer");
const activityList = document.getElementById("activityList");
const addLabelButton = document.getElementById("addLabelButton");
const commentInput = document.getElementById("commentInput");
const addCommentButton = document.getElementById("addCommentButton");
const addChecklistButton = document.getElementById("addChecklistButton");
const deleteCardButton = document.getElementById("deleteCardButton");
const closeCardButton = document.getElementById("closeCardButton");

const settingsDialog = document.getElementById("settingsDialog");
const settingsUserName = document.getElementById("settingsUserName");
const settingsUserEmail = document.getElementById("settingsUserEmail");
const settingsBoardName = document.getElementById("settingsBoardName");
const settingsShowCardDescriptions = document.getElementById("settingsShowCardDescriptions");
const settingsBoardFile = document.getElementById("settingsBoardFile");
const settingsRemote = document.getElementById("settingsRemote");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const closeSettingsButton = document.getElementById("closeSettingsButton");

const promptDialog = document.getElementById("promptDialog");
const promptLabel = document.getElementById("promptLabel");
const promptTitle = document.getElementById("promptTitle");
const promptInputLabel = document.getElementById("promptInputLabel");
const promptInput = document.getElementById("promptInput");
const promptConfirmButton = document.getElementById("promptConfirmButton");
const promptCancelButton = document.getElementById("promptCancelButton");

const laneTemplate = document.getElementById("laneTemplate");
const cardTemplate = document.getElementById("cardTemplate");

const labelColorMap = {
  green: "#22c55e",
  yellow: "#f4b400",
  orange: "#fb923c",
  red: "#ef4444",
  purple: "#8b5cf6",
  blue: "#3b82f6",
  sky: "#38bdf8",
  lime: "#84cc16",
  pink: "#ec4899",
  black: "#1f2937",
  green_dark: "#15803d",
  yellow_dark: "#a16207",
  orange_dark: "#c2410c",
  red_dark: "#991b1b",
  purple_dark: "#5b21b6",
  blue_dark: "#1d4ed8",
  sky_dark: "#0369a1",
  lime_dark: "#4d7c0f",
  pink_dark: "#9d174d",
  black_dark: "#111827"
};

bootstrap().catch((error) => {
  setSaveMessage(error.message || "Could not load the board.");
});

async function bootstrap() {
  const [boardResponse, configResponse] = await Promise.all([
    fetch("/api/board"),
    fetch("/api/config")
  ]);

  if (!boardResponse.ok) {
    throw new Error("Could not load board data.");
  }

  state.board = await boardResponse.json();
  state.config = configResponse.ok ? await configResponse.json() : { boardFile: "board.json", gitRemote: null, gitUserName: null, gitUserEmail: null };
  hydrateIdentityFromGitConfig();
  boardFileBadge.textContent = state.config.boardFile || "board.json";
  settingsBoardFile.textContent = `Board file: ${state.config.boardFile || "board.json"}`;
  settingsRemote.textContent = state.config.gitRemote ? `Remote: ${state.config.gitRemote}` : "Remote: not configured";

  wireEvents();
  setSaveMessage("Ready");
  render();
}

function wireEvents() {
  searchInput.addEventListener("input", () => {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    renderBoard();
  });

  settingsButton.addEventListener("click", openSettingsDialog);
  closeSettingsButton.addEventListener("click", () => settingsDialog.close());
  saveSettingsButton.addEventListener("click", saveSettings);

  syncButton.addEventListener("click", syncBoard);
  saveStatus.addEventListener("click", openSyncLogDialog);
  closeSyncLogButton.addEventListener("click", () => syncLogDialog.close());
  boardScroller.addEventListener("dragover", handleLaneDragOver);
  boardScroller.addEventListener("drop", handleLaneDrop);

  closeCardButton.addEventListener("click", () => cardDialog.close());
  deleteCardButton.addEventListener("click", deleteSelectedCard);
  addLabelButton.addEventListener("click", toggleLabelEditor);
  addCommentButton.addEventListener("click", addCommentToSelectedCard);
  addChecklistButton.addEventListener("click", addChecklistToSelectedCard);
  editDescriptionButton.addEventListener("click", toggleDescriptionEditing);

  commentInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      addCommentToSelectedCard();
    }
  });

  cardTitleInput.addEventListener("input", () => {
    const card = getSelectedCard();
    if (!card) return;
    card.name = cardTitleInput.value.trim();
    touchCard(card);
    queueSave("Card updated");
    renderBoard();
    renderCardDialog();
  });

  cardDescriptionInput.addEventListener("input", () => {
    const card = getSelectedCard();
    if (!card) return;
    card.desc = cardDescriptionInput.value;
    touchCard(card);
    queueSave("Card updated");
    renderBoard();
    renderCardDialog();
  });

  promptCancelButton.addEventListener("click", () => promptDialog.close("cancel"));

  promptDialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    promptDialog.close("confirm");
  });

  cardDialog.addEventListener("close", () => {
    state.selectedCardId = null;
    state.descriptionEditing = false;
  });
}

function render() {
  renderHeader();
  renderBoard();
  renderCardDialog();
}

function renderHeader() {
  boardTitle.textContent = state.board?.name || "KanbanQube Board";
  userBadge.textContent = state.currentUserName.trim() || "Guest";
  saveStatus.textContent = state.syncStatusMessage || state.saveMessage;
  const canOpenLog = state.isSyncing || Boolean(state.lastSyncLog.trim());
  saveStatus.disabled = !canOpenLog;
  saveStatus.classList.toggle("is-clickable", canOpenLog);
}

function renderBoard() {
  boardScroller.textContent = "";
  const lists = openLists();

  for (const list of lists) {
    const laneNode = laneTemplate.content.firstElementChild.cloneNode(true);
    laneNode.dataset.listId = list.id;
    laneNode.querySelector(".lane-title").textContent = list.name;

    const cards = visibleCardsForList(list.id);
    laneNode.querySelector(".lane-count").textContent = String(cardsForList(list.id).length);

    const cardList = laneNode.querySelector(".card-list");
    for (const card of cards) {
      const cardNode = renderCard(card);
      cardList.append(cardNode);
    }

    laneNode.querySelector(".add-card-button").addEventListener("click", () => addCard(list.id));
    laneNode.querySelector(".rename-lane-button").addEventListener("click", () => renameLane(list.id));
    laneNode.querySelector(".delete-lane-button").addEventListener("click", () => deleteLane(list.id));

    enableCardDnD(laneNode, list.id);
    enableLaneDnD(laneNode);

    boardScroller.append(laneNode);
  }

  const addLaneCard = document.createElement("section");
  addLaneCard.className = "add-lane-card";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-button";
  button.textContent = "+ Add another lane";
  button.addEventListener("click", createLane);
  addLaneCard.append(button);
  boardScroller.append(addLaneCard);
}

async function createLane() {
  const title = await openPrompt({
    label: "Lane",
    title: "Create a lane",
    inputLabel: "Lane name",
    confirmLabel: "Create",
    value: ""
  });

  if (!title) return;

  const list = {
    id: createHexId(),
    idBoard: state.board.id,
    name: title,
    closed: false,
    pos: nextLanePos()
  };

  state.board.lists.push(list);
  pushAction("createList", {
    list: { id: list.id, name: list.name },
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave("Lane added");
  render();
}

function renderCard(card) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;

  const cardLabelsStrip = node.querySelector(".card-label-strip");
  const labels = labelsForCard(card).slice(0, 4);
  for (const label of labels) {
    const labelNode = document.createElement("span");
    labelNode.className = "card-label";
    labelNode.style.background = colorForLabel(label.color);
    labelNode.title = label.name || label.color;
    cardLabelsStrip.append(labelNode);
  }

  const coverNode = node.querySelector(".card-cover");
  const coverUrl = coverUrlForCard(card);
  if (coverUrl) {
    coverNode.classList.add("has-cover");
    coverNode.style.backgroundImage = `url("${coverUrl}")`;
  }

  const titleNode = node.querySelector(".card-title");
  const hasTitle = Boolean(card.name && card.name.trim());
  titleNode.textContent = hasTitle ? card.name : "Task";
  titleNode.classList.toggle("is-placeholder", !hasTitle);
  const descriptionNode = node.querySelector(".card-description");
  descriptionNode.textContent = card.desc || "";
  descriptionNode.hidden = !state.showCardDescriptions || !card.desc;

  const footer = node.querySelector(".card-footer");
  for (const badge of buildCardBadges(card)) {
    const badgeNode = document.createElement("span");
    badgeNode.className = "badge";
    badgeNode.textContent = badge;
    footer.append(badgeNode);
  }

  node.addEventListener("click", () => openCard(card.id));
  return node;
}

function renderCardDialog() {
  const card = getSelectedCard();
  if (!card) return;

  cardTitleInput.value = card.name || "";
  cardDescriptionInput.value = card.desc || "";
  commentInput.value = "";
  renderDescriptionDisplay(card.desc || "");
  cardDescriptionDisplay.hidden = state.descriptionEditing;
  cardDescriptionInput.hidden = !state.descriptionEditing;
  editDescriptionButton.textContent = state.descriptionEditing ? "Done" : "Edit";

  renderLabelsEditor(card);
  renderChecklists(card);
  renderActivity(card);
}

function renderLabelsEditor(card) {
  cardLabels.textContent = "";
  labelEditorContainer.textContent = "";

  const assignedLabels = labelsForCard(card);
  if (assignedLabels.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state label-summary-trigger";
    empty.textContent = "No labels assigned.";
    empty.addEventListener("click", openLabelEditor);
    cardLabels.append(empty);
  } else {
    for (const label of assignedLabels) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "label-pill";
      pill.textContent = label.name || label.color;
      pill.style.background = colorForLabel(label.color);
      pill.addEventListener("click", openLabelEditor);
      cardLabels.append(pill);
    }
  }

  addLabelButton.textContent = state.labelEditorOpen ? "×" : "+";
  addLabelButton.setAttribute("aria-label", state.labelEditorOpen ? "Close labels panel" : "Open labels panel");
  if (!state.labelEditorOpen) return;

  const labels = [...(state.board.labels || [])].sort((left, right) => {
    const leftName = (left.name || left.color || "").toLowerCase();
    const rightName = (right.name || right.color || "").toLowerCase();
    return leftName.localeCompare(rightName);
  });
  const searchTerm = state.labelSearchTerm.trim().toLowerCase();
  const filteredLabels = searchTerm
    ? labels.filter((label) => `${label.name || ""} ${label.color || ""}`.toLowerCase().includes(searchTerm))
    : labels;

  const panel = document.createElement("section");
  panel.className = "label-editor-panel";

  const searchInput = document.createElement("input");
  searchInput.className = "label-search-input";
  searchInput.type = "search";
  searchInput.placeholder = "Search labels…";
  searchInput.value = state.labelSearchTerm;
  searchInput.addEventListener("input", () => {
    state.labelSearchTerm = searchInput.value;
    renderCardDialog();
  });
  panel.append(searchInput);

  if (labels.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No labels yet. Add one for this card.";
    panel.append(empty);
    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "ghost-button";
    createButton.textContent = "Create a new label";
    createButton.addEventListener("click", addLabelToSelectedCard);
    panel.append(createButton);
    labelEditorContainer.append(panel);
    return;
  }

  const list = document.createElement("div");
  list.className = "label-editor-list";

  for (const label of filteredLabels) {
    const row = document.createElement("div");
    row.className = "label-editor-row";

    const toggle = document.createElement("input");
    toggle.className = "label-toggle";
    toggle.type = "checkbox";
    toggle.checked = card.idLabels.includes(label.id);
    toggle.addEventListener("change", () => {
      if (toggle.checked) {
        if (!card.idLabels.includes(label.id)) card.idLabels.push(label.id);
      } else {
        card.idLabels = card.idLabels.filter((labelId) => labelId !== label.id);
      }
      touchCard(card);
      queueSave("Labels updated");
      renderCardDialog();
    });

    const nameInput = document.createElement("input");
    nameInput.className = "label-name-input";
    nameInput.type = "text";
    nameInput.value = label.name || "";
    nameInput.placeholder = "Label name";
    nameInput.style.backgroundColor = colorForLabel(label.color);
    nameInput.addEventListener("input", () => {
      label.name = nameInput.value.trim();
      queueSave("Label updated");
      renderCardDialog();
      renderBoard();
    });

    const colorSelect = document.createElement("select");
    colorSelect.className = "label-color-select";
    for (const color of labelColorOptions()) {
      const option = document.createElement("option");
      option.value = color;
      option.textContent = color.replaceAll("_", " ");
      option.selected = color === label.color;
      colorSelect.append(option);
    }
    colorSelect.addEventListener("change", () => {
      label.color = colorSelect.value;
      queueSave("Label updated");
      renderCardDialog();
      renderBoard();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-button";
    removeButton.textContent = "🗑";
    removeButton.addEventListener("click", () => {
      deleteLabel(label.id);
      queueSave("Label removed");
      render();
    });

    row.append(toggle, nameInput, colorSelect, removeButton);
    list.append(row);
  }

  if (filteredLabels.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No labels match that search.";
    panel.append(empty);
  } else {
    panel.append(list);
  }

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "ghost-button";
  createButton.textContent = "Create a new label";
  createButton.addEventListener("click", addLabelToSelectedCard);
  panel.append(createButton);

  labelEditorContainer.append(panel);
}

function renderChecklists(card) {
  checklistsContainer.textContent = "";
  const checklists = checklistsForCard(card.id);

  if (checklists.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No checklists yet.";
    checklistsContainer.append(empty);
    return;
  }

  for (const checklist of checklists) {
    const checklistNode = document.createElement("section");
    checklistNode.className = "checklist";

    const header = document.createElement("div");
    header.className = "checklist-header";

    const titleInput = document.createElement("input");
    titleInput.className = "checklist-title-input";
    titleInput.value = checklist.name;
    titleInput.addEventListener("input", () => {
      checklist.name = titleInput.value.trim() || "Checklist";
      queueSave("Checklist updated");
    });

    const removeChecklistButton = document.createElement("button");
    removeChecklistButton.type = "button";
    removeChecklistButton.className = "icon-button";
    removeChecklistButton.textContent = "🗑";
    removeChecklistButton.addEventListener("click", () => {
      state.board.checklists = state.board.checklists.filter((item) => item.id !== checklist.id);
      card.idChecklists = card.idChecklists.filter((checklistId) => checklistId !== checklist.id);
      touchCard(card);
      queueSave("Checklist removed");
      renderCardDialog();
      renderBoard();
    });

    header.append(titleInput, removeChecklistButton);
    checklistNode.append(header);

    const itemsNode = document.createElement("div");
    itemsNode.className = "checklist-items";

    for (const item of checklist.checkItems) {
      const row = document.createElement("label");
      row.className = `checklist-item${item.state === "complete" ? " completed" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.state === "complete";
      checkbox.addEventListener("change", () => {
        item.state = checkbox.checked ? "complete" : "incomplete";
        row.classList.toggle("completed", checkbox.checked);
        touchCard(card);
        pushAction("updateCheckItemStateOnCard", {
          idCard: card.id,
          card: cardActionSnapshot(card),
          checklist: { id: checklist.id, name: checklist.name },
          checkItem: { id: item.id, name: item.name, state: item.state }
        });
        queueSave("Checklist updated");
        renderBoard();
      });

      const input = document.createElement("input");
      input.className = "checklist-item-input";
      input.type = "text";
      input.value = item.name;
      input.addEventListener("input", () => {
        item.name = input.value.trim() || "Checklist item";
        queueSave("Checklist updated");
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "icon-button";
      removeButton.textContent = "−";
      removeButton.addEventListener("click", () => {
        checklist.checkItems = checklist.checkItems.filter((candidate) => candidate.id !== item.id);
        touchCard(card);
        queueSave("Checklist updated");
        renderCardDialog();
        renderBoard();
      });

      row.append(checkbox, input, removeButton);
      itemsNode.append(row);
    }

    const addItemButton = document.createElement("button");
    addItemButton.type = "button";
    addItemButton.className = "ghost-button";
    addItemButton.textContent = "Add item";
    addItemButton.addEventListener("click", () => {
      checklist.checkItems.push({
        id: createHexId(),
        name: "New item",
        pos: nextChecklistItemPos(checklist),
        state: "incomplete",
        due: null,
        dueReminder: -1,
        idMember: null,
        idChecklist: checklist.id,
        nameData: { emoji: {} }
      });
      touchCard(card);
      queueSave("Checklist updated");
      renderCardDialog();
      renderBoard();
    });

    checklistNode.append(itemsNode, addItemButton);
    checklistsContainer.append(checklistNode);
  }
}

function renderActivity(card) {
  activityList.textContent = "";
  const actions = actionsForCard(card.id);

  if (actions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No recent activity for this card.";
    activityList.append(empty);
    return;
  }

  for (const action of actions.slice(0, 8)) {
    const entry = document.createElement("article");
    entry.className = "activity-entry";

    const title = document.createElement("strong");
    title.textContent = humanizeAction(action);

    const detail = document.createElement("div");
    detail.textContent = action.data?.text || action.data?.checkItem?.name || action.data?.listAfter?.name || action.data?.list?.name || "";

    const time = document.createElement("time");
    time.dateTime = action.date;
    time.textContent = new Date(action.date).toLocaleString();

    entry.append(title);
    if (detail.textContent) entry.append(detail);
    entry.append(time);
    activityList.append(entry);
  }
}

function addCommentToSelectedCard() {
  const card = getSelectedCard();
  if (!card) return;
  const text = commentInput.value.trim();
  if (!text) {
    commentInput.focus();
    return;
  }

  touchCard(card);
  pushAction("commentCard", {
    idCard: card.id,
    text,
    textData: { emoji: {} },
    card: cardActionSnapshot(card),
    board: { id: state.board.id, name: state.board.name },
    list: { id: card.idList, name: listById(card.idList)?.name || "" }
  });
  if (card.badges) card.badges.comments = (card.badges.comments || 0) + 1;
  commentInput.value = "";
  queueSave("Comment added");
  render();
}

function addLabelToSelectedCard() {
  const card = getSelectedCard();
  if (!card) return;

  const label = {
    id: createHexId(),
    idBoard: state.board.id,
    name: "New label",
    color: "blue",
    uses: 0
  };

  state.board.labels.push(label);
  if (!card.idLabels.includes(label.id)) card.idLabels.push(label.id);
  touchCard(card);
  state.labelEditorOpen = true;
  queueSave("Label added");
  render();
}

function toggleLabelEditor() {
  state.labelEditorOpen = !state.labelEditorOpen;
  if (!state.labelEditorOpen) state.labelSearchTerm = "";
  renderCardDialog();
}

function openLabelEditor() {
  state.labelEditorOpen = true;
  renderCardDialog();
}

async function addCard(listId) {
  const lane = listById(listId);
  const card = {
    id: createHexId(),
    idBoard: state.board.id,
    idList: listId,
    name: "",
    desc: "",
    closed: false,
    pos: nextCardPos(listId),
    idLabels: [],
    idMembers: [],
    idChecklists: [],
    attachments: [],
    cover: {
      idAttachment: null,
      color: null,
      idUploadedBackground: null,
      size: "normal",
      brightness: "dark",
      yPosition: 0.5,
      idPlugin: null
    },
    due: null,
    dueComplete: false,
    start: null,
    subscribed: false,
    shortLink: createHexId().slice(-8),
    shortUrl: "",
    url: "",
    dateLastActivity: new Date().toISOString(),
    labels: [],
    badges: {
      attachments: 0,
      attachmentsByType: { trello: { board: 0, card: 0 } },
      checkItems: 0,
      checkItemsChecked: 0,
      comments: 0,
      description: false,
      due: null,
      dueComplete: false,
      externalSource: null,
      fogbugz: "",
      lastUpdatedByAi: false,
      location: false,
      maliciousAttachments: 0,
      start: null,
      subscribed: false,
      viewingMemberVoted: false,
      votes: 0
    }
  };

  state.board.cards.push(card);
  pushAction("createCard", {
    card: cardActionSnapshot(card),
    list: { id: listId, name: lane?.name || "Lane" },
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave("Card added");
  openCard(card.id);
  render();
}

async function renameLane(listId) {
  const list = listById(listId);
  if (!list) return;
  const title = await openPrompt({
    label: "Lane",
    title: "Rename lane",
    inputLabel: "Lane name",
    confirmLabel: "Rename",
    value: list.name
  });

  if (!title) return;
  list.name = title;
  pushAction("updateList", {
    list: { id: list.id, name: list.name },
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave("Lane renamed");
  render();
}

function deleteLane(listId) {
  const list = listById(listId);
  if (!list) return;
  const cardCount = cardsForList(listId).length;
  const confirmed = window.confirm(`Delete "${list.name}" and ${cardCount} card(s) in it?`);
  if (!confirmed) return;

  list.closed = true;
  list.dateClosed = new Date().toISOString();
  for (const card of cardsForList(listId)) {
    card.closed = true;
  }
  pushAction("updateList", {
    list: { id: list.id, name: list.name },
    old: { closed: false },
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave("Lane deleted");
  render();
}

function openCard(cardId) {
  state.selectedCardId = cardId;
  state.labelEditorOpen = false;
  state.labelSearchTerm = "";
  state.descriptionEditing = false;
  renderCardDialog();
  if (!cardDialog.open) {
    cardDialog.showModal();
  }
}

function deleteSelectedCard() {
  const card = getSelectedCard();
  if (!card) return;
  const confirmed = window.confirm(`Delete "${card.name}"?`);
  if (!confirmed) return;

  card.closed = true;
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { closed: false }
  });
  queueSave("Card deleted");
  cardDialog.close();
  render();
}

function addChecklistToSelectedCard() {
  const card = getSelectedCard();
  if (!card) return;
  const checklist = {
    id: createHexId(),
    idBoard: state.board.id,
    idCard: card.id,
    name: `Checklist ${card.idChecklists.length + 1}`,
    checkItems: []
  };
  state.board.checklists.push(checklist);
  card.idChecklists.push(checklist.id);
  touchCard(card);
  queueSave("Checklist added");
  renderCardDialog();
  renderBoard();
}

function toggleDescriptionEditing() {
  state.descriptionEditing = !state.descriptionEditing;
  renderCardDialog();
  if (state.descriptionEditing) {
    cardDescriptionInput.focus();
    cardDescriptionInput.setSelectionRange(cardDescriptionInput.value.length, cardDescriptionInput.value.length);
  }
}

function renderDescriptionDisplay(text) {
  const content = typeof text === "string" ? text : "";
  cardDescriptionDisplay.textContent = "";
  cardDescriptionDisplay.classList.toggle("is-empty", !content.trim());

  if (!content.trim()) {
    cardDescriptionDisplay.textContent = "No description yet.";
    return;
  }

  const fragment = document.createDocumentFragment();
  const blocks = content.split(/\n{2,}/);

  for (const block of blocks) {
    const headingMatch = block.trim().match(/^(#{1,6})\s+(.+)$/);
    const node = headingMatch
      ? document.createElement(`h${headingMatch[1].length}`)
      : document.createElement("p");
    const blockContent = headingMatch ? headingMatch[2] : block;
    const lines = blockContent.split("\n");

    lines.forEach((line, index) => {
      appendFormattedText(node, line);
      if (index < lines.length - 1) {
        node.append(document.createElement("br"));
      }
    });

    fragment.append(node);
  }

  cardDescriptionDisplay.append(fragment);
}

function appendFormattedText(container, text) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)|(https?:\/\/[^\s<]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const label = match[1];
    const href = match[2] || match[4];
    const title = match[3] || "";
    const link = createSafeLink(label || href, href, title);

    if (link) {
      container.append(link);
    } else {
      container.append(document.createTextNode(match[0]));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    container.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function createSafeLink(label, href, title = "") {
  let parsedUrl;
  try {
    parsedUrl = new URL(href);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const link = document.createElement("a");
  link.href = parsedUrl.toString();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  if (title) link.title = title;
  return link;
}

function saveSettings() {
  const nextBoardName = settingsBoardName.value.trim() || "KanbanQube Board";
  const nextShowCardDescriptions = settingsShowCardDescriptions.checked;
  let didPersistLocalSetting = false;

  if (state.showCardDescriptions !== nextShowCardDescriptions) {
    state.showCardDescriptions = nextShowCardDescriptions;
    localStorage.setItem(SHOW_CARD_DESCRIPTIONS_STORAGE_KEY, String(nextShowCardDescriptions));
    didPersistLocalSetting = true;
  }

  if (state.board.name !== nextBoardName) {
    state.board.name = nextBoardName;
    pushAction("updateBoard", {
      board: { id: state.board.id, name: state.board.name }
    });
    queueSave("Settings saved");
  } else if (didPersistLocalSetting) {
    setSaveMessage("Settings saved locally");
    renderBoard();
  } else {
    setSaveMessage("Settings saved locally");
  }

  settingsDialog.close();
  render();
}

function openSettingsDialog() {
  settingsUserName.value = state.currentUserName;
  settingsUserEmail.value = state.currentUserEmail;
  settingsBoardName.value = state.board?.name || "";
  settingsShowCardDescriptions.checked = state.showCardDescriptions;

  if (!settingsDialog.open) {
    settingsDialog.showModal();
  }
  settingsBoardName.focus();
}

async function syncBoard() {
  syncButton.disabled = true;
  state.isSyncing = true;
  state.syncStatusMessage = "Syncing with git…";
  state.lastSyncLog = "Syncing with git…";
  setSaveMessage("Syncing with git…");
  try {
    if (state.isSaving) {
      await saveBoardNow();
    }

    const response = await fetch("/api/sync", { method: "POST" });
    const payload = await response.json();
    state.lastSyncLog = payload.output || "No sync output was returned.";
    if (!response.ok || !payload.ok) {
      throw new Error(payload.output || "Git sync failed.");
    }
    state.syncStatusMessage = "Board synced";
    setSaveMessage("Board synced");
  } catch (error) {
    state.syncStatusMessage = error.message || "Git sync failed.";
    state.lastSyncLog = error.message || "Git sync failed.";
    setSaveMessage(error.message || "Git sync failed.");
    window.alert(error.message || "Git sync failed.");
  } finally {
    state.isSyncing = false;
    syncButton.disabled = false;
    renderHeader();
  }
}

function openSyncLogDialog() {
  if (!state.isSyncing && !state.lastSyncLog.trim()) return;
  syncLogContent.textContent = state.lastSyncLog || "No git sync has run yet.";
  if (!syncLogDialog.open) {
    syncLogDialog.showModal();
  }
}

function queueSave(message) {
  setSaveMessage(`${message} — saving…`);
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveBoardNow().catch((error) => {
      setSaveMessage(error.message || "Save failed.");
    });
  }, 220);
}

async function saveBoardNow() {
  if (!state.board) return;
  state.isSaving = true;
  state.board.dateLastActivity = new Date().toISOString();
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.board)
  });

  if (!response.ok) {
    state.isSaving = false;
    throw new Error("Could not save board.json.");
  }

  state.board = await response.json();
  state.isSaving = false;
  setSaveMessage(`Saved ${new Date().toLocaleTimeString()}`);
  render();
}

function setSaveMessage(message) {
  state.saveMessage = message;
  renderHeader();
}

function moveCardToLane(card, listId) {
  if (!card || card.idList === listId) return;

  const fromList = listById(card.idList);
  const toList = listById(listId);
  card.idList = listId;
  card.pos = nextCardPos(listId);
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    listBefore: fromList ? { id: fromList.id, name: fromList.name } : undefined,
    listAfter: toList ? { id: toList.id, name: toList.name } : undefined
  });
  queueSave("Card moved");
  render();
}

function touchCard(card) {
  card.dateLastActivity = new Date().toISOString();
}

function pushAction(type, data) {
  const member = ensureCurrentUserMember();
  state.board.actions.unshift({
    id: createHexId(),
    type,
    date: new Date().toISOString(),
    memberCreator: member,
    idMemberCreator: member.id,
    data
  });
}

function ensureCurrentUserMember() {
  const name = state.currentUserName.trim() || "Guest";
  const username = slugify(name);
  let member = state.board.members.find((candidate) => candidate.username === username);
  if (!member) {
    member = {
      id: createHexId(),
      fullName: name,
      username,
      email: state.currentUserEmail.trim() || undefined,
      initials: initialsFor(name),
      nonPublic: {
        fullName: name,
        initials: initialsFor(name)
      }
    };
    state.board.members.push(member);
  }
  return member;
}

function deleteLabel(labelId) {
  state.board.labels = (state.board.labels || []).filter((label) => label.id !== labelId);
  for (const card of state.board.cards || []) {
    if (Array.isArray(card.idLabels)) {
      card.idLabels = card.idLabels.filter((currentLabelId) => currentLabelId !== labelId);
    }
  }
}

function actionsForCard(cardId) {
  return (state.board.actions || []).filter((action) => {
    const targetCardId = action?.data?.idCard || action?.data?.card?.id;
    return targetCardId === cardId;
  });
}

function labelsForCard(card) {
  const labels = new Map((state.board.labels || []).map((label) => [label.id, label]));
  return (card.idLabels || []).map((labelId) => labels.get(labelId)).filter(Boolean);
}

function checklistsForCard(cardId) {
  return (state.board.checklists || []).filter((checklist) => checklist.idCard === cardId);
}

function openLists() {
  return [...(state.board?.lists || [])]
    .filter((list) => !list.closed)
    .sort((left, right) => left.pos - right.pos);
}

function cardsForList(listId) {
  return [...(state.board?.cards || [])]
    .filter((card) => !card.closed && card.idList === listId)
    .sort((left, right) => left.pos - right.pos);
}

function visibleCardsForList(listId) {
  const cards = cardsForList(listId);
  if (!state.searchTerm) return cards;
  return cards.filter((card) => {
    const haystack = [card.name, card.desc, ...labelsForCard(card).map((label) => label.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.searchTerm);
  });
}

function listById(listId) {
  return (state.board?.lists || []).find((list) => list.id === listId) || null;
}

function getSelectedCard() {
  return (state.board?.cards || []).find((card) => card.id === state.selectedCardId && !card.closed) || null;
}

function nextLanePos() {
  const lists = openLists();
  return lists.length ? Math.max(...lists.map((list) => Number(list.pos) || 0)) + 16384 : 16384;
}

function nextCardPos(listId) {
  const cards = cardsForList(listId);
  return cards.length ? Math.max(...cards.map((card) => Number(card.pos) || 0)) + 16384 : 16384;
}

function nextChecklistItemPos(checklist) {
  const items = checklist.checkItems || [];
  return items.length ? Math.max(...items.map((item) => Number(item.pos) || 0)) + 16384 : 16384;
}

function enableCardDnD(laneNode, listId) {
  const cardList = laneNode.querySelector(".card-list");
  const cards = cardList.querySelectorAll(".card");

  for (const cardNode of cards) {
    cardNode.addEventListener("dragstart", (event) => {
      state.drag = { type: "card", cardId: cardNode.dataset.cardId, sourceListId: listId };
      cardNode.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    cardNode.addEventListener("dragend", () => {
      cardNode.classList.remove("dragging");
    });
  }

  cardList.addEventListener("dragover", (event) => {
    if (!state.drag || state.drag.type !== "card") return;
    event.preventDefault();
    const after = cardElementAfter(cardList, event.clientY);
    const dragging = document.querySelector(`.card[data-card-id="${state.drag.cardId}"]`);
    if (!dragging) return;
    if (!after) cardList.append(dragging);
    else if (after !== dragging) cardList.insertBefore(dragging, after);
  });

  cardList.addEventListener("drop", (event) => {
    if (!state.drag || state.drag.type !== "card") return;
    event.preventDefault();
    const cardId = state.drag.cardId;
    const card = (state.board.cards || []).find((candidate) => candidate.id === cardId);
    if (!card) return;

    const order = [...cardList.querySelectorAll(".card")].map((node) => node.dataset.cardId);
    const previousListId = card.idList;
    reorderCardsFromDom(listId, order, previousListId !== listId ? previousListId : null, cardId);
    state.drag = null;
  });
}

function enableLaneDnD(laneNode) {
  laneNode.addEventListener("dragstart", (event) => {
    if (event.target.closest(".card")) return;
    state.drag = { type: "lane", listId: laneNode.dataset.listId };
    laneNode.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  laneNode.addEventListener("dragend", () => {
    laneNode.classList.remove("dragging");
  });
}

function handleLaneDragOver(event) {
  if (!state.drag || state.drag.type !== "lane") return;
  event.preventDefault();
  const after = laneElementAfter(boardScroller, event.clientX);
  const dragging = document.querySelector(`.lane[data-list-id="${state.drag.listId}"]`);
  if (!dragging) return;
  if (!after) {
    const anchor = boardScroller.querySelector(".add-lane-card");
    boardScroller.insertBefore(dragging, anchor);
  } else if (after !== dragging) {
    boardScroller.insertBefore(dragging, after);
  }
}

function handleLaneDrop(event) {
  if (!state.drag || state.drag.type !== "lane") return;
  event.preventDefault();
  const order = [...boardScroller.querySelectorAll(".lane")].map((laneNode) => laneNode.dataset.listId);
  order.forEach((listId, index) => {
    const list = listById(listId);
    if (list) list.pos = (index + 1) * 16384;
  });
  pushAction("updateBoard", {
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave("Lane order updated");
  state.drag = null;
  renderBoard();
}

function reorderCardsFromDom(listId, order, previousListId = null, movedCardId = null) {
  order.forEach((cardId, index) => {
    const card = (state.board.cards || []).find((candidate) => candidate.id === cardId);
    if (!card) return;
    card.idList = listId;
    card.pos = (index + 1) * 16384;
    touchCard(card);
  });

  const movedCard = (state.board.cards || []).find((card) => card.id === movedCardId);
  if (movedCard) {
    pushAction("updateCard", {
      idCard: movedCard.id,
      card: cardActionSnapshot(movedCard),
      list: { id: listId, name: listById(listId)?.name || "" },
      listBefore: previousListId ? { id: previousListId, name: listById(previousListId)?.name || "" } : undefined,
      listAfter: previousListId ? { id: listId, name: listById(listId)?.name || "" } : undefined
    });
  }
  queueSave(previousListId ? "Card moved" : "Card order updated");
  render();
}

function laneElementAfter(container, x) {
  const candidates = [...container.querySelectorAll(".lane:not(.dragging)")];
  return candidates.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function cardElementAfter(container, y) {
  const candidates = [...container.querySelectorAll(".card:not(.dragging)")];
  return candidates.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function buildCardBadges(card) {
  const badges = [];
  if (card.badges?.description) badges.push("≡");
  if (card.badges?.comments) badges.push(`💬 ${card.badges.comments}`);
  if (card.badges?.checkItems) badges.push(`☑ ${card.badges.checkItemsChecked || 0}/${card.badges.checkItems}`);
  if (card.attachments?.length) badges.push(`📎 ${card.attachments.length}`);
  return badges;
}

function coverUrlForCard(card) {
  const attachmentId = card.cover?.idAttachment;
  if (!attachmentId || !Array.isArray(card.attachments)) return "";
  const match = card.attachments.find((attachment) => attachment.id === attachmentId);
  return match?.url || match?.previewUrl || "";
}

function cardActionSnapshot(card) {
  return {
    id: card.id,
    name: card.name,
    idShort: card.idShort || null,
    shortLink: card.shortLink || card.id.slice(-8)
  };
}

function humanizeAction(action) {
  const actor = action.memberCreator?.fullName || action.memberCreator?.username || "Someone";
  const verbs = {
    createCard: "created this card",
    updateCard: "updated this card",
    updateBoard: "updated the board",
    createList: "created a lane",
    updateList: "updated a lane",
    updateCheckItemStateOnCard: "updated a checklist item",
    commentCard: "commented on this card"
  };
  return `${actor} ${verbs[action.type] || action.type}`;
}

function hydrateIdentityFromGitConfig() {
  const gitUserName = typeof state.config?.gitUserName === "string" ? state.config.gitUserName.trim() : "";
  const gitUserEmail = typeof state.config?.gitUserEmail === "string" ? state.config.gitUserEmail.trim() : "";

  if (!state.currentUserName.trim() && gitUserName) {
    state.currentUserName = gitUserName;
    localStorage.setItem(USER_STORAGE_KEY, gitUserName);
  }

  if (!state.currentUserEmail.trim() && gitUserEmail) {
    state.currentUserEmail = gitUserEmail;
    localStorage.setItem(USER_EMAIL_STORAGE_KEY, gitUserEmail);
  }
}

function colorForLabel(color) {
  return labelColorMap[color] || labelColorMap.blue;
}

function labelColorOptions() {
  return Object.keys(labelColorMap);
}

function createHexId() {
  const values = new Uint8Array(12);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function initialsFor(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "user";
}

function openPrompt({ label, title, inputLabel, confirmLabel, value }) {
  promptLabel.textContent = label;
  promptTitle.textContent = title;
  promptInputLabel.textContent = inputLabel;
  promptConfirmButton.textContent = confirmLabel;
  promptInput.value = value || "";
  promptDialog.showModal();
  promptInput.focus();

  return new Promise((resolve) => {
    const handleClose = () => {
      promptDialog.removeEventListener("close", handleClose);
      resolve(promptDialog.returnValue === "confirm" ? promptInput.value.trim() : "");
    };
    promptDialog.addEventListener("close", handleClose);
  });
}
