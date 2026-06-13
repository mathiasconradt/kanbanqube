"use strict";

const USER_STORAGE_KEY = "kanbanqube.userName";
const USER_EMAIL_STORAGE_KEY = "kanbanqube.userEmail";
const SHOW_CARD_DESCRIPTIONS_STORAGE_KEY = "kanbanqube.showCardDescriptions";
const INLINE_CARD_TITLE_EDIT_STORAGE_KEY = "kanbanqube.inlineCardTitleEdit";
const GIT_SYNC_IN_BACKGROUND_STORAGE_KEY = "kanbanqube.gitSyncInBackground";
const ICON_STYLE_STORAGE_KEY = "kanbanqube.iconStyle";
const LANE_WIDTH_STORAGE_KEY = "kanbanqube.laneWidth";
const LANE_DEFAULT_WIDTH = 270;
const LANE_MAX_WIDTH = LANE_DEFAULT_WIDTH * 2;
const ICON_PATHS = {
  "3d": "/icon_3d.png",
  flat: "/icon_flat.png"
};
const DEMO_BOARD_PATH = "/demo_board.json";
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
  users: [],
  currentUserName: localStorage.getItem(USER_STORAGE_KEY) || "",
  currentUserEmail: localStorage.getItem(USER_EMAIL_STORAGE_KEY) || "",
  showCardDescriptions: localStorage.getItem(SHOW_CARD_DESCRIPTIONS_STORAGE_KEY) === "true",
  inlineCardTitleEdit: localStorage.getItem(INLINE_CARD_TITLE_EDIT_STORAGE_KEY) === "true",
  gitSyncInBackground: localStorage.getItem(GIT_SYNC_IN_BACKGROUND_STORAGE_KEY) === "true",
  iconStyle: localStorage.getItem(ICON_STYLE_STORAGE_KEY) === "flat" ? "flat" : "3d",
  searchTerm: "",
  labelSearchTerm: "",
  labelEditorOpen: false,
  descriptionEditing: false,
  selectedCardId: null,
  keyboardCardId: null,
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
  pendingNewCardIds: new Set(),
  drag: null,
  laneResize: null,
  laneWidth: laneWidthFromStorage()
};

const boardScroller = document.getElementById("boardScroller");
const aboutButton = document.getElementById("aboutButton");
const brandIcon = aboutButton.querySelector("img");
const aboutDialog = document.getElementById("aboutDialog");
const aboutImage = document.getElementById("aboutImage");
const faviconLink = document.getElementById("faviconLink");
const boardTitle = document.getElementById("boardTitle");
const boardTitleInlineInput = document.getElementById("boardTitleInlineInput");
const searchInput = document.getElementById("searchInput");
const saveStatus = document.getElementById("saveStatus");
const syncButton = document.getElementById("syncButton");
const archiveButton = document.getElementById("archiveButton");
const settingsButton = document.getElementById("settingsButton");
const userAvatarButton = document.getElementById("userAvatarButton");
const userAvatarImage = document.getElementById("userAvatarImage");
const userAvatarFallback = document.getElementById("userAvatarFallback");
const syncLogDialog = document.getElementById("syncLogDialog");
const syncLogContent = document.getElementById("syncLogContent");
const syncLogTimestamp = document.getElementById("syncLogTimestamp");
const closeSyncLogButton = document.getElementById("closeSyncLogButton");
const syncLogCloseButton = document.getElementById("syncLogCloseButton");
const archiveDialog = document.getElementById("archiveDialog");
const archiveList = document.getElementById("archiveList");
const closeArchiveButton = document.getElementById("closeArchiveButton");
const deleteAllArchivedButton = document.getElementById("deleteAllArchivedButton");

const cardDialog = document.getElementById("cardDialog");
const cardTitleInput = document.getElementById("cardTitleInput");
const cardDueInput = document.getElementById("cardDueInput");
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
const assigneesContainer = document.getElementById("assigneesContainer");
const cardLabels = document.getElementById("cardLabels");
const labelEditorContainer = document.getElementById("labelEditorContainer");
const activityList = document.getElementById("activityList");
const addLabelButton = document.getElementById("addLabelButton");
const commentInput = document.getElementById("commentInput");
const addCommentButton = document.getElementById("addCommentButton");
const addChecklistButton = document.getElementById("addChecklistButton");
const archiveCardButton = document.getElementById("archiveCardButton");
const deleteCardButton = document.getElementById("deleteCardButton");
const closeCardButton = document.getElementById("closeCardButton");

const settingsDialog = document.getElementById("settingsDialog");
const settingsIconStyleInputs = [...document.querySelectorAll("input[name=\"settingsIconStyle\"]")];
const settingsShowCardDescriptions = document.getElementById("settingsShowCardDescriptions");
const settingsInlineCardTitleEdit = document.getElementById("settingsInlineCardTitleEdit");
const settingsGitSyncInBackground = document.getElementById("settingsGitSyncInBackground");
const importBoardInput = document.getElementById("importBoardInput");
const importBoardButton = document.getElementById("importBoardButton");
const settingsImportHelp = document.getElementById("settingsImportHelp");
const settingsUser = document.getElementById("settingsUser");
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

const laneColorOptions = [
  { id: "red", swatch: "#ff5630", background: "#5a1f1f" },
  { id: "orange", swatch: "#f97316", background: "#5a3715" },
  { id: "yellow", swatch: "#f59e0b", background: "#4b3b04" },
  { id: "green", swatch: "#34d399", background: "#15543a" },
  { id: "cyan", swatch: "#22b8cf", background: "#0e4a5e" },
  { id: "blue", swatch: "#0c66e4", background: "#123f8c" },
  { id: "indigo", swatch: "#4f46e5", background: "#312e81" },
  { id: "purple", swatch: "#6750c3", background: "#3f2a83" },
  { id: "lime", swatch: "#84cc16", background: "#365314" },
  { id: "pink", swatch: "#ff4fa3", background: "#641b45" },
  { id: "slate", swatch: "#64748b", background: "#3a465d" }
];

const laneColorPicker = document.createElement("div");
laneColorPicker.className = "lane-color-picker";
laneColorPicker.hidden = true;
document.body.append(laneColorPicker);
applyLaneWidth();

try {
  await bootstrap();
} catch (error) {
  setSaveMessage(error.message || "Could not load the board.");
}

async function bootstrap() {
  const [boardResponse, configResponse, usersResponse] = await Promise.all([
    fetch("/api/board"),
    fetch("/api/config"),
    fetch("/api/users")
  ]);

  if (!boardResponse.ok) {
    throw new Error("Could not load board data.");
  }

  state.board = await boardResponse.json();
  state.config = configResponse.ok ? await configResponse.json() : { boardFile: "board.json", gitRemote: null, gitUserName: null, gitUserEmail: null };
  state.users = usersResponse.ok ? (await usersResponse.json()).users || [] : [];
  hydrateIdentityFromGitConfig();
  applyIconStyle();
  settingsUser.textContent = userMetaText();
  settingsBoardFile.textContent = `Storage: ${state.config.workspacePath || "current folder"}`;
  settingsRemote.textContent = state.config.gitRemote ? `Remote: ${state.config.gitRemote}` : "Remote: not configured";

  wireEvents();
  if (migrateLegacyBoardData()) {
    setSaveMessage("Updating board format…");
    await saveBoardNow();
  } else {
    setSaveMessage("Ready");
  }
  render();
  await maybeOfferDemoBoard();
}

async function maybeOfferDemoBoard() {
  if (!isBoardEmpty()) return;
  const confirmed = await openConfirmDialog({
    label: "Demo board",
    title: "Load demo board?",
    message: "This board is empty. Load a sample e-commerce product board with realistic cards?",
    confirmLabel: "Load demo",
    cancelLabel: "Keep empty"
  });
  if (!confirmed || !isBoardEmpty()) return;

  setSaveMessage("Loading demo board...");
  state.board = await loadDemoBoard();
  render();
  await saveBoardNow();
  setSaveMessage("Demo board loaded");
  render();
}

function isBoardEmpty() {
  return (state.board?.cards || []).length === 0;
}

async function loadDemoBoard() {
  const response = await fetch("/api/demo-board", {
    method: "POST"
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load demo board.");
  }
  return payload;
}

function wireEvents() {
  aboutButton.addEventListener("click", openAboutDialog);
  aboutDialog.addEventListener("click", (event) => {
    if (event.target === aboutDialog) {
      aboutDialog.close();
    }
  });
  aboutImage.addEventListener("click", () => aboutDialog.close());
  document.addEventListener("keydown", handleBoardKeyboardNavigation);
  document.addEventListener("keydown", closeLaneColorPickerOnEscape);
  document.addEventListener("click", closeLaneColorPickerOnOutsideClick);

  searchInput.addEventListener("input", () => {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    renderBoard();
  });

  settingsButton.addEventListener("click", openSettingsDialog);
  userAvatarImage.addEventListener("error", () => {
    userAvatarImage.hidden = true;
    userAvatarFallback.hidden = false;
  });
  archiveButton.addEventListener("click", openArchiveDialog);
  boardTitle.addEventListener("click", startBoardTitleEdit);
  closeSettingsButton.addEventListener("click", () => settingsDialog.close());
  closeArchiveButton.addEventListener("click", () => archiveDialog.close());
  deleteAllArchivedButton.addEventListener("click", deleteAllArchivedCards);
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
  boardScroller.addEventListener("dragover", handleLaneDragOver);
  boardScroller.addEventListener("drop", handleLaneDrop);

  closeCardButton.addEventListener("click", () => cardDialog.close());
  cardDialog.addEventListener("click", closeCardDialogOnBackdropClick);
  removeCoverButton.addEventListener("click", removeCoverFromSelectedCard);
  archiveCardButton.addEventListener("click", archiveSelectedCard);
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
  cardDueInput.addEventListener("change", updateSelectedCardDueDate);

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

function closeCardDialogOnBackdropClick(event) {
  if (event.target === cardDialog) {
    cardDialog.close();
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
  renderUserAvatar();
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
    applyLaneColor(laneNode, list);
    laneNode.classList.toggle("is-collapsed", isLaneCollapsed(list));
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
    for (const [cardIndex, card] of cards.entries()) {
      const cardNode = renderCard(card, { labelTooltipBelow: cardIndex === 0 });
      cardList.append(cardNode);
    }

    laneNode.querySelector(".add-card-button").addEventListener("click", () => addCard(list.id));
    wireLaneCollapseButton(laneNode.querySelector(".lane-collapse-button"), list);
    wireLaneColorButton(laneNode.querySelector(".lane-color-button"), list);
    wireLaneResizeHandle(laneNode.querySelector(".lane-resize-handle"));
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

function applyLaneColor(laneNode, list) {
  const color = laneColorForList(list);
  laneNode.style.removeProperty("--lane-background");
  laneNode.style.removeProperty("--lane-border-color");
  laneNode.classList.toggle("has-lane-color", Boolean(color));
  if (!color) return;
  laneNode.style.setProperty("--lane-background", color.background);
  laneNode.style.setProperty("--lane-border-color", color.swatch);
}

function wireLaneResizeHandle(handle) {
  handle.addEventListener("pointerdown", startLaneResize);
  handle.addEventListener("keydown", resizeLanesWithKeyboard);
}

function startLaneResize(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  state.laneResize = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: state.laneWidth
  };
  document.body.classList.add("is-resizing-lane");
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener("pointermove", resizeLanes);
  event.currentTarget.addEventListener("pointerup", stopLaneResize, { once: true });
  event.currentTarget.addEventListener("pointercancel", stopLaneResize, { once: true });
}

function resizeLanes(event) {
  if (!state.laneResize || event.pointerId !== state.laneResize.pointerId) return;
  state.laneWidth = clampLaneWidth(state.laneResize.startWidth + event.clientX - state.laneResize.startX);
  applyLaneWidth();
}

function stopLaneResize(event) {
  event.currentTarget.removeEventListener("pointermove", resizeLanes);
  document.body.classList.remove("is-resizing-lane");
  if (state.laneResize && event.pointerId === state.laneResize.pointerId) {
    localStorage.setItem(LANE_WIDTH_STORAGE_KEY, String(state.laneWidth));
  }
  state.laneResize = null;
}

function resizeLanesWithKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") {
    state.laneWidth = LANE_DEFAULT_WIDTH;
  } else if (event.key === "End") {
    state.laneWidth = LANE_MAX_WIDTH;
  } else {
    state.laneWidth = clampLaneWidth(state.laneWidth + (event.key === "ArrowRight" ? 12 : -12));
  }
  applyLaneWidth();
  localStorage.setItem(LANE_WIDTH_STORAGE_KEY, String(state.laneWidth));
}

function applyLaneWidth() {
  document.documentElement.style.setProperty("--lane-width", `${state.laneWidth}px`);
}

function laneWidthFromStorage() {
  return clampLaneWidth(Number(localStorage.getItem(LANE_WIDTH_STORAGE_KEY)) || LANE_DEFAULT_WIDTH);
}

function clampLaneWidth(width) {
  return Math.min(LANE_MAX_WIDTH, Math.max(LANE_DEFAULT_WIDTH, Math.round(width)));
}

function wireLaneCollapseButton(button, list) {
  const collapsed = isLaneCollapsed(list);
  button.setAttribute("aria-label", collapsed ? "Expand lane" : "Collapse lane");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.dataset.tooltip = collapsed ? "Expand" : "Collapse";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLaneCollapsed(list.id);
  });
}

function toggleLaneCollapsed(listId) {
  const list = listById(listId);
  if (!list) return;
  const wasCollapsed = isLaneCollapsed(list);
  list.kanbanQubeCollapsed = !wasCollapsed;
  pushAction("updateList", {
    list: { id: list.id, name: list.name, kanbanQubeCollapsed: list.kanbanQubeCollapsed },
    old: { kanbanQubeCollapsed: wasCollapsed },
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave(list.kanbanQubeCollapsed ? "Lane collapsed" : "Lane expanded");
  closeLaneColorPicker();
  renderBoard();
}

function isLaneCollapsed(list) {
  return Boolean(list?.kanbanQubeCollapsed);
}

function wireLaneColorButton(button, list) {
  const color = laneColorForList(list);
  button.classList.toggle("has-selected-color", Boolean(color));
  button.style.setProperty("--lane-color-swatch", color?.swatch || "transparent");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLaneColorPicker(list.id, button);
  });
}

function toggleLaneColorPicker(listId, anchor) {
  if (!laneColorPicker.hidden && laneColorPicker.dataset.listId === listId) {
    closeLaneColorPicker();
    return;
  }

  renderLaneColorPicker(listId);
  laneColorPicker.hidden = false;
  positionLaneColorPicker(anchor);
}

function renderLaneColorPicker(listId) {
  const list = listById(listId);
  const selectedColorId = laneColorForList(list)?.id || "";
  laneColorPicker.textContent = "";
  laneColorPicker.dataset.listId = listId;

  const clearButton = createLaneColorOptionButton({
    label: "Default lane color",
    selected: !selectedColorId,
    onClick: () => setLaneColor(listId, "")
  });
  clearButton.classList.add("lane-color-clear-button");
  clearButton.textContent = "×";
  laneColorPicker.append(clearButton);

  for (const color of laneColorOptions) {
    laneColorPicker.append(createLaneColorOptionButton({
      color,
      label: `Set ${color.id} lane color`,
      selected: selectedColorId === color.id,
      onClick: () => setLaneColor(listId, color.id)
    }));
  }
}

function createLaneColorOptionButton({ color = null, label, selected, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lane-color-option";
  button.setAttribute("aria-label", label);
  button.classList.toggle("is-selected", selected);
  if (color) {
    button.style.setProperty("--lane-color-option", color.swatch);
  }
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function positionLaneColorPicker(anchor) {
  const rect = anchor.getBoundingClientRect();
  const pickerRect = laneColorPicker.getBoundingClientRect();
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - pickerRect.width - 8);
  const top = Math.min(rect.bottom + 8, window.innerHeight - pickerRect.height - 8);
  laneColorPicker.style.left = `${left}px`;
  laneColorPicker.style.top = `${Math.max(8, top)}px`;
}

function closeLaneColorPicker() {
  laneColorPicker.hidden = true;
  laneColorPicker.dataset.listId = "";
}

function closeLaneColorPickerOnOutsideClick(event) {
  if (laneColorPicker.hidden) return;
  if (event.target.closest(".lane-color-picker, .lane-color-button")) return;
  closeLaneColorPicker();
}

function closeLaneColorPickerOnEscape(event) {
  if (event.key === "Escape") {
    closeLaneColorPicker();
  }
}

function setLaneColor(listId, colorId) {
  const list = listById(listId);
  if (!list) return;
  const previousColor = laneColorForList(list)?.id || "";
  if (previousColor === colorId) {
    closeLaneColorPicker();
    return;
  }

  if (colorId) {
    list.kanbanQubeColor = colorId;
  } else {
    delete list.kanbanQubeColor;
  }
  pushAction("updateList", {
    list: { id: list.id, name: list.name, kanbanQubeColor: list.kanbanQubeColor || null },
    old: { kanbanQubeColor: previousColor || null },
    board: { id: state.board.id, name: state.board.name }
  });
  queueSave(colorId ? "Lane color updated" : "Lane color removed");
  closeLaneColorPicker();
  renderBoard();
}

function laneColorForList(list) {
  const colorId = String(list?.kanbanQubeColor || "");
  return laneColorOptions.find((color) => color.id === colorId) || null;
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

function renderCard(card, options = {}) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  node.classList.toggle("is-done", isCardDone(card));
  node.classList.toggle("is-keyboard-selected", state.keyboardCardId === card.id);
  node.setAttribute("aria-selected", String(state.keyboardCardId === card.id));

  const cardLabelsStrip = node.querySelector(".card-label-strip");
  const labels = labelsForCard(card).slice(0, 4);
  for (const label of labels) {
    const labelNode = document.createElement("span");
    labelNode.className = "card-label";
    labelNode.style.background = colorForLabel(label.color);
    labelNode.title = label.name || label.color;
    labelNode.dataset.tooltip = label.name || label.color;
    labelNode.classList.toggle("tooltip-below", Boolean(options.labelTooltipBelow));
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
  archiveButton.addEventListener("click", (event) => {
    event.stopPropagation();
    archiveCard(card, { force: true });
  });

  const cardDeleteButton = node.querySelector(".card-delete-button");
  cardDeleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteBoardCard(card.id);
  });

  const titleNode = node.querySelector(".card-title");
  const titleInput = node.querySelector(".card-title-inline-input");
  const hasTitle = Boolean(card.name?.trim());
  const isEditingTitle = state.editingCardTitleId === card.id;
  titleNode.textContent = hasTitle ? card.name : "Task";
  titleNode.classList.toggle("is-placeholder", !hasTitle);
  titleNode.classList.toggle("is-done", done);
  titleNode.classList.toggle("is-inline-editable", state.inlineCardTitleEdit || isEditingTitle);
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
    if (badge.className) badgeNode.classList.add(badge.className);
    if (badge.symbol) {
      const symbol = document.createElement("span");
      symbol.className = "badge-symbol";
      symbol.textContent = badge.symbol;
      badgeNode.append(symbol);
    } else {
      badgeNode.append(createIcon(badge.icon));
    }
    if (badge.text) {
      const text = document.createElement("span");
      text.textContent = badge.text;
      badgeNode.append(text);
    }
    footer.append(badgeNode);
  }
  renderBoardCardAssignees(card, footer);

  node.addEventListener("click", () => {
    setKeyboardCard(card.id, true);
    openCard(card.id);
  });
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
  cardDueInput.value = dateInputValue(card.due);
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
  archiveCardButton.hidden = isCardArchived(card);

  renderAssignees(card);
  renderLabelsEditor(card);
  renderAttachments(card);
  renderChecklists(card);
  renderActivity(card);
}

function renderBoardCardAssignees(card, footer) {
  const users = assignedUsersForCard(card).slice(0, 4);
  if (users.length === 0) return;

  const list = document.createElement("div");
  list.className = "card-assignee-list";
  for (const user of users) {
    list.append(createUserAvatar(user, "small-user-avatar"));
  }
  footer.append(list);
}

function updateSelectedCardDueDate() {
  const card = getSelectedCard();
  if (!card) return;

  const previousDue = card.due ?? null;
  card.due = cardDueInput.value ? `${cardDueInput.value}T12:00:00.000Z` : null;
  card.dueComplete = card.due ? Boolean(card.dueComplete) : false;
  if (previousDue === card.due) return;

  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { due: previousDue },
    due: card.due
  });
  queueSave(card.due ? "Due date updated" : "Due date removed");
  renderBoard();
}

function renderAssignees(card) {
  assigneesContainer.textContent = "";
  if (state.users.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No Git users found yet.";
    assigneesContainer.append(empty);
    return;
  }

  card.kanbanQubeAssignees = Array.isArray(card.kanbanQubeAssignees) ? card.kanbanQubeAssignees : [];
  for (const user of state.users) {
    assigneesContainer.append(createAssigneeRow(card, user));
  }
}

function createAssigneeRow(card, user) {
  const row = document.createElement("label");
  row.className = "assignee-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = card.kanbanQubeAssignees.includes(user.id);
  checkbox.addEventListener("change", () => {
    toggleCardAssignee(card, user.id, checkbox.checked);
  });

  const text = document.createElement("span");
  text.className = "assignee-name";
  text.textContent = user.email ? `${user.name || user.email} (${user.email})` : user.name || "Unknown user";

  row.append(checkbox, createUserAvatar(user, "assignee-avatar"), text);
  return row;
}

function toggleCardAssignee(card, userId, shouldAssign) {
  const previousAssignees = Array.isArray(card.kanbanQubeAssignees) ? card.kanbanQubeAssignees : [];
  card.kanbanQubeAssignees = shouldAssign
    ? [...new Set([...previousAssignees, userId])]
    : previousAssignees.filter((candidate) => candidate !== userId);
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    old: { kanbanQubeAssignees: previousAssignees },
    kanbanQubeAssignees: card.kanbanQubeAssignees
  });
  queueSave("Assignees updated");
  renderBoard();
}

function createUserAvatar(user, className) {
  const avatar = document.createElement("span");
  avatar.className = className;
  avatar.dataset.tooltip = user.email ? `${user.name} <${user.email}>` : user.name;

  const image = document.createElement("img");
  image.alt = "";
  image.hidden = !user.avatarUrl;
  if (user.avatarUrl) image.src = user.avatarUrl;

  const fallback = document.createElement("span");
  fallback.textContent = user.initials || initialsFor(user.name || user.email || "User");
  fallback.hidden = Boolean(user.avatarUrl);

  image.addEventListener("error", () => {
    image.hidden = true;
    fallback.hidden = false;
  });

  avatar.append(image, fallback);
  return avatar;
}

function renderArchiveDialog() {
  archiveList.textContent = "";
  const cards = archivedCards();
  deleteAllArchivedButton.disabled = cards.length === 0;
  deleteAllArchivedButton.hidden = cards.length === 0;

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
    title.textContent = card.name?.trim() || "Task";
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
  renderLabelSummary(card);

  addLabelButton.textContent = state.labelEditorOpen ? "×" : "+";
  addLabelButton.setAttribute("aria-label", state.labelEditorOpen ? "Close labels panel" : "Open labels panel");
  if (!state.labelEditorOpen) return;

  appendLabelEditorPanel(createLabelEditorPanel(card));
}

function renderLabelSummary(card) {
  const assignedLabels = labelsForCard(card);
  if (assignedLabels.length === 0) {
    if (!state.labelEditorOpen) {
      cardLabels.append(createEmptyLabelSummary());
    }
    return;
  }

  for (const label of assignedLabels) {
    cardLabels.append(createLabelPill(label));
  }
}

function createEmptyLabelSummary() {
  const empty = document.createElement("div");
  empty.className = "empty-state label-summary-trigger";
  empty.textContent = "No labels assigned.";
  empty.addEventListener("click", openLabelEditor);
  return empty;
}

function createLabelPill(label) {
  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "label-pill";
  pill.textContent = label.name || label.color;
  pill.style.background = colorForLabel(label.color);
  pill.addEventListener("click", openLabelEditor);
  return pill;
}

function createLabelEditorPanel(card) {
  const labels = sortedBoardLabels();
  const searchTerm = state.labelSearchTerm.trim().toLowerCase();
  const filteredLabels = searchTerm
    ? labels.filter((label) => `${label.name || ""} ${label.color || ""}`.toLowerCase().includes(searchTerm))
    : labels;

  const panel = document.createElement("section");
  panel.className = "label-editor-panel";
  panel.append(createLabelSearchInput());

  if (labels.length === 0) {
    panel.append(createEmptyLabelsMessage(), createLabelCreateButton());
    return panel;
  }

  const list = document.createElement("div");
  list.className = "label-editor-list";
  for (const label of filteredLabels) {
    list.append(createLabelEditorRow(card, label));
  }

  if (filteredLabels.length === 0) {
    panel.append(createNoMatchingLabelsMessage());
  } else {
    panel.append(list);
  }

  panel.append(createLabelCreateButton());
  return panel;
}

function createLabelSearchInput() {
  const searchInput = document.createElement("input");
  searchInput.className = "label-search-input";
  searchInput.type = "search";
  searchInput.placeholder = "Search labels…";
  searchInput.value = state.labelSearchTerm;
  searchInput.addEventListener("keydown", stopLabelEditorShortcut);
  searchInput.addEventListener("input", () => {
    state.labelSearchTerm = searchInput.value;
    renderCardDialog();
  });
  return searchInput;
}

function createLabelCreateButton() {
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "ghost-button";
  createButton.textContent = "Create a new label";
  createButton.addEventListener("click", addLabelToSelectedCard);
  return createButton;
}

function createEmptyLabelsMessage() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "No labels yet. Add one for this card.";
  return empty;
}

function createNoMatchingLabelsMessage() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "No labels match that search.";
  return empty;
}

function createLabelEditorRow(card, label) {
  const row = document.createElement("div");
  row.className = "label-editor-row";
  row.append(
    createLabelToggle(card, label),
    createLabelNameInput(label),
    createLabelColorSelect(label),
    createLabelRemoveButton(label)
  );
  return row;
}

function createLabelToggle(card, label) {
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
  return toggle;
}

function createLabelNameInput(label) {
  const nameInput = document.createElement("input");
  nameInput.className = "label-name-input";
  nameInput.type = "text";
  nameInput.value = label.name || "";
  nameInput.placeholder = "Label name";
  nameInput.style.backgroundColor = colorForLabel(label.color);
  let committedName = label.name || "";
  nameInput.addEventListener("keydown", stopLabelEditorShortcut);
  nameInput.addEventListener("input", () => {
    label.name = nameInput.value;
  });
  nameInput.addEventListener("blur", () => {
    const trimmedName = nameInput.value.trim();
    if (label.name !== trimmedName) {
      label.name = trimmedName;
    }
    if (committedName !== label.name) {
      committedName = label.name;
      queueSave("Label updated");
      renderBoard();
    }
  });
  return nameInput;
}

function createLabelColorSelect(label) {
  const colorSelect = document.createElement("select");
  colorSelect.className = "label-color-select";
  for (const color of labelColorOptions()) {
    const option = document.createElement("option");
    option.value = color;
    option.textContent = color.replaceAll("_", " ");
    option.selected = color === label.color;
    colorSelect.append(option);
  }
  colorSelect.addEventListener("keydown", stopLabelEditorShortcut);
  colorSelect.addEventListener("change", () => {
    label.color = colorSelect.value;
    queueSave("Label updated");
    renderCardDialog();
    renderBoard();
  });
  return colorSelect;
}

function createLabelRemoveButton(label) {
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "icon-button";
  removeButton.append(createIcon("trash"));
  removeButton.addEventListener("click", () => {
    deleteLabel(label.id);
    queueSave("Label removed");
    render();
  });
  return removeButton;
}

function stopLabelEditorShortcut(event) {
  event.stopPropagation();
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

function appendLabelEditorPanel(panel) {
  const anchor = labelEditorContainer.closest(".sidebar-panel") || labelEditorContainer;
  const rect = anchor.getBoundingClientRect();
  const margin = 16;
  const width = Math.min(rect.width, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(rect.right - width, margin), window.innerWidth - width - margin);
  const top = Math.min(rect.bottom - 4, window.innerHeight - margin - 220);
  const maxHeight = Math.max(220, window.innerHeight - top - margin);

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.width = `${Math.round(width)}px`;
  panel.style.maxHeight = `${Math.round(maxHeight)}px`;
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
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button attachment-delete-button";
    deleteButton.setAttribute("aria-label", `Delete ${attachment.name || "attachment"}`);
    deleteButton.append(createIcon("trash"));
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeAttachmentFromCard(card.id, attachment.id);
    });
    row.append(deleteButton);
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
  state.editingCardTitleId = card.id;
  state.editingCardTitleValue = "";
  state.pendingNewCardIds.add(card.id);
  pushAction("createCard", {
    card: cardActionSnapshot(card),
    list: { id: listId, name: lane?.name || "Lane" },
    board: { id: state.board.id, name: state.board.name }
  });
  render();
  focusInlineInput(document.querySelector(`.card[data-card-id="${card.id}"] .card-title-inline-input`));
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
      card.cover = coverState(firstImage.id);
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

async function removeAttachmentFromCard(cardId, attachmentId) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId);
  const attachment = card?.attachments?.find((candidate) => candidate.id === attachmentId);
  if (!card || !attachment) return;

  const confirmed = await openConfirmDialog({
    label: "Attachment",
    title: "Delete attachment?",
    message: `Remove "${attachment.name || "Attachment"}" from this card? Uploaded files are deleted from the vault when no other card uses them.`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    danger: true
  });
  if (!confirmed) return;

  const storedName = storedUploadFileName(attachment);
  card.attachments = (card.attachments || []).filter((candidate) => candidate.id !== attachmentId);
  if (card.cover?.idAttachment === attachmentId) {
    card.cover = coverState(null);
  }
  if (card.badges) {
    card.badges.attachments = card.attachments.length;
    card.badges.attachmentsByType = {
      trello: { board: 0, card: card.attachments.length }
    };
  }

  touchCard(card);
  pushAction("deleteAttachmentFromCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    attachment: {
      id: attachment.id,
      name: attachment.name || "Attachment"
    },
    list: { id: card.idList, name: listById(card.idList)?.name || "" }
  });

  try {
    setSaveMessage("Deleting attachment…");
    await saveBoardNow();
    if (storedName && isLocalUploadAttachment(attachment)) {
      const response = await fetch(`/api/uploads/${encodeURIComponent(storedName)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Attachment metadata was removed, but the upload file could not be deleted.");
      }
    }
    setSaveMessage("Attachment deleted");
    render();
  } catch (error) {
    setSaveMessage(error.message || "Attachment delete failed.");
    await openMessageDialog({
      label: "Attachment",
      title: "Delete failed",
      message: error.message || "Attachment delete failed."
    });
  }
}

function removeCoverFromSelectedCard(event) {
  event?.stopPropagation();
  const card = getSelectedCard();
  if (!card?.cover?.idAttachment) return;

  card.cover = coverState(null);
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

  card.cover = coverState(attachment.id);
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

function archiveCard(card, options = {}) {
  if ((!options.force && !isCardDone(card)) || isCardArchived(card)) return;
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

function archiveSelectedCard() {
  const card = getSelectedCard();
  if (!card || isCardArchived(card)) return;
  archiveCard(card, { force: true });
  cardDialog.close();
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

async function deleteAllArchivedCards() {
  const cards = archivedCards();
  if (cards.length === 0) return;

  const confirmed = await openConfirmDialog({
    label: "Delete archive",
    title: "Delete all archived cards?",
    message: `Delete ${cards.length} archived card${cards.length === 1 ? "" : "s"} permanently? This cannot be undone.`,
    confirmLabel: "Delete all",
    danger: true
  });
  if (!confirmed) return;

  for (const card of cards) {
    removeCardCompletely(card.id);
  }
  state.selectedCardId = null;
  queueSave("Archived cards deleted");
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
  state.keyboardCardId = cardId;
  state.selectedCardId = cardId;
  state.labelEditorOpen = false;
  state.labelSearchTerm = "";
  state.descriptionEditing = false;
  renderCardDialog();
  if (!cardDialog.open) {
    cardDialog.showModal();
  }
}

function handleBoardKeyboardNavigation(event) {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "c", "C"].includes(event.key) && !/^[1-9]$/.test(event.key)) return;
  if (isTypingTarget(event.target) || document.querySelector("dialog[open]")) return;

  if (event.key === "Enter") {
    if (!state.keyboardCardId || !visibleCardById(state.keyboardCardId)) return;
    event.preventDefault();
    openCard(state.keyboardCardId);
    return;
  }

  if (event.key === " ") {
    const card = keyboardSelectedVisibleCard();
    if (!card) return;
    event.preventDefault();
    toggleCardDone(card);
    return;
  }

  if (event.key === "c" || event.key === "C") {
    const card = keyboardSelectedVisibleCard();
    if (!card) return;
    event.preventDefault();
    state.keyboardCardId = null;
    archiveCard(card, { force: true });
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    const card = keyboardSelectedVisibleCard();
    if (!card) return;
    event.preventDefault();
    toggleKeyboardLabel(card, Number(event.key) - 1);
    return;
  }

  event.preventDefault();
  moveKeyboardCardSelection(event.key);
}

function isTypingTarget(target) {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}

function moveKeyboardCardSelection(key) {
  const lanes = openLists().map((list) => ({
    id: list.id,
    cards: visibleCardsForList(list.id)
  }));
  const nonEmptyLane = lanes.find((lane) => lane.cards.length > 0);
  if (!nonEmptyLane) return;

  let laneIndex = lanes.findIndex((lane) => lane.cards.some((card) => card.id === state.keyboardCardId));
  let cardIndex = laneIndex >= 0
    ? lanes[laneIndex].cards.findIndex((card) => card.id === state.keyboardCardId)
    : -1;

  if (laneIndex < 0 || cardIndex < 0) {
    setKeyboardCard(nonEmptyLane.cards[0].id, true);
    return;
  }

  if (key === "ArrowUp") {
    cardIndex = Math.max(0, cardIndex - 1);
  } else if (key === "ArrowDown") {
    cardIndex = Math.min(lanes[laneIndex].cards.length - 1, cardIndex + 1);
  } else if (key === "ArrowLeft" || key === "ArrowRight") {
    const direction = key === "ArrowRight" ? 1 : -1;
    const nextLaneIndex = nextLaneWithCards(lanes, laneIndex, direction);
    if (nextLaneIndex === -1) return;
    laneIndex = nextLaneIndex;
    cardIndex = Math.min(cardIndex, lanes[laneIndex].cards.length - 1);
  }

  setKeyboardCard(lanes[laneIndex].cards[cardIndex].id, true);
}

function nextLaneWithCards(lanes, startIndex, direction) {
  for (let index = startIndex + direction; index >= 0 && index < lanes.length; index += direction) {
    if (lanes[index].cards.length > 0) return index;
  }
  return -1;
}

function visibleCardById(cardId) {
  return openLists().some((list) => visibleCardsForList(list.id).some((card) => card.id === cardId));
}

function keyboardSelectedVisibleCard() {
  if (!state.keyboardCardId) return null;
  for (const list of openLists()) {
    const card = visibleCardsForList(list.id).find((candidate) => candidate.id === state.keyboardCardId);
    if (card) return card;
  }
  return null;
}

function toggleKeyboardLabel(card, labelIndex) {
  const label = sortedBoardLabels()[labelIndex];
  if (!label) return;

  card.idLabels = Array.isArray(card.idLabels) ? card.idLabels : [];
  const previousLabels = [...card.idLabels];
  const hadLabel = previousLabels.includes(label.id);
  card.idLabels = hadLabel
    ? previousLabels.filter((labelId) => labelId !== label.id)
    : [...previousLabels, label.id];
  touchCard(card);
  pushAction("updateCard", {
    idCard: card.id,
    card: cardActionSnapshot(card),
    list: { id: card.idList, name: listById(card.idList)?.name || "" },
    label: { id: label.id, name: label.name || label.color, color: label.color },
    old: { idLabels: previousLabels },
    idLabels: card.idLabels
  });
  queueSave(hadLabel ? "Label removed" : "Label added");
  renderBoard();
}

function sortedBoardLabels() {
  return [...(state.board?.labels || [])];
}

function setKeyboardCard(cardId, shouldRender = true) {
  state.keyboardCardId = cardId;
  if (shouldRender) renderBoard();
  requestAnimationFrame(() => {
    document.querySelector(`.card[data-card-id="${cardId}"]`)?.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  });
}

async function deleteSelectedCard() {
  const card = getSelectedCard();
  if (!card) return;
  if (await deleteBoardCard(card.id)) {
    cardDialog.close();
  }
}

async function deleteBoardCard(cardId) {
  const card = (state.board?.cards || []).find((candidate) => candidate.id === cardId);
  if (!card) return false;
  const confirmed = await openConfirmDialog({
    label: "Delete card",
    title: "Delete card?",
    message: `Delete "${card.name || "Task"}" permanently? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return false;
  removeCardCompletely(card.id);
  queueSave("Card deleted");
  render();
  return true;
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
    const heading = parseMarkdownHeading(block);
    const node = heading
      ? document.createElement(`h${heading.level}`)
      : document.createElement("p");
    const blockContent = heading ? heading.text : block;
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
  const image = parseMarkdownImage(text);
  if (!image) {
    appendFormattedText(container, text);
    return;
  }

  const imageNode = createSafeImage(image.href, unescapeMarkdownText(image.alt), image.title);
  if (imageNode) {
    container.append(imageNode);
    return;
  }

  appendFormattedText(container, text);
}

function appendFormattedText(container, text) {
  let index = 0;

  while (index < text.length) {
    const match = findNextFormattedLink(text, index);
    if (!match) {
      container.append(document.createTextNode(text.slice(index)));
      return;
    }

    if (match.start > index) {
      container.append(document.createTextNode(text.slice(index, match.start)));
    }

    const link = createSafeLink(match.label || match.href, match.href, match.title || "");

    if (link) {
      container.append(link);
    } else {
      container.append(document.createTextNode(text.slice(match.start, match.end)));
    }

    index = match.end;
  }
}

function parseMarkdownHeading(block) {
  const trimmed = block.trim();
  let level = 0;
  while (level < trimmed.length && trimmed[level] === "#" && level < 6) {
    level += 1;
  }
  if (level === 0 || trimmed[level] !== " ") return null;
  return { level, text: trimmed.slice(level + 1) };
}

function parseMarkdownImage(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("![") || !trimmed.endsWith(")")) return null;
  const altEnd = trimmed.indexOf("](");
  if (altEnd === -1) return null;
  const destination = parseMarkdownDestination(trimmed.slice(altEnd + 2, -1));
  if (!destination?.href) return null;
  return {
    alt: trimmed.slice(2, altEnd),
    href: destination.href,
    title: destination.title
  };
}

function findNextFormattedLink(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    const match = parseFormattedLinkAt(text, index);
    if (match) return match;
  }
  return null;
}

function parseFormattedLinkAt(text, index) {
  if (text[index] === "[") {
    return parseBracketLinkAt(text, index);
  }
  if (text.startsWith("http://", index) || text.startsWith("https://", index)) {
    return parsePlainUrlAt(text, index);
  }
  return null;
}

function parseBracketLinkAt(text, index) {
  const labelEnd = text.indexOf("]", index + 1);
  if (labelEnd === -1) return null;
  const labelText = text.slice(index + 1, labelEnd);

  if (text[labelEnd + 1] === "(") {
    const destinationEnd = text.indexOf(")", labelEnd + 2);
    if (destinationEnd === -1) return null;
    const destination = parseMarkdownDestination(text.slice(labelEnd + 2, destinationEnd));
    if (!destination) return null;
    return {
      start: index,
      end: destinationEnd + 1,
      label: unescapeMarkdownText(labelText),
      href: destination.href,
      title: destination.title
    };
  }

  const separator = labelText.indexOf("|");
  if (separator !== -1) {
    const label = labelText.slice(0, separator);
    const href = labelText.slice(separator + 1);
    if (isHttpUrlText(href)) {
      return { start: index, end: labelEnd + 1, label, href, title: "" };
    }
  }

  if (isHttpUrlText(labelText)) {
    return { start: index, end: labelEnd + 1, label: labelText, href: labelText, title: "" };
  }

  return null;
}

function parseMarkdownDestination(value) {
  const trimmed = value.trim();
  const titleMarker = trimmed.indexOf(" \"");
  const hasTitle = titleMarker !== -1 && trimmed.endsWith("\"");
  const href = hasTitle ? trimmed.slice(0, titleMarker) : trimmed;
  if (!isHttpUrlText(href)) return null;
  return {
    href,
    title: hasTitle ? trimmed.slice(titleMarker + 2, -1) : ""
  };
}

function parsePlainUrlAt(text, index) {
  let end = index;
  while (end < text.length && !isUrlStopCharacter(text[end])) {
    end += 1;
  }
  const href = text.slice(index, end);
  return { start: index, end, label: href, href, title: "" };
}

function isUrlStopCharacter(character) {
  return character === " " || character === "\t" || character === "\n" || character === "<" || character === "]";
}

function isHttpUrlText(value) {
  return value.startsWith("http://") || value.startsWith("https://");
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
  const nextIconStyle = settingsIconStyleInputs.find((input) => input.checked)?.value === "flat" ? "flat" : "3d";
  const nextShowCardDescriptions = settingsShowCardDescriptions.checked;
  const nextInlineCardTitleEdit = settingsInlineCardTitleEdit.checked;
  const nextGitSyncInBackground = settingsGitSyncInBackground.checked;
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

  if (state.gitSyncInBackground !== nextGitSyncInBackground) {
    state.gitSyncInBackground = nextGitSyncInBackground;
    localStorage.setItem(GIT_SYNC_IN_BACKGROUND_STORAGE_KEY, String(nextGitSyncInBackground));
    didPersistLocalSetting = true;
  }

  if (didPersistLocalSetting) {
    setSaveMessage("Settings saved locally");
    renderBoard();
  } else {
    setSaveMessage("Settings saved locally");
  }

  settingsDialog.close();
  render();
}

function openSettingsDialog() {
  settingsUser.textContent = userMetaText();
  for (const input of settingsIconStyleInputs) {
    input.checked = input.value === state.iconStyle;
  }
  settingsShowCardDescriptions.checked = state.showCardDescriptions;
  settingsInlineCardTitleEdit.checked = state.inlineCardTitleEdit;
  settingsGitSyncInBackground.checked = state.gitSyncInBackground;
  const canImport = (state.board?.cards || []).length === 0;
  importBoardButton.disabled = !canImport;
  settingsImportHelp.textContent = canImport
    ? "Import is available because this board has no cards."
    : "Import is disabled because this board already has cards.";

  if (!settingsDialog.open) {
    settingsDialog.showModal();
  }
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
  if (state.board.name === nextBoardName) {
    renderHeader();
  } else {
    updateBoardName(nextBoardName, "Board updated");
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
  const isPendingNewCard = state.pendingNewCardIds.has(cardId);
  state.editingCardTitleId = null;
  state.editingCardTitleValue = "";
  state.pendingNewCardIds.delete(cardId);

  if (card.name !== nextName || isPendingNewCard) {
    card.name = nextName;
    touchCard(card);
    queueSave(isPendingNewCard ? "Card added" : "Card updated");
    renderBoard();
    if (archiveDialog.open) {
      renderArchiveDialog();
    }
    return;
  }

  renderBoard();
}

function cancelCardTitleEdit() {
  const cardId = state.editingCardTitleId;
  state.editingCardTitleId = null;
  state.editingCardTitleValue = "";
  state.pendingNewCardIds.delete(cardId);
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
  if (!state.gitSyncInBackground) {
    openSyncLogDialog();
  }
  try {
    await flushPendingBoardSave();

    const response = await fetch("/api/sync", { method: "POST" });
    const payload = await response.json();
    state.lastSyncLog = payload.output || "No sync output was returned.";
    state.lastSyncAt = payload.startedAt || state.lastSyncAt;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.output || "Git sync failed.");
    }
    await reloadBoardAfterSync();
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
  syncStatusPollTimer = globalThis.setInterval(() => {
    void refreshSyncStatus();
  }, 500);
}

function stopSyncStatusPolling() {
  if (syncStatusPollTimer !== null) {
    globalThis.clearInterval(syncStatusPollTimer);
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
    state.saveTimer = null;
    saveBoardNow().catch((error) => {
      setSaveMessage(error.message || "Save failed.");
    });
  }, 220);
}

async function flushPendingBoardSave() {
  if (state.saveTimer !== null) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    await saveBoardNow();
    return;
  }

  if (state.isSaving) {
    await saveBoardNow();
  }
}

async function reloadBoardAfterSync() {
  const selectedCardId = state.selectedCardId;
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error("Board synced, but the updated board could not be loaded.");
  }

  state.board = await response.json();
  state.users = await loadUsers();
  state.editingBoardTitle = false;
  state.editingBoardTitleValue = "";
  state.editingLaneTitleId = null;
  state.editingLaneTitleValue = "";
  state.editingCardTitleId = null;
  state.editingCardTitleValue = "";

  if (selectedCardId && !(state.board.cards || []).some((card) => card.id === selectedCardId)) {
    state.selectedCardId = null;
    state.descriptionEditing = false;
    if (cardDialog.open) cardDialog.close();
  }

  render();
}

async function loadUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) return state.users || [];
  const payload = await response.json();
  return Array.isArray(payload.users) ? payload.users : [];
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

function assignedUsersForCard(card) {
  const users = new Map((state.users || []).map((user) => [user.id, user]));
  return (Array.isArray(card.kanbanQubeAssignees) ? card.kanbanQubeAssignees : [])
    .map((userId) => users.get(userId))
    .filter(Boolean);
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

function dateInputValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

function formatDueDate(value) {
  const input = dateInputValue(value);
  if (!input) return "";
  const date = new Date(`${input}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dueBadgeClass(card) {
  if (card.dueComplete) return "badge-due-complete";
  const input = dateInputValue(card.due);
  if (!input) return "";
  const today = new Date().toISOString().slice(0, 10);
  return input < today ? "badge-due-overdue" : "";
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
    if (state.drag?.type !== "card") return;
    event.preventDefault();
    const after = cardElementAfter(cardList, event.clientY);
    const dragging = document.querySelector(`.card[data-card-id="${state.drag.cardId}"]`);
    if (!dragging) return;
    if (!after) cardList.append(dragging);
    else if (after !== dragging) after.before(dragging);
  });

  cardList.addEventListener("drop", (event) => {
    if (state.drag?.type !== "card") return;
    event.preventDefault();
    const cardId = state.drag.cardId;
    const card = (state.board.cards || []).find((candidate) => candidate.id === cardId);
    if (!card) return;

    const order = [...cardList.querySelectorAll(".card")].map((node) => node.dataset.cardId);
    const previousListId = card.idList;
    const sourceListId = previousListId === listId ? null : previousListId;
    reorderCardsFromDom(listId, order, sourceListId, cardId);
    state.drag = null;
  });
}

function enableLaneDnD(laneNode) {
  laneNode.addEventListener("dragstart", (event) => {
    if (event.target.closest(".card")) return;
    if (event.target.closest("button, input, textarea, select, .lane-resize-handle")) return;
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
  if (state.drag?.type !== "lane") return;
  event.preventDefault();
  const after = laneElementAfter(boardScroller, event.clientX);
  const dragging = document.querySelector(`.lane[data-list-id="${state.drag.listId}"]`);
  if (!dragging) return;
  if (!after) {
    const anchor = boardScroller.querySelector(".add-lane-card");
    if (anchor) anchor.before(dragging);
    else boardScroller.append(dragging);
  } else if (after !== dragging) {
    after.before(dragging);
  }
}

function handleLaneDrop(event) {
  if (state.drag?.type !== "lane") return;
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
  if (card.due) badges.push({ icon: "clock", text: formatDueDate(card.due), className: dueBadgeClass(card) });
  if (card.badges?.description) badges.push({ icon: "description", text: "" });
  if (card.badges?.comments) badges.push({ icon: "comment", text: String(card.badges.comments) });
  if (card.badges?.checkItems) badges.push({ symbol: "☑", text: `${card.badges.checkItemsChecked || 0}/${card.badges.checkItems}` });
  if (card.attachments?.length) badges.push({ icon: "attachment", text: String(card.attachments.length) });
  return badges;
}

function createIcon(name) {
  const paths = {
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 1.8"],
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

function coverState(idAttachment) {
  return {
    idAttachment,
    color: null,
    idUploadedBackground: null,
    size: "normal",
    brightness: "dark",
    yPosition: 0.5,
    idPlugin: null
  };
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

function storedUploadFileName(attachment) {
  if (!attachment) return "";
  if (attachment.fileName) return String(attachment.fileName).split(/[\\/]/).pop();
  if (attachment.url) {
    try {
      return decodeURIComponent(new URL(attachment.url, globalThis.location.origin).pathname.split("/").pop() || "");
    } catch {
      return "";
    }
  }
  return "";
}

function isLocalUploadAttachment(attachment) {
  if (!attachment) return false;
  if (attachment.isUpload) return true;
  if (typeof attachment.url !== "string") return false;
  try {
    return new URL(attachment.url, globalThis.location.origin).pathname.startsWith("/uploads/");
  } catch {
    return attachment.url.startsWith("/uploads/");
  }
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
  const gitUserName = storageSafeText(state.config?.gitUserName);
  const gitUserEmail = storageSafeText(state.config?.gitUserEmail);

  if (gitUserName) {
    state.currentUserName = gitUserName;
    localStorage.setItem(USER_STORAGE_KEY, gitUserName);
  }

  if (gitUserEmail) {
    state.currentUserEmail = gitUserEmail;
    localStorage.setItem(USER_EMAIL_STORAGE_KEY, gitUserEmail);
  }
}

function userMetaText() {
  const name = state.currentUserName.trim() || "Guest";
  const email = state.currentUserEmail.trim();
  return email ? `User: ${name} (${email})` : `User: ${name}`;
}

function renderUserAvatar() {
  const userName = state.currentUserName.trim() || "Guest";
  userAvatarButton.dataset.tooltip = userName;
  userAvatarButton.setAttribute("aria-label", userName);
  userAvatarFallback.textContent = initialsFor(userName);

  const avatarUrl = storageSafeText(state.config?.gravatarUrl);
  if (avatarUrl && userAvatarImage.src !== avatarUrl) {
    userAvatarImage.hidden = false;
    userAvatarFallback.hidden = true;
    userAvatarImage.src = avatarUrl;
  } else if (!avatarUrl) {
    userAvatarImage.hidden = true;
    userAvatarFallback.hidden = false;
  }
}

function colorForLabel(color) {
  return labelColorMap[color] || labelColorMap.blue;
}

function labelColorOptions() {
  return Object.keys(labelColorMap);
}

function storageSafeText(value) {
  return typeof value === "string" ? value.replace(/[\0\r\n]/g, "").trim().slice(0, 200) : "";
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
  let result = "";
  let previousWasDash = true;
  for (const character of String(value).toLowerCase()) {
    const isAlphaNumeric = (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
    if (isAlphaNumeric) {
      result += character;
      previousWasDash = false;
    } else if (!previousWasDash) {
      result += "-";
      previousWasDash = true;
    }
  }
  const trimmed = previousWasDash ? result.slice(0, -1) : result;
  return trimmed || "user";
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
