import { PLAYER_SIDE } from "./domain/Player.js";
import { DrawService } from "./services/DrawService.js";
import { FuteMatchRepository } from "./services/FuteMatchRepository.js";
import { DrawView } from "./ui/DrawView.js";

const repository = new FuteMatchRepository();
let toastTimer;
let groupFilterStatus = "active";
let playerFilterStatus = "active";

const elements = {
  navButtons: [...document.querySelectorAll("[data-page]")],
  pages: [...document.querySelectorAll("[data-page-section]")],
  goToButtons: [...document.querySelectorAll("[data-go-to]")],
  groupFilterButtons: [...document.querySelectorAll("[data-group-filter]")],
  playerFilterButtons: [...document.querySelectorAll("[data-player-filter]")],
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

const updateFilterButtons = (buttons, currentStatus, dataAttribute) => {
  buttons.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset[dataAttribute] === currentStatus,
    );
  });
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
  const showingActive = groupFilterStatus === "active";
  const groups = repository.getGroups({ active: showingActive });
  const currentGroupId = repository.getCurrentGroupId();

  updateFilterButtons(
    elements.groupFilterButtons,
    groupFilterStatus,
    "groupFilter",
  );

  if (!groups.length) {
    elements.groupsList.innerHTML = `
      <div class="empty-state empty-state--compact">
        <span class="empty-state__icon">${showingActive ? "🏖️" : "📦"}</span>
        <strong>${showingActive ? "Nenhuma patota ativa" : "Nenhuma patota inativa"}</strong>
        <span>${showingActive ? "Crie a primeira usando o formulário ao lado." : "Quando uma patota for inativada, ela aparecerá aqui."}</span>
      </div>`;
    return;
  }

  elements.groupsList.innerHTML = groups
    .map((group) => {
      const members = repository.getPlayersByGroup(group.id, {
        includeInactive: true,
      });
      const activePlayers = members.filter((player) => player.active !== false);
      const isCurrent = group.id === currentGroupId && group.active !== false;

      const actionButtons = showingActive
        ? `
          <button class="button ${isCurrent ? "button--ghost" : "button--secondary"} button--small" type="button" data-select-group="${group.id}">
            ${isCurrent ? "Abrir" : "Escolher"}
          </button>
          <button class="button button--danger-ghost button--small" type="button" data-set-group-active="false" data-group-id="${group.id}">
            Inativar
          </button>`
        : `
          <button class="button button--secondary button--small" type="button" data-set-group-active="true" data-group-id="${group.id}">
            Reativar
          </button>`;

      return `
        <article class="list-card ${isCurrent ? "list-card--active" : ""} ${showingActive ? "" : "list-card--inactive"}">
          <div>
            <span class="list-card__tag">${showingActive ? (isCurrent ? "Selecionada" : "Ativa") : "Inativa"}</span>
            <strong>${escapeHtml(group.name)}</strong>
            <small>${activePlayers.length} jogador${activePlayers.length === 1 ? "" : "es"} ativo${activePlayers.length === 1 ? "" : "s"}</small>
          </div>
          <div class="row-actions">${actionButtons}</div>
        </article>`;
    })
    .join("");
};

const renderPlayers = () => {
  const group = getCurrentGroup();

  elements.playersNoGroup.classList.toggle("is-hidden", Boolean(group));
  elements.playersContent.classList.toggle("is-hidden", !group);

  if (!group) return;

  const allPlayers = repository.getPlayersByGroup(group.id, {
    includeInactive: true,
  });
  const activePlayers = allPlayers.filter((player) => player.active !== false);
  const leftPlayers = activePlayers.filter(
    (player) => player.side === PLAYER_SIDE.LEFT,
  );
  const rightPlayers = activePlayers.filter(
    (player) => player.side === PLAYER_SIDE.RIGHT,
  );
  const showingActive = playerFilterStatus === "active";
  const visiblePlayers = allPlayers.filter(
    (player) => (player.active !== false) === showingActive,
  );

  updateFilterButtons(
    elements.playerFilterButtons,
    playerFilterStatus,
    "playerFilter",
  );

  elements.playersGroupName.textContent = group.name;
  elements.playerTargetGroup.textContent = `Este jogador será adicionado automaticamente à patota “${group.name}”.`;
  elements.playersTotalCount.textContent = activePlayers.length;
  elements.playersLeftCount.textContent = leftPlayers.length;
  elements.playersRightCount.textContent = rightPlayers.length;

  if (!visiblePlayers.length) {
    elements.playersList.innerHTML = `
      <div class="empty-state empty-state--compact">
        <span class="empty-state__icon">${showingActive ? "👥" : "🛌"}</span>
        <strong>${showingActive ? "Nenhum jogador ativo nesta patota" : "Nenhum jogador inativo nesta patota"}</strong>
        <span>${showingActive ? "Cadastre um jogador novo ou adicione alguém que já existe no FuteMatch." : "Jogadores inativados aparecerão aqui e poderão ser reativados."}</span>
      </div>`;
  } else {
    elements.playersList.innerHTML = visiblePlayers
      .map((player) => {
        const sideLabel =
          player.side === PLAYER_SIDE.LEFT ? "Esquerda" : "Direita";
        const actions = showingActive
          ? `
            <button class="button button--ghost button--small" type="button" data-remove-player="${player.id}">Remover da patota</button>
            <button class="button button--danger-ghost button--small" type="button" data-set-player-active="false" data-player-id="${player.id}">Inativar</button>`
          : `
            <button class="button button--secondary button--small" type="button" data-set-player-active="true" data-player-id="${player.id}">Reativar</button>`;

        return `
          <article class="player-row ${showingActive ? "" : "player-row--inactive"}">
            <span class="avatar">${escapeHtml(player.name.charAt(0).toUpperCase())}</span>
            <div class="player-row__identity">
              <strong>${escapeHtml(player.name)}</strong>
              <small>${formatDate(player.birthDate)}</small>
            </div>
            <span class="side-pill side-pill--${player.side}">${sideLabel}</span>
            ${showingActive ? "" : '<span class="status-pill">Inativo</span>'}
            <div class="row-actions">${actions}</div>
          </article>`;
      })
      .join("");
  }

  const availablePlayers = repository.getPlayersNotInGroup(group.id);
  const showExistingPlayerBox =
    showingActive && availablePlayers.length > 0;

  elements.existingPlayerBox.classList.toggle(
    "is-hidden",
    !showExistingPlayerBox,
  );
  elements.existingPlayerSelect.innerHTML = availablePlayers
    .map((player) => {
      const sideLabel =
        player.side === PLAYER_SIDE.LEFT ? "Esquerda" : "Direita";
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
  const leftCount = selected.filter(
    (input) => input.dataset.playerSide === PLAYER_SIDE.LEFT,
  ).length;
  const rightCount = selected.filter(
    (input) => input.dataset.playerSide === PLAYER_SIDE.RIGHT,
  ).length;
  const isValid = leftCount >= 2 && leftCount === rightCount;

  elements.selectionSummaryTitle.textContent = `${selected.length} jogador${selected.length === 1 ? "" : "es"} selecionado${selected.length === 1 ? "" : "s"}`;

  if (isValid) {
    elements.selectionSummaryDescription.textContent = `${leftCount} de esquerda + ${rightCount} de direita • ${leftCount} duplas serão formadas.`;
  } else if (leftCount < 2 || rightCount < 2) {
    elements.selectionSummaryDescription.textContent =
      "Selecione pelo menos 2 jogadores de cada lado.";
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
    elements.drawEmptyDescription.textContent =
      "O sorteio precisa saber qual grupo de jogadores usar.";
    elements.drawEmptyAction.textContent = "Escolher patota";
    elements.drawEmptyAction.dataset.targetPage = "groups";
    return;
  }

  const players = repository.getPlayersByGroup(group.id);
  const leftPlayers = players.filter(
    (player) => player.side === PLAYER_SIDE.LEFT,
  );
  const rightPlayers = players.filter(
    (player) => player.side === PLAYER_SIDE.RIGHT,
  );
  const canDraw = leftPlayers.length >= 2 && rightPlayers.length >= 2;

  elements.drawEmptyState.classList.toggle("is-hidden", canDraw);
  elements.drawContent.classList.toggle("is-hidden", !canDraw);

  if (!canDraw) {
    elements.drawEmptyTitle.textContent =
      "Faltam jogadores para formar as duplas";
    elements.drawEmptyDescription.textContent = `${group.name} precisa ter pelo menos 2 jogadores ativos de esquerda e 2 de direita. Hoje há ${leftPlayers.length} de esquerda e ${rightPlayers.length} de direita.`;
    elements.drawEmptyAction.textContent = "Gerenciar jogadores";
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
    leftPlayers: selected.filter(
      (player) => player.side === PLAYER_SIDE.LEFT,
    ),
    rightPlayers: selected.filter(
      (player) => player.side === PLAYER_SIDE.RIGHT,
    ),
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
  const leftCount = players.filter(
    (player) => player.side === PLAYER_SIDE.LEFT,
  ).length;
  const rightCount = players.filter(
    (player) => player.side === PLAYER_SIDE.RIGHT,
  ).length;

  return leftCount >= 2 && rightCount >= 2 ? "draw" : "players";
};

elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

elements.goToButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.goTo));
});

elements.groupFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    groupFilterStatus = button.dataset.groupFilter;
    renderGroups();
  });
});

elements.playerFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    playerFilterStatus = button.dataset.playerFilter;
    renderPlayers();
  });
});

elements.currentGroupSelect.addEventListener("change", () => {
  repository.setCurrentGroup(elements.currentGroupSelect.value);
  playerFilterStatus = "active";
  renderAll();
  showPage("players");
  showToast("Patota alterada.");
});

elements.groupsList.addEventListener("click", (event) => {
  const selectButton = event.target.closest("[data-select-group]");
  if (selectButton) {
    repository.setCurrentGroup(selectButton.dataset.selectGroup);
    playerFilterStatus = "active";
    renderAll();
    showPage("players");
    return;
  }

  const statusButton = event.target.closest("[data-set-group-active]");
  if (!statusButton) return;

  const groupId = statusButton.dataset.groupId;
  const shouldActivate = statusButton.dataset.setGroupActive === "true";
  const group = repository
    .getGroups({ active: null })
    .find((item) => item.id === groupId);

  if (!group) return;

  if (
    !shouldActivate &&
    !window.confirm(
      `Inativar a patota “${group.name}”?\n\nEla deixará de aparecer nos sorteios, mas jogadores e histórico serão preservados.`,
    )
  ) {
    return;
  }

  repository.setGroupActive(groupId, shouldActivate);
  renderAll();
  showPage("groups");
  showToast(
    shouldActivate
      ? `Patota “${group.name}” reativada.`
      : `Patota “${group.name}” inativada.`,
  );
});

elements.groupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.groupError.textContent = "";

  try {
    const group = repository.createGroup(elements.groupName.value);
    repository.setCurrentGroup(group.id);
    groupFilterStatus = "active";
    playerFilterStatus = "active";
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
    playerFilterStatus = "active";
    elements.playerForm.reset();
    renderAll();
    showPage("players");
    showToast(`${player.name} foi adicionado à patota.`);
    elements.playerName.focus();
  } catch (error) {
    elements.playerError.textContent = error.message;
  }
});

elements.playersList.addEventListener("click", (event) => {
  const group = getCurrentGroup();
  if (!group) return;

  const removeButton = event.target.closest("[data-remove-player]");
  if (removeButton) {
    const playerId = removeButton.dataset.removePlayer;
    const player = repository
      .getPlayers({ active: null })
      .find((item) => item.id === playerId);

    if (
      player &&
      window.confirm(
        `Remover ${player.name} da patota “${group.name}”?\n\nO jogador continuará cadastrado no FuteMatch e nas outras patotas.`,
      )
    ) {
      repository.removePlayerFromGroup(playerId, group.id);
      renderAll();
      showPage("players");
      showToast(`${player.name} foi removido apenas desta patota.`);
    }
    return;
  }

  const statusButton = event.target.closest("[data-set-player-active]");
  if (!statusButton) return;

  const playerId = statusButton.dataset.playerId;
  const shouldActivate = statusButton.dataset.setPlayerActive === "true";
  const player = repository
    .getPlayers({ active: null })
    .find((item) => item.id === playerId);

  if (!player) return;

  if (
    !shouldActivate &&
    !window.confirm(
      `Inativar ${player.name}?\n\nEle deixará de aparecer nos sorteios de todas as patotas, mas continuará no cadastro e no histórico.`,
    )
  ) {
    return;
  }

  repository.setPlayerActive(playerId, shouldActivate);
  renderAll();
  showPage("players");
  showToast(
    shouldActivate
      ? `${player.name} foi reativado.`
      : `${player.name} foi inativado.`,
  );
});

elements.addExistingPlayerButton.addEventListener("click", () => {
  elements.existingPlayerError.textContent = "";
  const group = getCurrentGroup();
  const playerId = elements.existingPlayerSelect.value;
  if (!group || !playerId) return;

  try {
    repository.addPlayerToGroup(playerId, group.id);
    const player = repository
      .getPlayers({ active: null })
      .find((item) => item.id === playerId);
    playerFilterStatus = "active";
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
