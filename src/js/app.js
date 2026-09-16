import { PLAYER_SIDE } from "./domain/Player.js";
import { DrawService } from "./services/DrawService.js";
import { FuteMatchRepository } from "./services/FuteMatchRepository.js";
import { DrawView } from "./ui/DrawView.js";

const repository = new FuteMatchRepository();
let toastTimer;

const elements = {
  navButtons: [...document.querySelectorAll("[data-page]")],
  pages: [...document.querySelectorAll("[data-page-section]")],
  goToButtons: [...document.querySelectorAll("[data-go-to]")],
  groupSwitcher: document.querySelector("#group-switcher"),
  currentGroupSelect: document.querySelector("#current-group-select"),
  groupForm: document.querySelector("#group-form"),
  groupName: document.querySelector("#group-name"),
  groupError: document.querySelector("#group-error"),
  groupsList: document.querySelector("#groups-list"),
  playersNoGroup: document.querySelector("#players-no-group"),
  playersContent: document.querySelector("#players-content"),
  playersGroupName: document.querySelector("#players-group-name"),
  playersTotalCount: document.querySelector("#players-total-count"),
  playersLeftCount: document.querySelector("#players-left-count"),
  playersRightCount: document.querySelector("#players-right-count"),
  playerTargetGroup: document.querySelector("#player-target-group"),
  playerForm: document.querySelector("#player-form"),
  playerName: document.querySelector("#player-name"),
  playerBirthDate: document.querySelector("#player-birth-date"),
  playerSide: document.querySelector("#player-side"),
  playerError: document.querySelector("#player-error"),
  playersList: document.querySelector("#players-list"),
  existingPlayerBox: document.querySelector("#existing-player-box"),
  existingPlayerSelect: document.querySelector("#existing-player-select"),
  addExistingPlayerButton: document.querySelector("#add-existing-player-button"),
  existingPlayerError: document.querySelector("#existing-player-error"),
  drawEmptyState: document.querySelector("#draw-empty-state"),
  drawEmptyTitle: document.querySelector("#draw-empty-title"),
  drawEmptyDescription: document.querySelector("#draw-empty-description"),
  drawEmptyAction: document.querySelector("#draw-empty-action"),
  drawContent: document.querySelector("#draw-content"),
  drawContext: document.querySelector("#draw-context"),
  drawForm: document.querySelector("#draw-form"),
  leftPlayerOptions: document.querySelector("#left-player-options"),
  rightPlayerOptions: document.querySelector("#right-player-options"),
  selectAllButton: document.querySelector("#select-all-button"),
  clearSelectionButton: document.querySelector("#clear-selection-button"),
  selectionSummaryTitle: document.querySelector("#selection-summary-title"),
  selectionSummaryDescription: document.querySelector("#selection-summary-description"),
  drawButton: document.querySelector("#draw-button"),
  redrawButton: document.querySelector("#redraw-button"),
  formError: document.querySelector("#form-error"),
  resultsSection: document.querySelector("#results-section"),
  pairsList: document.querySelector("#pairs-list"),
  pairTemplate: document.querySelector("#pair-template"),
  toast: document.querySelector("#toast"),
};

const drawView = new DrawView({
  resultsSection: elements.resultsSection,
  pairsList: elements.pairsList,
  pairTemplate: elements.pairTemplate,
  errorElement: elements.formError,
  playerInputs: [],
});

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

const getCurrentGroup = () => {
  const currentGroupId = repository.getCurrentGroupId();
  return repository.getGroups().find((group) => group.id === currentGroupId) ?? null;
};

const showToast = (message) => {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
};

const showPage = (pageName) => {
  elements.pages.forEach((page) => {
    page.classList.toggle("is-hidden", page.dataset.pageSection !== pageName);
  });

  elements.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === pageName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
};

const renderGroupSwitcher = () => {
  const groups = repository.getGroups();
  const currentGroupId = repository.getCurrentGroupId();

  elements.groupSwitcher.classList.toggle("is-hidden", groups.length === 0);
  elements.currentGroupSelect.innerHTML = groups
    .map(
      (group) =>
        `<option value="${group.id}" ${group.id === currentGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`,
    )
    .join("");
};

const renderGroups = () => {
  const groups = repository.getGroups();
  const currentGroupId = repository.getCurrentGroupId();

  if (!groups.length) {
    elements.groupsList.innerHTML = `
      <div class="empty-state empty-state--compact">
        <span class="empty-state__icon">🏖️</span>
        <strong>Nenhuma patota ainda</strong>
        <span>Crie a primeira usando o formulário ao lado.</span>
      </div>`;
    return;
  }

  elements.groupsList.innerHTML = groups
    .map((group) => {
      const players = repository.getPlayersByGroup(group.id);
      const isCurrent = group.id === currentGroupId;

      return `
        <article class="list-card ${isCurrent ? "list-card--active" : ""}">
          <div>
            <span class="list-card__tag">${isCurrent ? "Selecionada" : "Patota"}</span>
            <strong>${escapeHtml(group.name)}</strong>
            <small>${players.length} jogador${players.length === 1 ? "" : "es"}</small>
          </div>
          <button class="button ${isCurrent ? "button--ghost" : "button--secondary"} button--small" type="button" data-select-group="${group.id}">
            ${isCurrent ? "Abrir" : "Escolher"}
          </button>
        </article>`;
    })
    .join("");
};

const renderPlayers = () => {
  const group = getCurrentGroup();

  elements.playersNoGroup.classList.toggle("is-hidden", Boolean(group));
  elements.playersContent.classList.toggle("is-hidden", !group);

  if (!group) return;

  const players = repository.getPlayersByGroup(group.id);
  const leftPlayers = players.filter((player) => player.side === PLAYER_SIDE.LEFT);
  const rightPlayers = players.filter((player) => player.side === PLAYER_SIDE.RIGHT);

  elements.playersGroupName.textContent = group.name;
  elements.playerTargetGroup.textContent = `Este jogador será adicionado automaticamente à patota “${group.name}”.`;
  elements.playersTotalCount.textContent = players.length;
  elements.playersLeftCount.textContent = leftPlayers.length;
  elements.playersRightCount.textContent = rightPlayers.length;

  if (!players.length) {
    elements.playersList.innerHTML = `
      <div class="empty-state empty-state--compact">
        <span class="empty-state__icon">👥</span>
        <strong>A patota ainda está vazia</strong>
        <span>Cadastre o primeiro jogador usando o formulário ao lado.</span>
      </div>`;
  } else {
    elements.playersList.innerHTML = players
      .map((player) => {
        const sideLabel = player.side === PLAYER_SIDE.LEFT ? "Esquerda" : "Direita";
        return `
          <article class="player-row">
            <span class="avatar">${escapeHtml(player.name.charAt(0).toUpperCase())}</span>
            <div>
              <strong>${escapeHtml(player.name)}</strong>
              <small>${formatDate(player.birthDate)}</small>
            </div>
            <span class="side-pill side-pill--${player.side}">${sideLabel}</span>
          </article>`;
      })
      .join("");
  }

  const availablePlayers = repository.getPlayersNotInGroup(group.id);
  elements.existingPlayerBox.classList.toggle("is-hidden", availablePlayers.length === 0);
  elements.existingPlayerSelect.innerHTML = availablePlayers
    .map((player) => {
      const sideLabel = player.side === PLAYER_SIDE.LEFT ? "Esquerda" : "Direita";
      return `<option value="${player.id}">${escapeHtml(player.name)} — ${sideLabel}</option>`;
    })
    .join("");
};

const playerOption = (player) => `
  <label class="player-select-card">
    <input type="checkbox" data-draw-player="${player.id}" data-player-side="${player.side}" checked />
    <span class="avatar avatar--small">${escapeHtml(player.name.charAt(0).toUpperCase())}</span>
    <span class="player-select-card__text"><strong>${escapeHtml(player.name)}</strong><small>${formatDate(player.birthDate)}</small></span>
  </label>`;

const updateSelectionSummary = () => {
  const selected = [...document.querySelectorAll("[data-draw-player]:checked")];
  const leftCount = selected.filter((input) => input.dataset.playerSide === PLAYER_SIDE.LEFT).length;
  const rightCount = selected.filter((input) => input.dataset.playerSide === PLAYER_SIDE.RIGHT).length;
  const isValid = leftCount >= 2 && leftCount === rightCount;

  elements.selectionSummaryTitle.textContent = `${selected.length} jogador${selected.length === 1 ? "" : "es"} selecionado${selected.length === 1 ? "" : "s"}`;

  if (isValid) {
    elements.selectionSummaryDescription.textContent = `${leftCount} de esquerda + ${rightCount} de direita • ${leftCount} duplas serão formadas.`;
  } else if (leftCount < 2 || rightCount < 2) {
    elements.selectionSummaryDescription.textContent = "Selecione pelo menos 2 jogadores de cada lado.";
  } else {
    elements.selectionSummaryDescription.textContent = `Agora há ${leftCount} de esquerda e ${rightCount} de direita. Deixe as quantidades iguais.`;
  }

  elements.drawButton.disabled = !isValid;
};

const renderDraw = () => {
  const group = getCurrentGroup();
  drawView.clearError();
  drawView.clearResults();

  if (!group) {
    elements.drawContent.classList.add("is-hidden");
    elements.drawEmptyState.classList.remove("is-hidden");
    elements.drawEmptyTitle.textContent = "Escolha uma patota primeiro";
    elements.drawEmptyDescription.textContent = "O sorteio precisa saber qual grupo de jogadores usar.";
    elements.drawEmptyAction.textContent = "Escolher patota";
    elements.drawEmptyAction.dataset.targetPage = "groups";
    return;
  }

  const players = repository.getPlayersByGroup(group.id);
  const leftPlayers = players.filter((player) => player.side === PLAYER_SIDE.LEFT);
  const rightPlayers = players.filter((player) => player.side === PLAYER_SIDE.RIGHT);
  const canDraw = leftPlayers.length >= 2 && rightPlayers.length >= 2;

  elements.drawEmptyState.classList.toggle("is-hidden", canDraw);
  elements.drawContent.classList.toggle("is-hidden", !canDraw);

  if (!canDraw) {
    elements.drawEmptyTitle.textContent = "Faltam jogadores para formar as duplas";
    elements.drawEmptyDescription.textContent = `${group.name} precisa ter pelo menos 2 jogadores de esquerda e 2 de direita. Hoje há ${leftPlayers.length} de esquerda e ${rightPlayers.length} de direita.`;
    elements.drawEmptyAction.textContent = "Cadastrar jogadores";
    elements.drawEmptyAction.dataset.targetPage = "players";
    return;
  }

  elements.drawContext.textContent = `${group.name} • desmarque apenas quem não vai jogar hoje.`;
  elements.leftPlayerOptions.innerHTML = leftPlayers.map(playerOption).join("");
  elements.rightPlayerOptions.innerHTML = rightPlayers.map(playerOption).join("");
  updateSelectionSummary();
};

const renderAll = () => {
  renderGroupSwitcher();
  renderGroups();
  renderPlayers();
  renderDraw();
};

const getSelectedPlayers = () => {
  const group = getCurrentGroup();
  const groupPlayers = group ? repository.getPlayersByGroup(group.id) : [];
  const selectedIds = new Set(
    [...document.querySelectorAll("[data-draw-player]:checked")].map(
      (input) => input.dataset.drawPlayer,
    ),
  );
  const selected = groupPlayers.filter((player) => selectedIds.has(player.id));

  return {
    leftPlayers: selected.filter((player) => player.side === PLAYER_SIDE.LEFT),
    rightPlayers: selected.filter((player) => player.side === PLAYER_SIDE.RIGHT),
  };
};

const handleDraw = () => {
  drawView.clearError();

  try {
    const { leftPlayers, rightPlayers } = getSelectedPlayers();
    drawView.renderPairs(DrawService.createPairs(leftPlayers, rightPlayers));
  } catch (error) {
    drawView.showError(error.message);
  }
};

const getInitialPage = () => {
  const groups = repository.getGroups();
  if (!groups.length) return "groups";

  const group = getCurrentGroup();
  if (!group) return "groups";

  const players = repository.getPlayersByGroup(group.id);
  const leftCount = players.filter((player) => player.side === PLAYER_SIDE.LEFT).length;
  const rightCount = players.filter((player) => player.side === PLAYER_SIDE.RIGHT).length;

  return leftCount >= 2 && rightCount >= 2 ? "draw" : "players";
};

elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

elements.goToButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.goTo));
});

elements.currentGroupSelect.addEventListener("change", () => {
  repository.setCurrentGroup(elements.currentGroupSelect.value);
  renderAll();
  showPage("players");
  showToast("Patota alterada.");
});

elements.groupsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-group]");
  if (!button) return;

  repository.setCurrentGroup(button.dataset.selectGroup);
  renderAll();
  showPage("players");
});

elements.groupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.groupError.textContent = "";

  try {
    const group = repository.createGroup(elements.groupName.value);
    repository.setCurrentGroup(group.id);
    elements.groupForm.reset();
    renderAll();
    showPage("players");
    showToast(`Patota “${group.name}” criada. Agora adicione os jogadores.`);
  } catch (error) {
    elements.groupError.textContent = error.message;
  }
});

elements.playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.playerError.textContent = "";

  const group = getCurrentGroup();
  if (!group) {
    showPage("groups");
    return;
  }

  try {
    const player = repository.createPlayer({
      name: elements.playerName.value,
      birthDate: elements.playerBirthDate.value,
      side: elements.playerSide.value,
      groupIds: [group.id],
    });
    elements.playerForm.reset();
    renderAll();
    showPage("players");
    showToast(`${player.name} foi adicionado à patota.`);
    elements.playerName.focus();
  } catch (error) {
    elements.playerError.textContent = error.message;
  }
});

elements.addExistingPlayerButton.addEventListener("click", () => {
  elements.existingPlayerError.textContent = "";
  const group = getCurrentGroup();
  const playerId = elements.existingPlayerSelect.value;
  if (!group || !playerId) return;

  try {
    repository.addPlayerToGroup(playerId, group.id);
    const player = repository.getPlayers().find((item) => item.id === playerId);
    renderAll();
    showPage("players");
    showToast(`${player?.name ?? "Jogador"} foi adicionado à patota.`);
  } catch (error) {
    elements.existingPlayerError.textContent = error.message;
  }
});

elements.drawEmptyAction.addEventListener("click", () => {
  showPage(elements.drawEmptyAction.dataset.targetPage);
});

elements.drawForm.addEventListener("change", (event) => {
  if (!event.target.matches("[data-draw-player]")) return;
  drawView.clearResults();
  drawView.clearError();
  updateSelectionSummary();
});

elements.drawForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleDraw();
});

elements.redrawButton.addEventListener("click", handleDraw);

elements.selectAllButton.addEventListener("click", () => {
  document.querySelectorAll("[data-draw-player]").forEach((input) => {
    input.checked = true;
  });
  drawView.clearResults();
  updateSelectionSummary();
});

elements.clearSelectionButton.addEventListener("click", () => {
  document.querySelectorAll("[data-draw-player]").forEach((input) => {
    input.checked = false;
  });
  drawView.clearError();
  drawView.clearResults();
  updateSelectionSummary();
});

renderAll();
showPage(getInitialPage());
