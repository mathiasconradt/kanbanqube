"use strict";

const USER_STORAGE_KEY = "kanbanqube.userName";
const USER_EMAIL_STORAGE_KEY = "kanbanqube.userEmail";
const SHOW_CARD_DESCRIPTIONS_STORAGE_KEY = "kanbanqube.showCardDescriptions";
const INLINE_CARD_TITLE_EDIT_STORAGE_KEY = "kanbanqube.inlineCardTitleEdit";
const ICON_STYLE_STORAGE_KEY = "kanbanqube.iconStyle";
const ICON_PATHS = {
  "3d": "/icon_3d.png",
  flat: "/icon_flat.png"
};
const SYNC_TIMESTAMP_FORMAT = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true
};

const state = {
  board: null,
  config: null,
  currentUserName: localStorage.getItem(USER_STORAGE_KEY) || "",
  currentUserEmail: localStorage.getItem(USER_EMAIL_STORAGE_KEY) || "",
  showCardDescriptions: localStorage.getItem(SHOW_CARD_DESCRIPTIONS_STORAGE_KEY) === "true",
  inlineCardTitleEdit: localStorage.getItem(INLINE_CARD_TITLE_EDIT_STORAGE_KEY) === "true",
  iconStyle: localStorage.getItem(ICON_STYLE_STORAGE_KEY) === "flat" ? "flat" : "3d",
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
  lastSyncAt: "",
  isSyncing: false,
  editingBoardTitle: false,
  editingBoardTitleValue: "",
  editingLaneTitleId: null,
  editingLaneTitleValue: "",
  editingCardTitleId: null,
  editingCardTitleValue: "",
  drag: null
};

const boardScroller = document.getElementById("boardScroller");
const aboutButton = document.getElementById("aboutButton");
const brandIcon = aboutButton.querySelector("img");
const aboutDialog = document.getElementById("aboutDialog");
const aboutImage = document.getElementById("aboutImage");
const faviconLink = document.getElementById("faviconLink");
const boardTitle = document.getElementById("boardTitle");
const boardTitleInlineInput = document.getElementById("boardTitleInlineInput");
const boardFileBadge = document.getElementById("boardFileBadge");
const userBadge = document.getElementById("userBadge");
const searchInput = document.getElementById("searchInput");
const saveStatus = document.getElementById("saveStatus");
const syncButton = document.getElementById("syncButton");
const archiveButton = document.getElementById("archiveButton");
const settingsButton = document.getElementById("settingsButton");
const syncLogDialog = document.getElementById("syncLogDialog");
const syncLogContent = document.getElementById("syncLogContent");
const syncLogTimestamp = document.getElementById("syncLogTimestamp");
const closeSyncLogButton = document.getElementById("closeSyncLogButton");
const syncLogCloseButton = document.getElementById("syncLogCloseButton");
const archiveDialog = document.getElementById("archiveDialog");
const archiveList = document.getElementById("archiveList");
const closeArchiveButton = document.getElementById("closeArchiveButton");

const cardDialog = document.getElementById("cardDialog");
const cardTitleInput = document.getElementById("cardTitleInput");
const archivedCardBanner = document.getElementById("archivedCardBanner");
const cardDetailsCover = document.getElementById("cardDetailsCover");
const removeCoverButton = document.getElementById("removeCoverButton");
const cardDescriptionDisplay = document.getElementById("cardDescriptionDisplay");
const cardDescriptionInput = document.getElementById("cardDescriptionInput");
const attachmentInput = document.getElementById("attachmentInput");
const addAttachmentButton = document.getElementById("addAttachmentButton");
const attachmentDropZone = document.getElementById("attachmentDropZone");
const attachmentsContainer = document.getElementById("attachmentsContainer");
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
const settingsIconStyleInputs = [...document.querySelectorAll("input[name=\"settingsIconStyle\"]")];
const settingsShowCardDescriptions = document.getElementById("settingsShowCardDescriptions");
const settingsInlineCardTitleEdit = document.getElementById("settingsInlineCardTitleEdit");
const importBoardInput = document.getElementById("importBoardInput");
const importBoardButton = document.getElementById("importBoardButton");
const settingsImportHelp = document.getElementById("settingsImportHelp");
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

const appDialog = document.getElementById("appDialog");
const appDialogLabel = document.getElementById("appDialogLabel");
const appDialogTitle = document.getElementById("appDialogTitle");
const appDialogMessage = document.getElementById("appDialogMessage");
const appDialogCloseButton = document.getElementById("appDialogCloseButton");
const appDialogCancelButton = document.getElementById("appDialogCancelButton");
const appDialogConfirmButton = document.getElementById("appDialogConfirmButton");

const laneTemplate = document.getElementById("laneTemplate");
const cardTemplate = document.getElementById("cardTemplate");
let syncStatusPollTimer = null;
let syncStatusPollInFlight = false;

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
  applyIconStyle();
  const storageLabel = state.config.storagePath ? `${state.config.storagePath}/` : (state.config.boardFile || "board.json");
  boardFileBadge.textContent = storageLabel;
  settingsBoardFile.textContent = `Storage: ${storageLabel}`;
  settingsRemote.textContent = state.config.gitRemote ? `Remote: ${state.config.gitRemote}` : "Remote: not configured";

  wireEvents();
  if (migrateLegacyBoardData()) {
    setSaveMessage("Updating board format…");
    await saveBoardNow();
  } else {
    setSaveMessage("Ready");
  }
  render();
}

function wireEvents() {
  aboutButton.addEventListener("click", openAboutDialog);
  aboutDialog.addEventListener("click", (event) => {
    if (event.target === aboutDialog) {
      aboutDialog.close();
    }
  });
  aboutImage.addEventListener("click", () => aboutDialog.close());

  searchInput.addEventListener("input", () => {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    renderBoard();
  });

  settingsButton.addEventListener("click", openSettingsDialog);
  archiveButton.addEventListener("click", openArchiveDialog);
  boardTitle.addEventListener("click", startBoardTitleEdit);
  closeSettingsButton.addEventListener("click", () => settingsDialog.close());
  closeArchiveButton.addEventListener("click", () => archiveDialog.close());
  saveSettingsButton.addEventListener("click", saveSettings);
  importBoardButton.addEventListener("click", () => importBoardInput.click());
  importBoardInput.addEventListener("change", () => {
    const file = importBoardInput.files?.[0];
    importBoardInput.value = "";
    if (file) importBoardFromFile(file);
  });

  syncButton.addEventListener("click", syncBoard);
  saveStatus.addEventListener("click", openSyncLogDialog);
  closeSyncLogButton.addEventListener("click", () => syncLogDialog.close());
  syncLogCloseButton.addEventListener("click", () => syncLogDialog.close());
  syncLogDialog.addEventListener("cancel", (event) => {
    if (state.isSyncing) event.preventDefault();
  });
  boardScroller.addEventListener("dragover", handleLaneDragOver);
  boardScroller.addEventListener("drop", handleLaneDrop);

  closeCardButton.addEventListener("click", () => cardDialog.close());
  removeCoverButton.addEventListener("click", removeCoverFromSelectedCard);
  deleteCardButton.addEventListener("click", deleteSelectedCard);
  addLabelButton.addEventListener("click", toggleLabelEditor);
  addCommentButton.addEventListener("click", addCommentToSelectedCard);
  addChecklistButton.addEventListener("click", addChecklistToSelectedCard);
  addAttachmentButton.addEventListener("click", () => attachmentInput.click());
  attachmentInput.addEventListener("change", () => {
    const files = [...attachmentInput.files];
    attachmentInput.value = "";
    uploadFilesToSelectedCard(files);
  });
  attachmentDropZone.addEventListener("dragover", handleAttachmentDragOver);
  attachmentDropZone.addEventListener("dragleave", handleAttachmentDragLeave);
  attachmentDropZone.addEventListener("drop", handleAttachmentDrop);
  cardDialog.addEventListener("dragover", handleAttachmentDragOver);
  cardDialog.addEventListener("dragleave", handleAttachmentDragLeave);
  cardDialog.addEventListener("drop", handleAttachmentDrop);
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
    card.name = cardTitleInput.value;
    touchCard(card);
    queueSave("Card updated");
    renderBoard();
    if (archiveDialog.open) {
      renderArchiveDialog();
    }
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
  appDialogCloseButton.addEventListener("click", () => appDialog.close("cancel"));
  appDialogCancelButton.addEventListener("click", () => appDialog.close("cancel"));

  promptDialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    promptDialog.close("confirm");
  });

  boardTitleInlineInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  boardTitleInlineInput.addEventListener("input", () => {
    state.editingBoardTitleValue = boardTitleInlineInput.value;
  });
  boardTitleInlineInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitBoardTitleEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelBoardTitleEdit();
    }
  });
  boardTitleInlineInput.addEventListener("blur", commitBoardTitleEdit);

  cardDialog.addEventListener("close", () => {
    state.selectedCardId = null;
    state.descriptionEditing = false;
  });
}

function openAboutDialog() {
  if (!aboutDialog.open) {
    aboutDialog.showModal();
  }
}

function applyIconStyle() {
  const path = ICON_PATHS[state.iconStyle] || ICON_PATHS["3d"];
  brandIcon.src = path;
  faviconLink.href = path;
}

function render() {
  renderHeader();
  renderBoard();
  renderCardDialog();
  renderArchiveDialog();
}

function renderHeader() {
  boardTitle.textContent = state.board?.name || "KanbanQube Board";
  boardTitle.hidden = state.editingBoardTitle;
  boardTitle.classList.toggle("is-inline-editable", true);
  boardTitleInlineInput.hidden = !state.editingBoardTitle;
  boardTitleInlineInput.value = state.editingBoardTitleValue;
  userBadge.textContent = state.currentUserName.trim() || "Guest";
  const archivedCount = archivedCards().length;
  archiveButton.textContent = archivedCount ? `Archive (${archivedCount})` : "Archive";
  const canSync = Boolean(state.config?.gitRemote);
  syncButton.disabled = state.isSyncing || !canSync;
  syncButton.title = canSync ? "" : "Git remote not configured";
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
    const laneTitle = laneNode.querySelector(".lane-title");
    const laneTitleInput = laneNode.querySelector(".lane-title-inline-input");
    const isEditingLaneTitle = state.editingLaneTitleId === list.id;
    laneTitle.textContent = list.name || "Lane";
    laneTitle.classList.toggle("is-inline-editable", true);
    laneTitle.hidden = isEditingLaneTitle;
    laneTitleInput.hidden = !isEditingLaneTitle;
    laneTitleInput.value = state.editingLaneTitleValue;
    laneTitle.addEventListener("click", () => startLaneTitleEdit(list.id));
    laneTitleInput.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    laneTitleInput.addEventListener("input", () => {
      state.editingLaneTitleValue = laneTitleInput.value;
    });
    laneTitleInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        commitLaneTitleEdit(list.id);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelLaneTitleEdit();
      }
    });
    laneTitleInput.addEventListener("blur", () => commitLaneTitleEdit(list.id));

    const cards = visibleCardsForList(list.id);
    laneNode.querySelector(".lane-count").textContent = String(cardsForList(list.id).length);

    const cardList = laneNode.querySelector(".card-list");
    for (const card of cards) {
      const cardNode = renderCard(card);
      cardList.append(cardNode);
    }

    laneNode.querySelector(".add-card-button").addEventListener("click", () => addCard(list.id));
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
  node.classList.toggle("is-done", isCardDone(card));

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

  const doneToggle = node.querySelector(".card-done-toggle");
  const done = isCardDone(card);
  doneToggle.textContent = done ? "✓" : "";
  doneToggle.setAttribute("aria-pressed", String(done));
  doneToggle.setAttribute("aria-label", done ? "Mark task not done" : "Mark task done");
  doneToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleCardDone(card);
  });

  const archiveButton = node.querySelector(".card-archive-button");
  archiveButton.hidden = !done;
  archiveButton.addEventListener("click", (event) => {
    event.stopPropagation();
    archiveCard(card);
  });

  const titleNode = node.querySelector(".card-title");
  const titleInput = node.querySelector(".card-title-inline-input");
  const hasTitle = Boolean(card.name && card.name.trim());
  const isEditingTitle = state.inlineCardTitleEdit && state.editingCardTitleId === card.id;
  titleNode.textContent = hasTitle ? card.name : "Task";
  titleNode.classList.toggle("is-placeholder", !hasTitle);
  titleNode.classList.toggle("is-done", done);
  titleNode.classList.toggle("is-inline-editable", state.inlineCardTitleEdit);
  titleNode.hidden = isEditingTitle;
  titleInput.hidden = !isEditingTitle;
  titleInput.value = state.editingCardTitleValue;
  titleInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  if (state.inlineCardTitleEdit) {
    titleNode.addEventListener("click", (event) => {
      event.stopPropagation();
      startCardTitleEdit(card.id);
    });
  }
  titleInput.addEventListener("input", () => {
    state.editingCardTitleValue = titleInput.value;
  });
  titleInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commitCardTitleEdit(card.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelCardTitleEdit();
    }
  });
  titleInput.addEventListener("blur", () => commitCardTitleEdit(card.id));
  const descriptionNode = node.querySelector(".card-description");
  descriptionNode.textContent = card.desc || "";
  descriptionNode.hidden = !state.showCardDescriptions || !card.desc;

  const footer = node.querySelector(".card-footer");
  for (const badge of buildCardBadges(card)) {
    const badgeNode = document.createElement("span");
    badgeNode.className = "badge";
    badgeNode.append(createIcon(badge.icon));
    if (badge.text) {
      const text = document.createElement("span");
      text.textContent = badge.text;
      badgeNode.append(text);
    }
    footer.append(badgeNode);
  }

  node.addEventListener("click", () => openCard(card.id));
  node.addEventListener("dragover", (event) => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    node.classList.add("is-file-drop-target");
  });
  node.addEventListener("dragleave", () => {
    node.classList.remove("is-file-drop-target");
  });
  node.addEventListener("drop", (event) => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    node.classList.remove("is-file-drop-target");
    uploadFilesToCard(card.id, [...event.dataTransfer.files]);
  });
  return node;
}

function renderCardDialog() {
  const card = getSelectedCard();
  if (!card) return;

  cardTitleInput.value = card.name || "";
  archivedCardBanner.hidden = !isCardArchived(card);
  const coverUrl = coverUrlForCard(card);
  cardDetailsCover.hidden = !coverUrl;
  cardDetailsCover.style.backgroundImage = coverUrl ? `url("${coverUrl}")` : "";
  removeCoverButton.hidden = !coverUrl;
  cardDescriptionInput.value = card.desc || "";
  commentInput.value = "";
  renderDescriptionDisplay(card.desc || "");
  cardDescriptionDisplay.hidden = state.descriptionEditing;
  cardDescriptionInput.hidden = !state.descriptionEditing;
  editDescriptionButton.textContent = state.descriptionEditing ? "Done" : "Edit";

  renderLabelsEditor(card);
  renderAttachments(card);
  renderChecklists(card);
  renderActivity(card);
}

function renderArchiveDialog() {
  archiveList.textContent = "";
  const cards = archivedCards();

  if (cards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state archive-empty-state";
    empty.textContent = "No archived cards.";
    archiveList.append(empty);
    return;
  }

  for (const card of cards) {
    const row = document.createElement("article");
    row.className = "archive-item";
    row.tabIndex = 0;

    const main = document.createElement("div");
    main.className = "archive-item-main";

    const title = document.createElement("h3");
    title.className = "archive-item-title";
    title.textContent = (card.name && card.name.trim()) || "Task";
    main.append(title);

    const meta = document.createElement("p");
    meta.className = "archive-item-meta";
    const lane = listById(card.idList);
    meta.textContent = `In ${lane?.name || "Unknown lane"}`;
    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "archive-item-actions";

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.className = "ghost-button";
    restoreButton.textContent = "Restore";
    restoreButton.addEventListener("click", (event) => {
      event.stopPropagation();
      restoreArchivedCard(card.id);
    });
    actions.append(restoreButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteArchivedCard(card.id);
    });
    actions.append(deleteButton);

    row.append(main, actions);
    row.addEventListener("click", () => openArchivedCard(card.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openArchivedCard(card.id);
      }
    });
    archiveList.append(row);
  }
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
    removeButton.append(createIcon("trash"));
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

function renderAttachments(card) {
  attachmentsContainer.textContent = "";
  attachmentDropZone.classList.remove("is-dragging");

  const attachments = Array.isArray(card.attachments) ? card.attachments : [];

  if (attachments.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No attachments yet.";
    attachmentsContainer.append(empty);
    return;
  }

  for (const attachment of attachments) {
    const row = document.createElement("a");
    row.className = "attachment-row";
    row.href = attachment.url;
    row.target = "_blank";
    row.rel = "noopener noreferrer";

    const icon = document.createElement("span");
    icon.className = "attachment-icon";
    icon.append(createIcon(isImageAttachment(attachment) ? "image" : "file"));

    const main = document.createElement("span");
    main.className = "attachment-main";

    const name = document.createElement("strong");
    name.textContent = attachment.name || "Attachment";
    main.append(name);

    const meta = document.createElement("span");
    meta.textContent = formatAttachmentMeta(attachment);
    main.append(meta);

    row.append(icon, main);
    if (isImageAttachment(attachment)) {
      const coverButton = document.createElement("button");
      coverButton.type = "button";
      coverButton.className = "ghost-button attachment-cover-button";
      coverButton.textContent = card.cover?.idAttachment === attachment.id ? "Cover" : "Make cover";
      coverButton.disabled = card.cover?.idAttachment === attachment.id;
      coverButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setAttachmentAsCover(card.id, attachment.id);
      });
      row.append(coverButton);
    }
    attachmentsContainer.append(row);
  }
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
    removeChecklistButton.append(createIcon("trash"));
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
    const detailText = action.data?.text || action.data?.attachment?.name || action.data?.checkItem?.name || action.data?.listAfter?.name || action.data?.list?.name || "";
    appendFormattedText(detail, detailText);

    const time = document.createElement("time");
    time.dateTime = action.date;
    time.textContent = new Date(action.date).toLocaleString();

    entry.append(title);
    if (detailText) entry.append(detail);
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
    kanbanQubeDone: false,
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

async function uploadFilesToSelectedCard(files) {
  const card = getSelectedCard();
  if (!card) return;
  await uploadFilesToCard(card.id, files);
}

async function uploadFilesToCard(cardId, files) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId && !candidate.closed);
  const uploadFiles = files.filter((file) => file && file.size > 0);
  if (!card || uploadFiles.length === 0) return;

  setSaveMessage(`Uploading ${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"}…`);

  try {
    const formData = new FormData();
    for (const file of uploadFiles) {
      formData.append("files", file, file.name);
    }

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    const attachments = Array.isArray(payload.files) ? payload.files : [];
    if (attachments.length === 0) return;

    card.attachments = Array.isArray(card.attachments) ? card.attachments : [];
    card.attachments.push(...attachments);
    if (card.badges) {
      card.badges.attachments = card.attachments.length;
      card.badges.attachmentsByType = {
        trello: { board: 0, card: card.attachments.length }
      };
    }

    const firstImage = attachments.find(isImageAttachment);
    if (firstImage && !card.cover?.idAttachment) {
      card.cover = {
        ...(card.cover || {}),
        idAttachment: firstImage.id,
        color: null,
        size: "normal",
        brightness: "dark",
        yPosition: 0.5,
        idUploadedBackground: null,
        idPlugin: null
      };
    }

    touchCard(card);
    pushAction("addAttachmentToCard", {
      idCard: card.id,
      card: cardActionSnapshot(card),
      attachment: {
        id: attachments[0].id,
        name: attachments.length === 1 ? attachments[0].name : `${attachments.length} files`
      },
      list: { id: card.idList, name: listById(card.idList)?.name || "" }
    });
    queueSave("Attachment added");
    render();
    if (cardDialog.open && state.selectedCardId === card.id) {
      renderCardDialog();
    }
  } catch (error) {
    setSaveMessage(error.message || "Upload failed.");
    await openMessageDialog({
      label: "Upload",
      title: "Upload failed",
      message: error.message || "Upload failed."
    });
  }
}

async function importBoardFromFile(file) {
  if ((state.board?.cards || []).length > 0) {
    await openMessageDialog({
      label: "Import",
      title: "Import unavailable",
      message: "Import is only available when the board has no cards."
    });
    return;
  }

  const confirmed = await openConfirmDialog({
    label: "Import",
    title: "Import board JSON?",
    message: "This will replace the current empty board with the imported board.",
    confirmLabel: "Import",
    cancelLabel: "Cancel"
  });
  if (!confirmed) return;

  setSaveMessage("Importing board…");
  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Import failed.");
    }

    state.board = payload;
    state.selectedCardId = null;
    state.descriptionEditing = false;
    settingsDialog.close();
    setSaveMessage("Board imported");
    render();
  } catch (error) {
    setSaveMessage(error.message || "Import failed.");
    await openMessageDialog({
      label: "Import",
      title: "Import failed",
      message: error.message || "Import failed."
    });
  }
}

function removeCoverFromSelectedCard(event) {
  event?.stopPropagation();
  const card = getSelectedCard();
  if (!card?.cover?.idAttachment) return;

  card.cover = {
    ...(card.cover || {}),
    idAttachment: null,
    color: null,
    idUploadedBackground: null,
    size: "normal",
    brightness: "dark",
    yPosition: 0.5,
    idPlugin: null
  };
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { cover: true },
    cover: false
  });
  queueSave("Cover removed");
  render();
}

function setAttachmentAsCover(cardId, attachmentId) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId && !candidate.closed);
  const attachment = card?.attachments?.find((candidate) => candidate.id === attachmentId);
  if (!card || !attachment || !isImageAttachment(attachment)) return;

  card.cover = {
    ...(card.cover || {}),
    idAttachment: attachment.id,
    color: null,
    idUploadedBackground: null,
    size: "normal",
    brightness: "dark",
    yPosition: 0.5,
    idPlugin: null
  };
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    cover: true
  });
  queueSave("Cover updated");
  render();
}

function toggleCardDone(card) {
  const wasDone = isCardDone(card);
  card.kanbanQubeDone = !wasDone;
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { kanbanQubeDone: wasDone },
    kanbanQubeDone: card.kanbanQubeDone
  });
  queueSave(card.kanbanQubeDone ? "Card marked done" : "Card marked not done");
  render();
}

function archiveCard(card) {
  if (!isCardDone(card) || isCardArchived(card)) return;
  card.closed = true;
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { closed: false },
    closed: true
  });
  queueSave("Card archived");
  render();
}

function restoreArchivedCard(cardId) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId);
  if (!card || !isCardArchived(card)) return;
  card.closed = false;
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { closed: true },
    closed: false
  });
  queueSave("Card restored");
  render();
}

async function deleteArchivedCard(cardId) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId);
  if (!card || !isCardArchived(card)) return;
  const confirmed = await openConfirmDialog({
    label: "Delete card",
    title: "Delete archived card?",
    message: `Delete "${card.name || "Task"}" permanently? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return;
  removeCardCompletely(card.id);
  queueSave("Archived card deleted");
  render();
}

async function deleteLane(listId) {
  const list = listById(listId);
  if (!list) return;
  const cardCount = allCardsForList(listId).length;
  const confirmed = await openConfirmDialog({
    label: "Delete lane",
    title: "Delete lane?",
    message: `Delete "${list.name}" and archive ${cardCount} card(s) in it?`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return;

  list.closed = true;
  list.dateClosed = new Date().toISOString();
  for (const card of allCardsForList(listId)) {
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

async function deleteSelectedCard() {
  const card = getSelectedCard();
  if (!card) return;
  const confirmed = await openConfirmDialog({
    label: "Delete card",
    title: "Delete card?",
    message: `Delete "${card.name || "Task"}" permanently? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return;
  removeCardCompletely(card.id);
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
      appendFormattedLine(node, line);
      if (index < lines.length - 1) {
        node.append(document.createElement("br"));
      }
    });

    fragment.append(node);
  }

  cardDescriptionDisplay.append(fragment);
}

function appendFormattedLine(container, text) {
  const imageMatch = text.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)$/);
  if (!imageMatch) {
    appendFormattedText(container, text);
    return;
  }

  const image = createSafeImage(imageMatch[2], unescapeMarkdownText(imageMatch[1]), imageMatch[3] || "");
  if (image) {
    container.append(image);
    return;
  }

  appendFormattedText(container, text);
}

function appendFormattedText(container, text) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)|\[([^\]|]+)\|(https?:\/\/[^\s\]]+)\]|\[(https?:\/\/[^\s\]]+)\]|(https?:\/\/[^\s<\]]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const label = match[1];
    const trelloLabel = match[4];
    const href = match[2] || match[5] || match[6] || match[7];
    const title = match[3] || "";
    const link = createSafeLink(label || trelloLabel || href, href, title);

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

function createSafeImage(href, alt = "", title = "") {
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
  link.className = "description-image-link";
  link.href = parsedUrl.toString();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (title) link.title = title;

  const image = document.createElement("img");
  image.className = "description-image";
  image.src = parsedUrl.toString();
  image.alt = alt || title || "Attached image";
  image.loading = "lazy";
  image.decoding = "async";
  if (title) image.title = title;

  link.append(image);
  return link;
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

function unescapeMarkdownText(text) {
  return String(text).replace(/\\([\\`*_[\]{}()#+\-.!|>])/g, "$1");
}

function saveSettings() {
  const nextBoardName = settingsBoardName.value.trim() || "KanbanQube Board";
  const nextIconStyle = settingsIconStyleInputs.find((input) => input.checked)?.value === "flat" ? "flat" : "3d";
  const nextShowCardDescriptions = settingsShowCardDescriptions.checked;
  const nextInlineCardTitleEdit = settingsInlineCardTitleEdit.checked;
  let didPersistLocalSetting = false;

  if (state.iconStyle !== nextIconStyle) {
    state.iconStyle = nextIconStyle;
    localStorage.setItem(ICON_STYLE_STORAGE_KEY, nextIconStyle);
    applyIconStyle();
    didPersistLocalSetting = true;
  }

  if (state.showCardDescriptions !== nextShowCardDescriptions) {
    state.showCardDescriptions = nextShowCardDescriptions;
    localStorage.setItem(SHOW_CARD_DESCRIPTIONS_STORAGE_KEY, String(nextShowCardDescriptions));
    didPersistLocalSetting = true;
  }

  if (state.inlineCardTitleEdit !== nextInlineCardTitleEdit) {
    state.inlineCardTitleEdit = nextInlineCardTitleEdit;
    localStorage.setItem(INLINE_CARD_TITLE_EDIT_STORAGE_KEY, String(nextInlineCardTitleEdit));
    if (!nextInlineCardTitleEdit) {
      state.editingCardTitleId = null;
      state.editingCardTitleValue = "";
    }
    didPersistLocalSetting = true;
  }

  if (state.board.name !== nextBoardName) {
    updateBoardName(nextBoardName, "Settings saved");
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
  for (const input of settingsIconStyleInputs) {
    input.checked = input.value === state.iconStyle;
  }
  settingsShowCardDescriptions.checked = state.showCardDescriptions;
  settingsInlineCardTitleEdit.checked = state.inlineCardTitleEdit;
  const canImport = (state.board?.cards || []).length === 0;
  importBoardButton.disabled = !canImport;
  settingsImportHelp.textContent = canImport
    ? "Import is available because this board has no cards."
    : "Import is disabled because this board already has cards.";

  if (!settingsDialog.open) {
    settingsDialog.showModal();
  }
  settingsBoardName.focus();
}

function startBoardTitleEdit() {
  state.editingBoardTitle = true;
  state.editingBoardTitleValue = state.board?.name || "";
  renderHeader();
  focusInlineInput(boardTitleInlineInput);
}

function commitBoardTitleEdit() {
  if (!state.editingBoardTitle) return;
  const nextBoardName = state.editingBoardTitleValue.trim() || "KanbanQube Board";
  state.editingBoardTitle = false;
  state.editingBoardTitleValue = "";
  if (state.board.name !== nextBoardName) {
    updateBoardName(nextBoardName, "Board updated");
  } else {
    renderHeader();
  }
}

function cancelBoardTitleEdit() {
  state.editingBoardTitle = false;
  state.editingBoardTitleValue = "";
  renderHeader();
}

function startLaneTitleEdit(listId) {
  const list = listById(listId);
  if (!list) return;
  state.editingLaneTitleId = listId;
  state.editingLaneTitleValue = list.name || "";
  renderBoard();
  focusInlineInput(document.querySelector(`.lane[data-list-id="${listId}"] .lane-title-inline-input`));
}

function commitLaneTitleEdit(listId) {
  if (state.editingLaneTitleId !== listId) return;
  const list = listById(listId);
  if (!list) {
    cancelLaneTitleEdit();
    return;
  }

  const nextName = state.editingLaneTitleValue.trim() || "Lane";
  state.editingLaneTitleId = null;
  state.editingLaneTitleValue = "";

  if (list.name !== nextName) {
    list.name = nextName;
    pushAction("updateList", {
      list: { id: list.id, name: list.name },
      board: { id: state.board.id, name: state.board.name }
    });
    queueSave("Lane renamed");
    render();
    return;
  }

  renderBoard();
}

function cancelLaneTitleEdit() {
  state.editingLaneTitleId = null;
  state.editingLaneTitleValue = "";
  renderBoard();
}

function startCardTitleEdit(cardId) {
  if (!state.inlineCardTitleEdit) return;
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId && !candidate.closed);
  if (!card) return;
  state.editingCardTitleId = cardId;
  state.editingCardTitleValue = card.name || "";
  renderBoard();
  focusInlineInput(document.querySelector(`.card[data-card-id="${cardId}"] .card-title-inline-input`));
}

function commitCardTitleEdit(cardId) {
  if (state.editingCardTitleId !== cardId) return;
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId && !candidate.closed);
  if (!card) {
    cancelCardTitleEdit();
    return;
  }

  const nextName = state.editingCardTitleValue.trim();
  state.editingCardTitleId = null;
  state.editingCardTitleValue = "";

  if (card.name !== nextName) {
    card.name = nextName;
    touchCard(card);
    queueSave("Card updated");
    renderBoard();
    if (archiveDialog.open) {
      renderArchiveDialog();
    }
    return;
  }

  renderBoard();
}

function cancelCardTitleEdit() {
  state.editingCardTitleId = null;
  state.editingCardTitleValue = "";
  renderBoard();
}

function focusInlineInput(input) {
  if (!input) return;
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

function updateBoardName(name, saveMessage) {
  state.board.name = name;
  pushAction("updateBoard", {
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave(saveMessage);
  render();
}

async function syncBoard() {
  if (!state.config?.gitRemote) {
    await openMessageDialog({
      label: "Git sync",
      title: "Git remote not configured",
      message: "Add a Git remote before syncing this board."
    });
    return;
  }

  state.isSyncing = true;
  state.syncStatusMessage = "Syncing with git…";
  state.lastSyncLog = "Syncing with git…";
  state.lastSyncAt = new Date().toISOString();
  setSaveMessage("Syncing with git…");
  startSyncStatusPolling();
  openSyncLogDialog();
  try {
    if (state.isSaving) {
      await saveBoardNow();
    }

    const response = await fetch("/api/sync", { method: "POST" });
    const payload = await response.json();
    state.lastSyncLog = payload.output || "No sync output was returned.";
    state.lastSyncAt = payload.startedAt || state.lastSyncAt;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.output || "Git sync failed.");
    }
    state.syncStatusMessage = "Board synced";
    setSaveMessage("Board synced");
  } catch (error) {
    state.syncStatusMessage = error.message || "Git sync failed.";
    state.lastSyncLog = error.message || "Git sync failed.";
    setSaveMessage(error.message || "Git sync failed.");
    await openMessageDialog({
      label: "Git sync",
      title: "Sync failed",
      message: error.message || "Git sync failed."
    });
  } finally {
    stopSyncStatusPolling();
    state.isSyncing = false;
    renderHeader();
    renderSyncLogDialogContent();
  }
}

function openSyncLogDialog() {
  if (!state.isSyncing && !state.lastSyncLog.trim()) return;
  renderSyncLogDialogContent();
  if (!syncLogDialog.open) {
    syncLogDialog.showModal();
  }
}

function renderSyncLogDialogContent() {
  syncLogContent.textContent = state.lastSyncLog || "No git sync has run yet.";
  syncLogTimestamp.textContent = state.lastSyncAt
    ? `Ran ${formatSyncTimestamp(state.lastSyncAt)}`
    : "No git sync has run yet.";
  syncLogCloseButton.disabled = state.isSyncing;
  syncLogCloseButton.textContent = state.isSyncing ? "Sync in progress..." : "Close";
  closeSyncLogButton.disabled = state.isSyncing;
}

function formatSyncTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown time";
  const parts = new Intl.DateTimeFormat(undefined, SYNC_TIMESTAMP_FORMAT).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "";
  const minute = parts.find((part) => part.type === "minute")?.value || "";
  const second = parts.find((part) => part.type === "second")?.value || "";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value || "";
  return `${month} ${day} ${year}, ${hour}:${minute}:${second} ${dayPeriod}`.trim();
}

function startSyncStatusPolling() {
  stopSyncStatusPolling();
  syncStatusPollTimer = window.setInterval(() => {
    void refreshSyncStatus();
  }, 500);
}

function stopSyncStatusPolling() {
  if (syncStatusPollTimer !== null) {
    window.clearInterval(syncStatusPollTimer);
    syncStatusPollTimer = null;
  }
}

async function refreshSyncStatus() {
  if (syncStatusPollInFlight) return;
  syncStatusPollInFlight = true;
  try {
    const response = await fetch("/api/sync-status");
    if (!response.ok) return;
    const payload = await response.json();
    state.lastSyncLog = payload.output || state.lastSyncLog;
    state.lastSyncAt = payload.startedAt || state.lastSyncAt;
    if (syncLogDialog.open) {
      renderSyncLogDialogContent();
    }
  } finally {
    syncStatusPollInFlight = false;
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
  return openCardsForList(listId).sort((left, right) => left.pos - right.pos);
}

function openCardsForList(listId) {
  return [...(state.board?.cards || [])]
    .filter((card) => !card.closed && card.idList === listId);
}

function allCardsForList(listId) {
  return [...(state.board?.cards || [])].filter((card) => card.idList === listId);
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
  return (state.board?.cards || []).find((card) => card.id === state.selectedCardId) || null;
}

function isCardDone(card) {
  return Boolean(card?.kanbanQubeDone);
}

function isCardArchived(card) {
  return Boolean(card?.closed);
}

function archivedCards() {
  return [...(state.board?.cards || [])]
    .filter((card) => isCardArchived(card))
    .sort((left, right) => {
      const leftDate = Date.parse(left.dateLastActivity || 0);
      const rightDate = Date.parse(right.dateLastActivity || 0);
      return rightDate - leftDate;
    });
}

function nextLanePos() {
  const lists = openLists();
  return lists.length ? Math.max(...lists.map((list) => Number(list.pos) || 0)) + 16384 : 16384;
}

function nextCardPos(listId) {
  const cards = openCardsForList(listId);
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
    if (event.target.closest("button, input, textarea, select")) return;
    state.drag = { type: "lane", listId: laneNode.dataset.listId };
    laneNode.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  laneNode.addEventListener("dragend", () => {
    laneNode.classList.remove("dragging");
  });
}

function eventHasFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

function handleAttachmentDragOver(event) {
  if (!eventHasFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = "copy";
  attachmentDropZone.classList.add("is-dragging");
}

function handleAttachmentDragLeave(event) {
  if (!eventHasFiles(event)) return;
  if (event.currentTarget === cardDialog && cardDialog.contains(event.relatedTarget)) return;
  attachmentDropZone.classList.remove("is-dragging");
}

function handleAttachmentDrop(event) {
  if (!eventHasFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  attachmentDropZone.classList.remove("is-dragging");
  uploadFilesToSelectedCard([...event.dataTransfer.files]);
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
  if (card.badges?.description) badges.push({ icon: "description", text: "" });
  if (card.badges?.comments) badges.push({ icon: "comment", text: String(card.badges.comments) });
  if (card.badges?.checkItems) badges.push({ icon: "checklist", text: `${card.badges.checkItemsChecked || 0}/${card.badges.checkItems}` });
  if (card.attachments?.length) badges.push({ icon: "attachment", text: String(card.attachments.length) });
  return badges;
}

function createIcon(name) {
  const paths = {
    description: ["M4 6h16M4 12h12M4 18h9"],
    comment: ["M5 5.5h14v9H8.5L5 18V5.5Z"],
    checklist: ["M9 7h11M9 12h11M9 17h11M4 7.2l1.2 1.2L7.5 6M4 12.2l1.2 1.2 2.3-2.4M4 17.2l1.2 1.2 2.3-2.4"],
    attachment: ["M8.5 12.5 14.8 6.2a3 3 0 0 1 4.2 4.2l-7.8 7.8a5 5 0 0 1-7.1-7.1l7.5-7.5"],
    trash: ["M3 6h18m-2 0-.9 13.15A2 2 0 0 1 16.1 21H7.9a2 2 0 0 1-2-1.85L5 6m3 0V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6m-6 4v7m4-7v7"],
    file: ["M7 3h7l4 4v14H7V3Zm7 0v5h5"],
    image: ["M4 5h16v14H4V5Zm3 10 3.2-3.2 2.3 2.3 2.1-2.1L19 16.4M8.5 9.5h.01"]
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const value of paths[name] || paths.description) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", value);
    svg.append(path);
  }
  return svg;
}

function coverUrlForCard(card) {
  const attachmentId = card.cover?.idAttachment;
  if (!attachmentId || !Array.isArray(card.attachments)) return "";
  const match = card.attachments.find((attachment) => attachment.id === attachmentId);
  return match?.url || match?.previewUrl || "";
}

function isImageAttachment(attachment) {
  const mimeType = String(attachment?.mimeType || "").toLowerCase();
  const name = String(attachment?.name || attachment?.url || "").toLowerCase();
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
}

function formatAttachmentMeta(attachment) {
  const parts = [];
  if (Number.isFinite(attachment.bytes)) {
    parts.push(formatBytes(attachment.bytes));
  }
  if (attachment.mimeType) {
    parts.push(attachment.mimeType);
  }
  return parts.join(" · ") || "Uploaded file";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
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
    deleteCard: "deleted this card",
    updateCard: "updated this card",
    updateBoard: "updated the board",
    createList: "created a lane",
    updateList: "updated a lane",
    updateCheckItemStateOnCard: "updated a checklist item",
    addAttachmentToCard: "attached a file to this card",
    commentCard: "commented on this card"
  };
  return `${actor} ${verbs[action.type] || action.type}`;
}

function migrateLegacyBoardData() {
  let changed = false;
  for (const card of state.board?.cards || []) {
    if (card.kanbanQubeArchived) {
      if (!card.closed) {
        card.closed = true;
      }
      delete card.kanbanQubeArchived;
      changed = true;
    }
  }
  return changed;
}

function removeCardCompletely(cardId) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId);
  if (!card) return;
  touchCard(card);
  state.board.actions = (state.board.actions || []).filter((action) => {
    const targetCardId = action?.data?.idCard || action?.data?.card?.id;
    return targetCardId !== cardId;
  });
  pushAction("deleteCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" }
  });
  state.board.cards = (state.board.cards || []).filter((candidate) => candidate.id !== cardId);
  state.board.checklists = (state.board.checklists || []).filter((checklist) => checklist.idCard !== cardId);
}

function openArchiveDialog() {
  renderArchiveDialog();
  if (!archiveDialog.open) {
    archiveDialog.showModal();
  }
}

function openArchivedCard(cardId) {
  archiveDialog.close();
  openCard(cardId);
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

function openMessageDialog({ label = "Notice", title = "Notice", message = "", confirmLabel = "OK" }) {
  return openAppDialog({
    label,
    title,
    message,
    confirmLabel,
    cancelLabel: "",
    danger: false
  });
}

function openConfirmDialog({ label = "Confirm", title = "Are you sure?", message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
  return openAppDialog({
    label,
    title,
    message,
    confirmLabel,
    cancelLabel,
    danger
  });
}

function openAppDialog({ label, title, message, confirmLabel, cancelLabel, danger }) {
  appDialogLabel.textContent = label;
  appDialogTitle.textContent = title;
  appDialogMessage.textContent = message;
  appDialogCancelButton.hidden = !cancelLabel;
  appDialogCancelButton.textContent = cancelLabel || "Cancel";
  appDialogConfirmButton.textContent = confirmLabel;
  appDialogConfirmButton.className = danger ? "danger-button" : "primary-button";
  appDialog.returnValue = "";

  if (!appDialog.open) {
    appDialog.showModal();
  }

  return new Promise((resolve) => {
    const handleClose = () => {
      appDialog.removeEventListener("close", handleClose);
      resolve(appDialog.returnValue === "confirm");
    };
    appDialog.addEventListener("close", handleClose);
  });
}
