import { GROUP_WEEKDAY_LABEL } from "./domain/Group.js";
import { PLAYER_SIDE } from "./domain/Player.js";
import { AuthService } from "./services/AuthService.js";
import { DrawService } from "./services/DrawService.js";
import { SupabaseFuteMatchRepository } from "./services/SupabaseFuteMatchRepository.js";
import { RankingService } from "./services/RankingService.js";
import { DrawView } from "./ui/DrawView.js";
import { supabase } from "./supabaseClient.js";

const repository = new SupabaseFuteMatchRepository(supabase);
const authService = new AuthService(supabase, repository);
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  authScreen: $("#auth-screen"), app: $("#app"), authTabs: $$("[data-auth-tab]"),
  loginForm: $("#login-form"), loginEmail: $("#login-email"), loginPassword: $("#login-password"), loginError: $("#login-error"),
  registerForm: $("#register-form"), registerName: $("#register-name"), registerEmail: $("#register-email"), registerBirthDate: $("#register-birth-date"), registerSide: $("#register-side"), registerPassword: $("#register-password"), registerError: $("#register-error"), registerMessage: $("#register-message"),
  sidebar: $(".sidebar"), mobileMenuButton: $("#mobile-menu-button"), navItems: $$("[data-page]"), pages: $$("[data-page-section]"), goToButtons: $$("[data-go-to]"),
  profileAvatar: $("#profile-avatar"), profileName: $("#profile-name"), profileSide: $("#profile-side"), logoutButton: $("#logout-button"), welcomeTitle: $("#welcome-title"),
  myGroupsList: $("#my-groups-list"), groupForm: $("#group-form"), groupName: $("#group-name"), groupWeekday: $("#group-weekday"), groupStartTime: $("#group-start-time"), groupEndTime: $("#group-end-time"), groupError: $("#group-error"),
  detailGroupName: $("#detail-group-name"), detailGroupSchedule: $("#detail-group-schedule"), detailMemberCount: $("#detail-member-count"), detailPresentCount: $("#detail-present-count"), detailTime: $("#detail-time"), detailMembers: $("#detail-members"), detailManagementPanel: $("#detail-management-panel"), detailScheduleForm: $("#detail-schedule-form"), detailWeekday: $("#detail-weekday"), detailStartTime: $("#detail-start-time"), detailEndTime: $("#detail-end-time"), detailScheduleError: $("#detail-schedule-error"), detailAddPlayerSelect: $("#detail-add-player-select"), detailAddPlayerButton: $("#detail-add-player-button"), detailAddPlayerError: $("#detail-add-player-error"),
  attendanceDateLabel: $("#attendance-date-label"), attendanceList: $("#attendance-list"),
  barbecueList: $("#barbecue-list"), barbecueOrganizerPanel: $("#barbecue-organizer-panel"), barbecueForm: $("#barbecue-form"), barbecueGroupSelect: $("#barbecue-group-select"), barbecueDate: $("#barbecue-date"), barbecueError: $("#barbecue-error"), barbecueOrganizerEvents: $("#barbecue-organizer-events"),
  drawGroupSelect: $("#draw-group-select"), drawEmpty: $("#draw-empty"), drawContent: $("#draw-content"), drawForm: $("#draw-form"), leftPlayerOptions: $("#left-player-options"), rightPlayerOptions: $("#right-player-options"), selectionSummaryTitle: $("#selection-summary-title"), selectionSummaryDescription: $("#selection-summary-description"), drawButton: $("#draw-button"), redrawButton: $("#redraw-button"), formError: $("#form-error"), resultsSection: $("#results-section"), pairsList: $("#pairs-list"), pairTemplate: $("#pair-template"),
  resultsGroupSelect: $("#results-group-select"), resultsDate: $("#results-date"), pairResultsList: $("#pair-results-list"), manualPairForm: $("#manual-pair-form"), manualLeftPlayer: $("#manual-left-player"), manualRightPlayer: $("#manual-right-player"), manualWins: $("#manual-wins"), manualPairError: $("#manual-pair-error"),
  rankingGroupSelect: $("#ranking-group-select"), rankingLeft: $("#ranking-left"), rankingRight: $("#ranking-right"), toast: $("#toast"),
};

const drawView = new DrawView({ resultsSection: elements.resultsSection, pairsList: elements.pairsList, pairTemplate: elements.pairTemplate, errorElement: elements.formError });

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const formatDate = (value) => new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
const daysUntil = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = today().split("-").map(Number);
  return Math.round(
    (Date.UTC(year, month - 1, day) -
      Date.UTC(currentYear, currentMonth - 1, currentDay)) /
      86400000,
  );
};
const sideLabel = (side) =>
  side === PLAYER_SIDE.LEFT ? "Esquerda" : "Direita";
const weekdayLabel = (weekday) =>
  GROUP_WEEKDAY_LABEL[Number(weekday)] ?? "Dia não definido";
const scheduleLabel = (group) => {
  const day = weekdayLabel(group.weekday);
  const time =
    group.startTime && group.endTime
      ? `${group.startTime} às ${group.endTime}`
      : "Horário não definido";
  return `${day} • ${time}`;
};

const showToast = (message) => {
  clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
};

const currentPlayer = () => repository.getCurrentPlayer();
const currentAccount = () => repository.getCurrentAccount();
const myGroups = () => currentAccount()
  ? repository.getGroupsForUser(currentAccount().id)
  : [];

const canAccessGroup = (groupId) =>
  Boolean(currentAccount() && repository.isUserInGroup(currentAccount().id, groupId));

const selectAccessibleGroup = (groupId) => {
  if (!canAccessGroup(groupId)) {
    showToast("Essa patota não está vinculada ao seu usuário.");
    return false;
  }

  repository.setCurrentGroup(groupId);
  return true;
};

const showPage = (name) => {
  elements.pages.forEach((page) => page.classList.toggle("is-hidden", page.dataset.pageSection !== name));
  elements.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.page === name));
  elements.sidebar.classList.remove("is-open");
  if (name === "groups") renderMyGroups();
  if (name === "group-detail") renderGroupDetail();
  if (name === "attendance") renderAttendance();
  if (name === "barbecue") renderBarbecue();
  if (name === "draw") renderDraw();
  if (name === "results") renderResults();
  if (name === "ranking") renderRanking();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const showAuthTab = (tab) => {
  elements.authTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.authTab === tab));
  elements.loginForm.classList.toggle("is-hidden", tab !== "login");
  elements.registerForm.classList.toggle("is-hidden", tab !== "register");
};

const renderProfile = () => {
  const player = currentPlayer();
  if (!player) return;
  elements.profileAvatar.textContent = player.name.charAt(0).toUpperCase();
  elements.profileName.textContent = player.name;
  elements.profileSide.textContent = sideLabel(player.side);
  elements.welcomeTitle.textContent = `Fala, ${player.name.split(" ")[0]}!`;
};

const groupOptions = (select, groups, preferredId) => {
  const selected = preferredId && groups.some((group) => group.id === preferredId) ? preferredId : groups[0]?.id;
  select.innerHTML = groups.length ? groups.map((group) => `<option value="${group.id}" ${group.id === selected ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("") : '<option value="">Nenhuma patota</option>';
  return selected ?? null;
};

const renderMyGroups = () => {
  const groups = myGroups();
  if (!groups.length) {
    elements.myGroupsList.innerHTML = `<div class="empty-state"><strong>Você ainda não está em nenhuma patota</strong><span>Crie a sua primeira patota ou peça para um organizador adicionar seu atleta.</span><button class="button button--primary" type="button" data-empty-create>+ Criar patota</button></div>`;
    elements.myGroupsList.querySelector("[data-empty-create]")?.addEventListener("click", () => showPage("create-group"));
    return;
  }

  const player = currentPlayer();
  const date = today();

  elements.myGroupsList.innerHTML = groups
    .map((group) => {
      const attendanceWindow = repository.getAttendanceWindow(group.id, date);
      const attendance = attendanceWindow.targetDate
        ? repository.getPlayerAttendance(
            group.id,
            player.id,
            attendanceWindow.targetDate,
          )
        : null;
      const members = repository.getPlayersByGroup(group.id).length;
      const isOwner = group.ownerUserId === currentAccount()?.id;

      let status = "Dia não definido";
      if (attendanceWindow.available) {
        if (!attendanceWindow.isOpen) {
          status = `Votação abre ${formatDate(attendanceWindow.opensOn)}`;
        } else if (attendance?.status === "present") {
          status = "Presença confirmada";
        } else if (attendance?.status === "absent") {
          status = "Ausência informada";
        } else {
          status = "Presença pendente";
        }
      }

      return `<article class="group-card"><div class="group-card__top"><span class="group-card__icon">🏖️</span><div class="group-card__badges">${isOwner ? '<span class="meta-chip owner-chip">Organizador</span>' : ""}<div class="group-card__status"><span class="meta-chip">👥 ${members} atletas</span><span class="meta-chip">${escapeHtml(status)}</span></div></div></div><h2>${escapeHtml(group.name)}</h2><p>${scheduleLabel(group)}</p><div class="group-card__actions"><button class="button button--secondary button--small" type="button" data-open-group="${group.id}">Ver patota</button><button class="button button--ghost button--small" type="button" data-presence-group="${group.id}">Presença</button></div></article>`;
    })
    .join("");
};

const renderGroupDetail = () => {
  const group = repository.getGroupById(repository.getCurrentGroupId());
  const account = currentAccount();

  if (!group || !account || !repository.isUserInGroup(account.id, group.id)) {
    repository.setCurrentGroup(null);
    showPage("groups");
    return;
  }

  const players = repository.getPlayersByGroup(group.id);
  const attendanceWindow = repository.getAttendanceWindow(group.id, today());
  const attendances = attendanceWindow.targetDate
    ? repository.getAttendance(group.id, attendanceWindow.targetDate)
    : [];
  const presentIds = new Set(
    attendances
      .filter((item) => item.status === "present")
      .map((item) => item.playerId),
  );
  const isOwner = repository.isGroupOrganizer(group.id, account.id);
  const ownerPlayerId = repository.getAccountById(group.ownerUserId)?.playerId;

  elements.detailGroupName.textContent = group.name;
  elements.detailGroupSchedule.textContent = `Encontro: ${scheduleLabel(group)}.`;
  elements.detailMemberCount.textContent = players.length;
  elements.detailPresentCount.textContent = presentIds.size;
  elements.detailTime.textContent = group.startTime ?? "--:--";
  elements.detailMembers.innerHTML = players.length
    ? players
        .map(
          (player) =>
            `<div class="member-row"><div class="avatar">${escapeHtml(player.name.charAt(0).toUpperCase())}</div><div class="member-row__text"><strong>${escapeHtml(player.name)}</strong><small>${presentIds.has(player.id) && attendanceWindow.targetDate ? `✅ Confirmado para ${formatDate(attendanceWindow.targetDate)}` : "Presença não confirmada"}</small></div><span class="side-pill side-pill--${player.side}">${sideLabel(player.side)}</span>${isOwner && player.id !== ownerPlayerId ? `<button class="button button--danger button--small member-remove-button" type="button" data-remove-player="${player.id}">Remover</button>` : ""}</div>`,
        )
        .join("")
    : '<div class="empty-state"><span>Nenhum atleta nesta patota.</span></div>';

  elements.detailManagementPanel.classList.toggle("is-hidden", !isOwner);

  if (!isOwner) {
    elements.detailAddPlayerError.textContent = "";
    elements.detailScheduleError.textContent = "";
    return;
  }

  elements.detailWeekday.value = group.weekday ?? "";
  elements.detailStartTime.value = group.startTime ?? "";
  elements.detailEndTime.value = group.endTime ?? "";
  elements.detailScheduleError.textContent = "";

  const available = repository.getPlayersNotInGroup(group.id);
  elements.detailAddPlayerSelect.disabled = !available.length;
  elements.detailAddPlayerButton.disabled = !available.length;
  elements.detailAddPlayerSelect.innerHTML = available.length
    ? available
        .map(
          (player) =>
            `<option value="${player.id}">${escapeHtml(player.name)} — ${sideLabel(player.side)}</option>`,
        )
        .join("")
    : '<option value="">Nenhum atleta disponível</option>';
  elements.detailAddPlayerError.textContent = "";
};

const renderAttendance = () => {
  const groups = myGroups();
  const player = currentPlayer();
  const date = today();

  elements.attendanceDateLabel.textContent = "Janela • 2 dias antes";

  if (!groups.length) {
    elements.attendanceList.innerHTML =
      '<div class="empty-state"><strong>Sem patotas</strong><span>Entre em uma patota para confirmar presença.</span></div>';
    return;
  }

  elements.attendanceList.innerHTML = groups
    .map((group) => {
      const attendanceWindow = repository.getAttendanceWindow(group.id, date);

      if (!attendanceWindow.available) {
        return `<article class="attendance-card"><div class="attendance-card__head"><div><span class="section-kicker">${escapeHtml(group.name)}</span><h2>${scheduleLabel(group)}</h2></div><span class="status-text">Configuração pendente</span></div><p>O organizador precisa definir o dia da semana desta patota antes de abrir a votação de presença.</p><div class="attendance-locked">Dia da semana ainda não definido.</div></article>`;
      }

      const attendance = repository.getPlayerAttendance(
        group.id,
        player.id,
        attendanceWindow.targetDate,
      );
      const present = attendance?.status === "present";
      const absent = attendance?.status === "absent";
      const statusClass = present
        ? "status-text--present"
        : absent
          ? "status-text--absent"
          : "";
      const statusText = attendanceWindow.isOpen
        ? present
          ? "✓ Presença confirmada"
          : absent
            ? "Ausência informada"
            : "Votação aberta"
        : "Votação fechada";

      const occurrenceText =
        attendanceWindow.daysUntil === 0
          ? "Hoje"
          : attendanceWindow.daysUntil === 1
            ? "Amanhã"
            : `${weekdayLabel(group.weekday)}, ${formatDate(attendanceWindow.targetDate)}`;

      if (!attendanceWindow.isOpen) {
        return `<article class="attendance-card"><div class="attendance-card__head"><div><span class="section-kicker">${escapeHtml(group.name)}</span><h2>${occurrenceText} • ${group.startTime ?? "--:--"}</h2></div><span class="status-text">${statusText}</span></div><p>A próxima patota é em <strong>${formatDate(attendanceWindow.targetDate)}</strong>. A votação abre em <strong>${formatDate(attendanceWindow.opensOn)}</strong>, dois dias antes.</p><div class="attendance-locked">🔒 Aguarde a abertura da votação.</div></article>`;
      }

      return `<article class="attendance-card"><div class="attendance-card__head"><div><span class="section-kicker">${escapeHtml(group.name)}</span><h2>${occurrenceText} • ${group.startTime ?? "--:--"}</h2></div><span class="status-text ${statusClass}">${statusText}</span></div><p>Confirme sua presença para <strong>${formatDate(attendanceWindow.targetDate)}</strong>. Participar vale <strong>+2 pontos</strong>.</p><div class="attendance-actions"><button class="button button--success ${present ? "is-selected" : ""}" type="button" data-attendance="present" data-group-id="${group.id}" data-attendance-date="${attendanceWindow.targetDate}">✓ Vou jogar</button><button class="button button--danger ${absent ? "is-selected" : ""}" type="button" data-attendance="absent" data-group-id="${group.id}" data-attendance-date="${attendanceWindow.targetDate}">✕ Não vou</button></div></article>`;
    })
    .join("");
};

const renderBarbecue = () => {
  const account = currentAccount();
  const player = currentPlayer();

  if (!account || !player) return;

  const events = repository.getBarbecueEventsForUser(account.id);
  const organizerGroups = repository.getGroupsOrganizedByUser(account.id);

  elements.barbecueDate.min = today();
  if (!elements.barbecueDate.value) {
    elements.barbecueDate.value = today();
  }

  if (!events.length) {
    elements.barbecueList.innerHTML =
      '<div class="empty-state"><strong>Nenhum churrasco agendado</strong><span>Quando um organizador marcar uma data, ela aparecerá aqui.</span></div>';
  } else {
    elements.barbecueList.innerHTML = events
      .map((event) => {
        const group = repository.getGroupById(event.groupId);
        const confirmation = repository.getPlayerBarbecueConfirmation(
          event.id,
          player.id,
        );
        const remainingDays = daysUntil(event.date);
        const confirmationOpen =
          remainingDays >= 0 && remainingDays <= 7;
        const going = confirmation?.status === "going";
        const notGoing = confirmation?.status === "not_going";

        const availabilityText = confirmationOpen
          ? remainingDays === 0
            ? "É hoje"
            : remainingDays === 1
              ? "É amanhã"
              : `Faltam ${remainingDays} dias`
          : `Confirmação abre em ${remainingDays - 7} dia(s)`;

        return `<article class="barbecue-card"><div class="barbecue-card__head"><div><span class="section-kicker">${escapeHtml(group?.name ?? "Patota")}</span><h3>🔥 ${formatDate(event.date)}</h3></div><span class="meta-chip">${availabilityText}</span></div><p>Ficar no churrasco vale <strong>+4 pontos</strong>.</p>${
          confirmationOpen
            ? `<div class="barbecue-actions"><button class="button button--success ${going ? "is-selected" : ""}" type="button" data-barbecue-response="going" data-barbecue-event="${event.id}">✓ Vou ficar</button><button class="button button--ghost ${notGoing ? "is-selected" : ""}" type="button" data-barbecue-response="not_going" data-barbecue-event="${event.id}">Não vou ficar</button></div>`
            : `<div class="barbecue-locked">A confirmação ficará disponível 7 dias antes.</div>`
        }</article>`;
      })
      .join("");
  }

  elements.barbecueOrganizerPanel.classList.toggle(
    "is-hidden",
    !organizerGroups.length,
  );

  if (!organizerGroups.length) return;

  groupOptions(
    elements.barbecueGroupSelect,
    organizerGroups,
    elements.barbecueGroupSelect.value,
  );

  const organizerEvents =
    repository.getBarbecueEventsOrganizedByUser(account.id);

  if (!organizerEvents.length) {
    elements.barbecueOrganizerEvents.innerHTML =
      '<div class="empty-state empty-state--compact"><span>Você ainda não agendou nenhum churrasco.</span></div>';
    return;
  }

  elements.barbecueOrganizerEvents.innerHTML = organizerEvents
    .map((event) => {
      const group = repository.getGroupById(event.groupId);
      const confirmations = repository.getBarbecueConfirmations(event.id);
      const goingIds = confirmations
        .filter((confirmation) => confirmation.status === "going")
        .map((confirmation) => confirmation.playerId);
      const goingPlayers = goingIds
        .map((playerId) => repository.getPlayerById(playerId))
        .filter(Boolean);

      const confirmedList = goingPlayers.length
        ? goingPlayers
            .map(
              (confirmedPlayer) =>
                `<span class="barbecue-person">🔥 ${escapeHtml(confirmedPlayer.name)}</span>`,
            )
            .join("")
        : '<span class="muted">Ninguém confirmou ainda.</span>';

      return `<article class="barbecue-admin-card"><div class="barbecue-admin-card__head"><div><strong>${escapeHtml(group?.name ?? "Patota")}</strong><small>${formatDate(event.date)} • ${goingPlayers.length} confirmado(s)</small></div><button class="button button--danger button--small" type="button" data-cancel-barbecue="${event.id}">Cancelar</button></div><div class="barbecue-people">${confirmedList}</div></article>`;
    })
    .join("");
};

const playerOption = (player, checked) => `<label class="player-select-card"><input type="checkbox" data-draw-player="${player.id}" data-player-side="${player.side}" ${checked ? "checked" : ""}/><div class="avatar">${escapeHtml(player.name.charAt(0).toUpperCase())}</div><span class="player-select-card__text"><strong>${escapeHtml(player.name)}</strong><small>${sideLabel(player.side)}</small></span></label>`;

const updateSelectionSummary = () => {
  const selected = $$('[data-draw-player]:checked');
  const left = selected.filter((input) => input.dataset.playerSide === PLAYER_SIDE.LEFT).length;
  const right = selected.filter((input) => input.dataset.playerSide === PLAYER_SIDE.RIGHT).length;
  const valid = left >= 2 && left === right;
  elements.selectionSummaryTitle.textContent = `${selected.length} atletas selecionados`;
  elements.selectionSummaryDescription.textContent = valid ? `${left} duplas serão formadas.` : `Selecione a mesma quantidade dos dois lados (mínimo 2 + 2).`;
  elements.drawButton.disabled = !valid;
};

const renderDraw = () => {
  const groups = myGroups();
  const selectedId = groupOptions(elements.drawGroupSelect, groups, elements.drawGroupSelect.value || repository.getCurrentGroupId());
  drawView.clearResults(); drawView.clearError();
  if (!selectedId) { elements.drawEmpty.classList.remove("is-hidden"); elements.drawContent.classList.add("is-hidden"); elements.drawEmpty.innerHTML = '<strong>Você ainda não possui patotas para sortear.</strong>'; return; }
  repository.setCurrentGroup(selectedId);
  const players = repository.getPlayersByGroup(selectedId);
  const left = players.filter((player) => player.side === PLAYER_SIDE.LEFT);
  const right = players.filter((player) => player.side === PLAYER_SIDE.RIGHT);
  if (left.length < 2 || right.length < 2) { elements.drawEmpty.classList.remove("is-hidden"); elements.drawContent.classList.add("is-hidden"); elements.drawEmpty.innerHTML = `<strong>Faltam atletas para o sorteio</strong><span>É preciso ter pelo menos 2 esquerdas e 2 direitas.</span>`; return; }
  elements.drawEmpty.classList.add("is-hidden"); elements.drawContent.classList.remove("is-hidden");
  const attendanceWindow = repository.getAttendanceWindow(selectedId, today());

  if (!attendanceWindow.available) {
    elements.drawEmpty.classList.remove("is-hidden");
    elements.drawContent.classList.add("is-hidden");
    elements.drawEmpty.innerHTML =
      '<strong>Dia da semana não definido</strong><span>O organizador precisa configurar o dia da patota antes do sorteio.</span>';
    return;
  }

  const attendance = repository.getAttendance(
    selectedId,
    attendanceWindow.targetDate,
  );
  const hasResponses = attendance.length > 0;
  const presentIds = new Set(
    attendance
      .filter((item) => item.status === "present")
      .map((item) => item.playerId),
  );
  elements.leftPlayerOptions.innerHTML = left.map((player) => playerOption(player, hasResponses ? presentIds.has(player.id) : true)).join("");
  elements.rightPlayerOptions.innerHTML = right.map((player) => playerOption(player, hasResponses ? presentIds.has(player.id) : true)).join("");
  updateSelectionSummary();
};

const getSelectedPlayers = () => {
  const groupId = elements.drawGroupSelect.value;
  const selectedIds = new Set($$('[data-draw-player]:checked').map((input) => input.dataset.drawPlayer));
  const selected = repository.getPlayersByGroup(groupId).filter((player) => selectedIds.has(player.id));
  return { leftPlayers: selected.filter((player) => player.side === PLAYER_SIDE.LEFT), rightPlayers: selected.filter((player) => player.side === PLAYER_SIDE.RIGHT) };
};

const handleDraw = async () => {
  try {
    drawView.clearError();
    const { leftPlayers, rightPlayers } = getSelectedPlayers();
    const pairs = DrawService.createPairs(leftPlayers, rightPlayers);
    const attendanceWindow = repository.getAttendanceWindow(
      elements.drawGroupSelect.value,
      today(),
    );

    if (!attendanceWindow.available) {
      throw new Error(attendanceWindow.reason);
    }

    await repository.saveDrawPairs(
      elements.drawGroupSelect.value,
      attendanceWindow.targetDate,
      pairs,
    );
    drawView.renderPairs(pairs);
    showToast("Duplas salvas para os resultados da noite.");
  } catch (error) { drawView.showError(error.message); }
};

const renderResults = () => {
  const groups = myGroups();
  const groupId = groupOptions(elements.resultsGroupSelect, groups, elements.resultsGroupSelect.value || repository.getCurrentGroupId());
  if (!elements.resultsDate.value) elements.resultsDate.value = today();
  if (!groupId) { elements.pairResultsList.innerHTML = '<div class="empty-state"><span>Nenhuma patota disponível.</span></div>'; return; }
  const date = elements.resultsDate.value;
  const players = repository.getPlayersByGroup(groupId);
  const byId = new Map(players.map((player) => [player.id, player]));
  const results = repository.getPairResults(groupId, date);
  elements.pairResultsList.innerHTML = results.length ? results.map((result) => `<div class="pair-result-row"><div class="pair-result-row__pair"><strong>${escapeHtml(byId.get(result.leftPlayerId)?.name ?? "Atleta")}</strong><span>+</span><strong>${escapeHtml(byId.get(result.rightPlayerId)?.name ?? "Atleta")}</strong></div><label class="win-control"><span>Vitórias</span><input type="number" min="0" value="${result.wins}" data-result-wins="${result.id}" /></label></div>`).join("") : '<div class="empty-state"><strong>Nenhuma dupla registrada</strong><span>Faça o sorteio ou adicione uma dupla manualmente.</span></div>';
  const left = players.filter((player) => player.side === PLAYER_SIDE.LEFT);
  const right = players.filter((player) => player.side === PLAYER_SIDE.RIGHT);
  elements.manualLeftPlayer.innerHTML = left.map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("");
  elements.manualRightPlayer.innerHTML = right.map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("");
};

const rankingRows = (items) => items.length ? items.map((item, index) => `<div class="ranking-row"><span class="ranking-position">${index + 1}</span><div class="ranking-athlete"><strong>${escapeHtml(item.player.name)}</strong><small>${item.wins} vitórias • ${item.nights} presenças • ${item.barbecues} churrascos</small></div><div class="ranking-score"><strong>${item.totalPoints}</strong><small>pontos</small></div></div>`).join("") : '<div class="empty-state"><span>Ainda não há pontuação.</span></div>';

const renderRanking = () => {
  const groups = myGroups();
  const groupId = groupOptions(elements.rankingGroupSelect, groups, elements.rankingGroupSelect.value || repository.getCurrentGroupId());
  if (!groupId) { elements.rankingLeft.innerHTML = elements.rankingRight.innerHTML = '<div class="empty-state"><span>Sem patotas.</span></div>'; return; }
  const ranking = RankingService.calculate(repository.getRankingData(groupId));
  elements.rankingLeft.innerHTML = rankingRows(ranking.left);
  elements.rankingRight.innerHTML = rankingRows(ranking.right);
};

const renderApp = () => {
  renderProfile(); renderMyGroups();
  const groups = myGroups();
  if (groups.length && !repository.getCurrentGroupId()) repository.setCurrentGroup(groups[0].id);
};

const enterApp = () => { elements.authScreen.classList.add("is-hidden"); elements.app.classList.remove("is-hidden"); renderApp(); showPage("groups"); };
const enterAuth = () => { elements.app.classList.add("is-hidden"); elements.authScreen.classList.remove("is-hidden"); showAuthTab("login"); };

// Auth
elements.authTabs.forEach((button) => button.addEventListener("click", () => showAuthTab(button.dataset.authTab)));
elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginError.textContent = "";

  try {
    await authService.login(
      elements.loginEmail.value,
      elements.loginPassword.value,
    );
    elements.loginForm.reset();
    enterApp();
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.registerError.textContent = "";
  elements.registerMessage.textContent = "";

  try {
    const result = await authService.register({
      email: elements.registerEmail.value,
      password: elements.registerPassword.value,
      name: elements.registerName.value,
      birthDate: elements.registerBirthDate.value,
      side: elements.registerSide.value,
    });

    if (result.requiresEmailConfirmation) {
      elements.registerMessage.textContent =
        "Conta criada. Confira seu e-mail para confirmar o cadastro e depois faça login.";
      elements.registerPassword.value = "";
      return;
    }

    elements.registerForm.reset();
    enterApp();
    showToast("Conta criada. Bem-vindo ao FuteMatch!");
  } catch (error) {
    elements.registerError.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await authService.logout();
    enterAuth();
  } catch (error) {
    showToast(error.message);
  }
});

// Navigation
elements.navItems.forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
elements.goToButtons.forEach((button) => button.addEventListener("click", () => showPage(button.dataset.goTo)));
elements.mobileMenuButton.addEventListener("click", () => elements.sidebar.classList.toggle("is-open"));

// Groups
elements.groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.groupError.textContent = "";

  try {
    const group = await repository.createGroup({
      name: elements.groupName.value,
      weekday: elements.groupWeekday.value,
      startTime: elements.groupStartTime.value,
      endTime: elements.groupEndTime.value,
    });

    elements.groupForm.reset();
    repository.setCurrentGroup(group.id);
    renderApp();
    showPage("group-detail");
    showToast(`Patota “${group.name}” criada.`);
  } catch (error) {
    elements.groupError.textContent = error.message;
  }
});
elements.myGroupsList.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-group]");
  const presence = event.target.closest("[data-presence-group]");
  const groupId = open?.dataset.openGroup ?? presence?.dataset.presenceGroup;

  if (!groupId || !selectAccessibleGroup(groupId)) return;

  if (open) showPage("group-detail");
  else showPage("attendance");
});

elements.detailScheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.detailScheduleError.textContent = "";

  try {
    await repository.updateGroupSchedule(
      repository.getCurrentGroupId(),
      {
        weekday: elements.detailWeekday.value,
        startTime: elements.detailStartTime.value,
        endTime: elements.detailEndTime.value,
      },
      currentAccount()?.id,
    );
    renderGroupDetail();
    renderMyGroups();
    showToast("Dia e horário da patota atualizados.");
  } catch (error) {
    elements.detailScheduleError.textContent = error.message;
  }
});

elements.detailAddPlayerButton.addEventListener("click", async () => {
  elements.detailAddPlayerError.textContent = "";
  const groupId = repository.getCurrentGroupId();
  const playerId = elements.detailAddPlayerSelect.value;

  if (!playerId) return;

  try {
    await repository.addPlayerToGroup(
      playerId,
      groupId,
      currentAccount()?.id,
    );
    renderGroupDetail();
    renderMyGroups();
    showToast("Atleta adicionado à patota.");
  } catch (error) {
    elements.detailAddPlayerError.textContent = error.message;
  }
});

elements.detailMembers.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-player]");
  if (!button) return;

  const groupId = repository.getCurrentGroupId();
  const player = repository.getPlayerById(button.dataset.removePlayer);

  if (!player) return;

  if (!window.confirm(`Remover ${player.name} desta patota?`)) return;

  try {
    await repository.removePlayerFromGroup(
      player.id,
      groupId,
      currentAccount()?.id,
    );
    renderGroupDetail();
    renderMyGroups();
    showToast(`${player.name} foi removido da patota.`);
  } catch (error) {
    showToast(error.message);
  }
});

// Attendance
elements.attendanceList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-attendance]");
  if (!button) return;

  try {
    await repository.setAttendance({
      groupId: button.dataset.groupId,
    playerId: currentPlayer().id,
    date: button.dataset.attendanceDate,
    status: button.dataset.attendance,
      currentDate: today(),
    });

    renderAttendance();
    renderMyGroups();
    showToast(
      button.dataset.attendance === "present"
        ? "Presença confirmada: +2 pontos."
        : "Ausência registrada.",
    );
  } catch (error) {
    showToast(error.message);
  }
});

// Barbecue
elements.barbecueForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.barbecueError.textContent = "";

  try {
    await repository.scheduleBarbecue(
      elements.barbecueGroupSelect.value,
      elements.barbecueDate.value,
      currentAccount()?.id,
    );
    renderBarbecue();
    showToast("Churrasco agendado. A confirmação abre 7 dias antes.");
  } catch (error) {
    elements.barbecueError.textContent = error.message;
  }
});

elements.barbecueList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-barbecue-response]");
  if (!button) return;

  try {
    await repository.setBarbecueConfirmation({
      eventId: button.dataset.barbecueEvent,
      playerId: currentPlayer().id,
      status: button.dataset.barbecueResponse,
      currentDate: today(),
    });
    renderBarbecue();
    showToast(
      button.dataset.barbecueResponse === "going"
        ? "Churrasco confirmado. Os +4 pontos entram no ranking na data do evento."
        : "Você informou que não ficará no churrasco.",
    );
  } catch (error) {
    showToast(error.message);
  }
});

elements.barbecueOrganizerEvents.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel-barbecue]");
  if (!button) return;

  if (!window.confirm("Cancelar este churrasco?")) return;

  try {
    await repository.cancelBarbecue(
      button.dataset.cancelBarbecue,
      currentAccount()?.id,
    );
    renderBarbecue();
    showToast("Churrasco cancelado.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.barbecueGroupSelect.addEventListener("change", renderBarbecue);

// Draw
elements.drawGroupSelect.addEventListener("change", () => {
  if (selectAccessibleGroup(elements.drawGroupSelect.value)) {
    renderDraw();
  }
});
elements.drawForm.addEventListener("change", (event) => { if (event.target.matches("[data-draw-player]")) { drawView.clearResults(); updateSelectionSummary(); } });
elements.drawForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleDraw();
});
elements.redrawButton.addEventListener("click", async () => {
  await handleDraw();
});

// Results
elements.resultsGroupSelect.addEventListener("change", renderResults);
elements.resultsDate.addEventListener("change", renderResults);
elements.pairResultsList.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-result-wins]");
  if (!input) return;

  try {
    await repository.updatePairWins(
      input.dataset.resultWins,
      input.value,
    );
    showToast("Vitórias atualizadas.");
  } catch (error) {
    showToast(error.message);
    renderResults();
  }
});
elements.manualPairForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.manualPairError.textContent = "";

  try {
    await repository.addPairResult({
      groupId: elements.resultsGroupSelect.value,
      date: elements.resultsDate.value || today(),
      leftPlayerId: elements.manualLeftPlayer.value,
      rightPlayerId: elements.manualRightPlayer.value,
      wins: elements.manualWins.value,
    });
    elements.manualWins.value = 0;
    renderResults();
    showToast("Dupla registrada.");
  } catch (error) {
    elements.manualPairError.textContent = error.message;
  }
});

// Ranking
elements.rankingGroupSelect.addEventListener("change", renderRanking);

await repository.initialize();

if (authService.getCurrentAccount()) {
  enterApp();
} else {
  enterAuth();
}

supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    if (event === "SIGNED_IN" && session?.user) {
      repository.setAuthenticatedUser(session.user);
      await repository.sync();

      if (elements.app.classList.contains("is-hidden")) {
        enterApp();
      }
    }

    if (event === "SIGNED_OUT") {
      repository.setAuthenticatedUser(null);
      enterAuth();
    }
  }, 0);
});
