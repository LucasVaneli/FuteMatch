import { PLAYER_SIDE } from "./domain/Player.js";
import { DrawService } from "./services/DrawService.js";
import { FuteMatchRepository } from "./services/FuteMatchRepository.js";
import { DrawView } from "./ui/DrawView.js";

const repository = new FuteMatchRepository();

const elements = {
  navButtons: [...document.querySelectorAll("[data-page]")],
  pages: [...document.querySelectorAll("[data-page-section]")],
  goToButtons: [...document.querySelectorAll("[data-go-to]")],
  currentGroupSelect: document.querySelector("#current-group-select"),
  drawContext: document.querySelector("#draw-context"),
  drawEmptyState: document.querySelector("#draw-empty-state"),
  drawForm: document.querySelector("#draw-form"),
  leftPlayerOptions: document.querySelector("#left-player-options"),
  rightPlayerOptions: document.querySelector("#right-player-options"),
  clearSelectionButton: document.querySelector("#clear-selection-button"),
  redrawButton: document.querySelector("#redraw-button"),
  formError: document.querySelector("#form-error"),
  resultsSection: document.querySelector("#results-section"),
  pairsList: document.querySelector("#pairs-list"),
  pairTemplate: document.querySelector("#pair-template"),
  groupForm: document.querySelector("#group-form"),
  groupName: document.querySelector("#group-name"),
  groupError: document.querySelector("#group-error"),
  groupsList: document.querySelector("#groups-list"),
  playerForm: document.querySelector("#player-form"),
  playerName: document.querySelector("#player-name"),
  playerBirthDate: document.querySelector("#player-birth-date"),
  playerSide: document.querySelector("#player-side"),
  playerGroupOptions: document.querySelector("#player-group-options"),
  playerError: document.querySelector("#player-error"),
  playersList: document.querySelector("#players-list"),
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
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

const showPage = (pageName) => {
  elements.pages.forEach((page) => {
    page.classList.toggle("is-hidden", page.dataset.pageSection !== pageName);
  });

  elements.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === pageName);
  });
};

const renderGroupSelector = () => {
  const groups = repository.getGroups();
  const currentGroupId = repository.getCurrentGroupId();

  elements.currentGroupSelect.innerHTML = [
    '<option value="">Nenhuma patota</option>',
    ...groups.map(
      (group) =>
        `<option value="${group.id}" ${group.id === currentGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`,
    ),
  ].join("");
};

const renderGroups = () => {
  const groups = repository.getGroups();

  if (!groups.length) {
    elements.groupsList.innerHTML = `<div class="empty-state empty-state--compact"><strong>Nenhuma patota cadastrada</strong><span>Crie sua primeira patota para organizar os jogadores.</span></div>`;
    return;
  }

  elements.groupsList.innerHTML = groups
    .map((group) => {
      const players = repository.getPlayersByGroup(group.id);
      const current = repository.getCurrentGroupId() === group.id;

      return `
        <article class="list-card ${current ? "list-card--active" : ""}">
          <div>
            <span class="list-card__tag">${current ? "Patota atual" : "Patota"}</span>
            <strong>${escapeHtml(group.name)}</strong>
            <small>${players.length} jogador${players.length === 1 ? "" : "es"}</small>
          </div>
          <button class="button button--small button--secondary" type="button" data-select-group="${group.id}">${current ? "Selecionada" : "Usar patota"}</button>
        </article>
      `;
    })
    .join("");
};

const renderPlayerGroupOptions = () => {
  const groups = repository.getGroups();

  if (!groups.length) {
    elements.playerGroupOptions.innerHTML = '<span class="muted-text">Cadastre uma patota antes de associar jogadores.</span>';
    return;
  }

  const currentGroupId = repository.getCurrentGroupId();

  elements.playerGroupOptions.innerHTML = groups
    .map(
      (group) => `
        <label class="check-option">
          <input type="checkbox" name="player-group" value="${group.id}" ${group.id === currentGroupId ? "checked" : ""} />
          <span>${escapeHtml(group.name)}</span>
        </label>
      `,
    )
    .join("");
};

const renderPlayers = () => {
  const players = repository.getPlayers();

  if (!players.length) {
    elements.playersList.innerHTML = `<div class="empty-state empty-state--compact"><strong>Nenhum jogador cadastrado</strong><span>Cadastre os jogadores e associe-os às patotas.</span></div>`;
    return;
  }

  elements.playersList.innerHTML = players
    .map((player) => {
      const groups = repository.getGroupsByPlayer(player.id);
      const sideLabel = player.side === PLAYER_SIDE.LEFT ? "Esquerda" : "Direita";

      return `
        <article class="list-card">
          <div class="player-summary">
            <span class="side-pill side-pill--${player.side}">${sideLabel}</span>
            <strong>${escapeHtml(player.name)}</strong>
            <small>${formatDate(player.birthDate)}</small>
            <div class="tag-row">
              ${groups.length ? groups.map((group) => `<span class="mini-tag">${escapeHtml(group.name)}</span>`).join("") : '<span class="mini-tag mini-tag--muted">Sem patota</span>'}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
};

const playerOption = (player) => `
  <label class="player-select-card">
    <input type="checkbox" data-draw-player="${player.id}" />
    <span><strong>${escapeHtml(player.name)}</strong><small>${player.birthDate ? formatDate(player.birthDate) : ""}</small></span>
  </label>
`;

const renderDrawPlayers = () => {
  const currentGroupId = repository.getCurrentGroupId();
  const groups = repository.getGroups();
  const currentGroup = groups.find((group) => group.id === currentGroupId);

  drawView.clearError();
  drawView.clearResults();

  if (!currentGroup) {
    elements.drawContext.textContent = "Crie ou selecione uma patota para começar.";
    elements.drawEmptyState.classList.remove("is-hidden");
    elements.drawForm.classList.add("is-hidden");
    return;
  }

  const players = repository.getPlayersByGroup(currentGroupId);
  const leftPlayers = players.filter((player) => player.side === PLAYER_SIDE.LEFT);
  const rightPlayers = players.filter((player) => player.side === PLAYER_SIDE.RIGHT);

  elements.drawContext.textContent = `${currentGroup.name} • ${players.length} jogadores cadastrados`;
  elements.drawEmptyState.classList.add("is-hidden");
  elements.drawForm.classList.remove("is-hidden");

  elements.leftPlayerOptions.innerHTML = leftPlayers.length ? leftPlayers.map(playerOption).join("") : '<div class="empty-side">Nenhum jogador de esquerda nesta patota.</div>';
  elements.rightPlayerOptions.innerHTML = rightPlayers.length ? rightPlayers.map(playerOption).join("") : '<div class="empty-side">Nenhum jogador de direita nesta patota.</div>';
};

const renderAll = () => {
  renderGroupSelector();
  renderGroups();
  renderPlayerGroupOptions();
  renderPlayers();
  renderDrawPlayers();
};

const getSelectedPlayers = () => {
  const groupPlayers = repository.getPlayersByGroup(repository.getCurrentGroupId());
  const selectedIds = new Set([...document.querySelectorAll("[data-draw-player]:checked")].map((input) => input.dataset.drawPlayer));
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

elements.navButtons.forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
elements.goToButtons.forEach((button) => button.addEventListener("click", () => showPage(button.dataset.goTo)));

elements.currentGroupSelect.addEventListener("change", () => {
  repository.setCurrentGroup(elements.currentGroupSelect.value);
  renderAll();
});

elements.groupsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-group]");
  if (!button) return;
  repository.setCurrentGroup(button.dataset.selectGroup);
  renderAll();
  showPage("draw");
});

elements.groupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.groupError.textContent = "";
  try {
    repository.createGroup(elements.groupName.value);
    elements.groupForm.reset();
    renderAll();
  } catch (error) {
    elements.groupError.textContent = error.message;
  }
});

elements.playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.playerError.textContent = "";
  try {
    const groupIds = [...document.querySelectorAll('input[name="player-group"]:checked')].map((input) => input.value);
    repository.createPlayer({
      name: elements.playerName.value,
      birthDate: elements.playerBirthDate.value,
      side: elements.playerSide.value,
      groupIds,
    });
    elements.playerForm.reset();
    renderAll();
  } catch (error) {
    elements.playerError.textContent = error.message;
  }
});

elements.drawForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleDraw();
});

elements.redrawButton.addEventListener("click", handleDraw);

elements.clearSelectionButton.addEventListener("click", () => {
  document.querySelectorAll("[data-draw-player]").forEach((input) => {
    input.checked = false;
  });
  drawView.clearError();
  drawView.clearResults();
});

renderAll();
