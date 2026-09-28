import { Group } from "../domain/Group.js";
import { Player } from "../domain/Player.js";

const STORAGE_KEY = "futematch:data:v2";
const LEGACY_STORAGE_KEY = "futematch:data:v1";

const initialState = () => ({
  groups: [],
  players: [],
  memberships: [],
  accounts: [],
  sessions: [],
  attendances: [],
  pairResults: [],
  barbecueEvents: [],
  barbecueConfirmations: [],
  currentGroupId: null,
  currentUserId: null,
});

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const matchesActiveStatus = (item, active) =>
  active === null ? true : (item.active !== false) === active;

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? "");
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const daysBetween = (fromDate, toDate) => {
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
};

export class FuteMatchRepository {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  getState() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        return { ...initialState(), ...JSON.parse(raw) };
      }

      const legacyRaw = this.storage?.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const migrated = { ...initialState(), ...JSON.parse(legacyRaw) };
        this.#save(migrated);
        return migrated;
      }

      return initialState();
    } catch {
      return initialState();
    }
  }

  #save(state) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getGroups({ active = true } = {}) {
    return this.getState().groups
      .filter((group) => matchesActiveStatus(group, active))
      .map(Group.fromJSON);
  }

  getGroupById(groupId) {
    const group = this.getState().groups.find((item) => item.id === groupId);
    return group ? Group.fromJSON(group) : null;
  }

  getPlayers({ active = true } = {}) {
    return this.getState().players
      .filter((player) => matchesActiveStatus(player, active))
      .map(Player.fromJSON);
  }

  getPlayerById(playerId) {
    const player = this.getState().players.find((item) => item.id === playerId);
    return player ? Player.fromJSON(player) : null;
  }

  getAccounts() {
    return this.getState().accounts.map((account) => ({ ...account }));
  }

  getAccountByEmail(email) {
    const account = this.getState().accounts.find(
      (item) => normalize(item.email) === normalize(email),
    );
    return account ? { ...account } : null;
  }

  getAccountById(userId) {
    const account = this.getState().accounts.find((item) => item.id === userId);
    return account ? { ...account } : null;
  }

  createAccount({ email, passwordHash, name, birthDate, side }) {
    const state = this.getState();
    const normalizedEmail = normalize(email);

    if (!normalizedEmail || !email.includes("@")) {
      throw new Error("Informe um e-mail válido.");
    }

    if (state.accounts.some((account) => normalize(account.email) === normalizedEmail)) {
      throw new Error("Já existe uma conta com este e-mail.");
    }

    let player = state.players.find(
      (item) => normalize(item.name) === normalize(name) && item.birthDate === birthDate,
    );

    if (player) {
      const alreadyLinked = state.accounts.some((account) => account.playerId === player.id);
      if (alreadyLinked) {
        throw new Error("Este atleta já possui uma conta de acesso.");
      }

      if (player.side !== side) {
        throw new Error("Já existe um atleta com esse nome e nascimento em outro lado.");
      }

      player.active = true;
    } else {
      player = new Player(name, side, { birthDate });
      state.players.push(player);
    }

    const account = {
      id: crypto.randomUUID(),
      email: email.trim().toLocaleLowerCase("pt-BR"),
      passwordHash,
      playerId: player.id,
      active: true,
      createdAt: new Date().toISOString(),
    };

    state.accounts.push(account);
    state.currentUserId = account.id;
    this.#save(state);
    return { ...account };
  }

  setCurrentUser(userId) {
    const state = this.getState();
    const valid = state.accounts.some(
      (account) => account.id === userId && account.active !== false,
    );
    state.currentUserId = valid ? userId : null;
    this.#save(state);
  }

  getCurrentUserId() {
    return this.getState().currentUserId;
  }

  getCurrentAccount() {
    const state = this.getState();
    const account = state.accounts.find(
      (item) => item.id === state.currentUserId && item.active !== false,
    );
    return account ? { ...account } : null;
  }

  getCurrentPlayer() {
    const account = this.getCurrentAccount();
    return account ? this.getPlayerById(account.playerId) : null;
  }

  signOut() {
    const state = this.getState();
    state.currentUserId = null;
    state.currentGroupId = null;
    this.#save(state);
  }

  getCurrentGroupId() {
    return this.getState().currentGroupId;
  }

  setCurrentGroup(groupId) {
    const state = this.getState();
    const exists =
      groupId &&
      state.groups.some((group) => group.id === groupId && group.active !== false);

    state.currentGroupId = exists ? groupId : null;
    this.#save(state);
  }

  createGroup({ name, startTime, endTime, ownerUserId, ownerPlayerId }) {
    const state = this.getState();

    if (!name?.trim()) {
      throw new Error("Informe o nome da patota.");
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      throw new Error("Informe os horários de início e fim da patota.");
    }

    if (startTime === endTime) {
      throw new Error("O horário de início e fim não podem ser iguais.");
    }

    if (state.groups.some((group) => normalize(group.name) === normalize(name))) {
      throw new Error("Já existe uma patota com esse nome.");
    }

    const group = new Group(name, { startTime, endTime, ownerUserId });
    state.groups.push(group);

    if (ownerPlayerId) {
      state.memberships.push({
        groupId: group.id,
        playerId: ownerPlayerId,
        active: true,
        joinedAt: new Date().toISOString(),
      });
    }

    state.currentGroupId = group.id;
    this.#save(state);
    return group;
  }

  setGroupActive(groupId, active) {
    const state = this.getState();
    const group = state.groups.find((item) => item.id === groupId);

    if (!group) {
      throw new Error("Patota não encontrada.");
    }

    group.active = Boolean(active);

    if (!active && state.currentGroupId === groupId) {
      state.currentGroupId =
        state.groups.find(
          (item) => item.id !== groupId && item.active !== false,
        )?.id ?? null;
    }

    if (active && !state.currentGroupId) {
      state.currentGroupId = groupId;
    }

    this.#save(state);
  }

  createPlayer({ name, birthDate, side, groupIds = [] }) {
    const state = this.getState();

    if (state.players.some((player) => normalize(player.name) === normalize(name))) {
      throw new Error("Esse jogador já está cadastrado.");
    }

    if (!birthDate) {
      throw new Error("Informe a data de nascimento.");
    }

    const player = new Player(name, side, { birthDate });
    state.players.push(player);

    const validGroupIds = new Set(
      state.groups
        .filter((group) => group.active !== false)
        .map((group) => group.id),
    );

    groupIds
      .filter((groupId) => validGroupIds.has(groupId))
      .forEach((groupId) => {
        state.memberships.push({
          groupId,
          playerId: player.id,
          active: true,
          joinedAt: new Date().toISOString(),
        });
      });

    this.#save(state);
    return player;
  }

  setPlayerActive(playerId, active) {
    const state = this.getState();
    const player = state.players.find((item) => item.id === playerId);

    if (!player) {
      throw new Error("Jogador não encontrado.");
    }

    player.active = Boolean(active);
    this.#save(state);
  }

  getPlayersByGroup(groupId, { includeInactive = false } = {}) {
    if (!groupId) return [];

    const state = this.getState();
    const playerIds = new Set(
      state.memberships
        .filter(
          (membership) => membership.groupId === groupId && membership.active,
        )
        .map((membership) => membership.playerId),
    );

    return state.players
      .filter(
        (player) =>
          playerIds.has(player.id) &&
          (includeInactive || player.active !== false),
      )
      .map(Player.fromJSON);
  }

  getPlayersNotInGroup(groupId) {
    const state = this.getState();
    const playerIds = new Set(
      state.memberships
        .filter(
          (membership) => membership.groupId === groupId && membership.active,
        )
        .map((membership) => membership.playerId),
    );

    return state.players
      .filter((player) => player.active !== false && !playerIds.has(player.id))
      .map(Player.fromJSON);
  }

  getGroupsByPlayer(playerId, { includeInactive = false } = {}) {
    const state = this.getState();
    const groupIds = new Set(
      state.memberships
        .filter(
          (membership) =>
            membership.playerId === playerId && membership.active,
        )
        .map((membership) => membership.groupId),
    );

    return state.groups
      .filter(
        (group) =>
          groupIds.has(group.id) &&
          (includeInactive || group.active !== false),
      )
      .map(Group.fromJSON);
  }

  getGroupsForUser(userId, { includeInactive = false } = {}) {
    const account = this.getAccountById(userId);

    if (!account || account.active === false) {
      return [];
    }

    return this.getGroupsByPlayer(account.playerId, { includeInactive });
  }

  getGroupsOrganizedByUser(userId, { includeInactive = false } = {}) {
    return this.getState().groups
      .filter(
        (group) =>
          group.ownerUserId === userId &&
          (includeInactive || group.active !== false),
      )
      .map(Group.fromJSON);
  }

  isUserInGroup(userId, groupId) {
    const account = this.getAccountById(userId);
    return Boolean(account && this.isPlayerInGroup(account.playerId, groupId));
  }

  isGroupOrganizer(groupId, userId) {
    const group = this.getState().groups.find((item) => item.id === groupId);
    return Boolean(group?.ownerUserId && group.ownerUserId === userId);
  }

  isPlayerInGroup(playerId, groupId) {
    return this.getState().memberships.some(
      (membership) =>
        membership.playerId === playerId &&
        membership.groupId === groupId &&
        membership.active,
    );
  }

  #assertGroupOrganizer(state, groupId, actorUserId) {
    const group = state.groups.find((item) => item.id === groupId);

    if (!group) {
      throw new Error("Patota não encontrada.");
    }

    if (!group.ownerUserId || group.ownerUserId !== actorUserId) {
      throw new Error("Somente o organizador da patota pode gerenciar atletas.");
    }

    return group;
  }

  addPlayerToGroup(playerId, groupId, actorUserId) {
    const state = this.getState();
    const player = state.players.find((item) => item.id === playerId);
    const group = this.#assertGroupOrganizer(state, groupId, actorUserId);

    if (!player) {
      throw new Error("Jogador não encontrado.");
    }

    if (player.active === false) {
      throw new Error("Reative o jogador antes de adicioná-lo.");
    }

    if (group.active === false) {
      throw new Error("Reative a patota antes de adicionar jogadores.");
    }

    const membership = state.memberships.find(
      (item) => item.playerId === playerId && item.groupId === groupId,
    );

    if (membership) {
      membership.active = true;
      membership.joinedAt = new Date().toISOString();
      membership.leftAt = null;
    } else {
      state.memberships.push({
        groupId,
        playerId,
        active: true,
        joinedAt: new Date().toISOString(),
      });
    }

    this.#save(state);
  }

  removePlayerFromGroup(playerId, groupId, actorUserId) {
    const state = this.getState();
    const group = this.#assertGroupOrganizer(state, groupId, actorUserId);
    const ownerAccount = state.accounts.find(
      (account) => account.id === group.ownerUserId,
    );

    if (ownerAccount?.playerId === playerId) {
      throw new Error("O organizador não pode remover a si mesmo da patota.");
    }

    const membership = state.memberships.find(
      (item) => item.playerId === playerId && item.groupId === groupId,
    );

    if (!membership?.active) {
      throw new Error("Esse jogador não está ativo nesta patota.");
    }

    membership.active = false;
    membership.leftAt = new Date().toISOString();
    this.#save(state);
  }

  scheduleBarbecue(groupId, date, actorUserId) {
    const state = this.getState();
    const group = this.#assertGroupOrganizer(state, groupId, actorUserId);

    if (!isValidDate(date)) {
      throw new Error("Informe uma data válida para o churrasco.");
    }

    if (date < dateKey()) {
      throw new Error("Não é possível agendar um churrasco em uma data passada.");
    }

    const existing = state.barbecueEvents.find(
      (event) =>
        event.groupId === group.id &&
        event.date === date &&
        event.active !== false,
    );

    if (existing) {
      throw new Error("Já existe um churrasco agendado nesta data.");
    }

    const barbecueEvent = {
      id: crypto.randomUUID(),
      groupId: group.id,
      date,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: actorUserId,
    };

    state.barbecueEvents.push(barbecueEvent);
    this.#save(state);
    return { ...barbecueEvent };
  }

  cancelBarbecue(eventId, actorUserId) {
    const state = this.getState();
    const event = state.barbecueEvents.find((item) => item.id === eventId);

    if (!event) {
      throw new Error("Churrasco não encontrado.");
    }

    this.#assertGroupOrganizer(state, event.groupId, actorUserId);
    event.active = false;
    event.cancelledAt = new Date().toISOString();
    this.#save(state);
  }

  getBarbecueEventsByGroup(groupId, { includePast = false } = {}) {
    const currentDate = dateKey();

    return this.getState().barbecueEvents
      .filter(
        (event) =>
          event.groupId === groupId &&
          event.active !== false &&
          (includePast || event.date >= currentDate),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((event) => ({ ...event }));
  }

  getBarbecueEventsForUser(userId, { includePast = false } = {}) {
    const groupIds = new Set(
      this.getGroupsForUser(userId).map((group) => group.id),
    );
    const currentDate = dateKey();

    return this.getState().barbecueEvents
      .filter(
        (event) =>
          groupIds.has(event.groupId) &&
          event.active !== false &&
          (includePast || event.date >= currentDate),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((event) => ({ ...event }));
  }

  getBarbecueEventsOrganizedByUser(
    userId,
    { includePast = false } = {},
  ) {
    const groupIds = new Set(
      this.getGroupsOrganizedByUser(userId).map((group) => group.id),
    );
    const currentDate = dateKey();

    return this.getState().barbecueEvents
      .filter(
        (event) =>
          groupIds.has(event.groupId) &&
          event.active !== false &&
          (includePast || event.date >= currentDate),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((event) => ({ ...event }));
  }

  getBarbecueEventById(eventId) {
    const event = this.getState().barbecueEvents.find(
      (item) => item.id === eventId,
    );
    return event ? { ...event } : null;
  }

  setBarbecueConfirmation({
    eventId,
    playerId,
    status,
    currentDate = dateKey(),
  }) {
    const state = this.getState();
    const event = state.barbecueEvents.find(
      (item) => item.id === eventId && item.active !== false,
    );

    if (!event) {
      throw new Error("Churrasco não encontrado.");
    }

    if (!this.isPlayerInGroup(playerId, event.groupId)) {
      throw new Error("O atleta não pertence a esta patota.");
    }

    if (!["going", "not_going"].includes(status)) {
      throw new Error("Resposta de churrasco inválida.");
    }

    const daysUntilEvent = daysBetween(currentDate, event.date);

    if (daysUntilEvent < 0) {
      throw new Error("O prazo de confirmação deste churrasco já terminou.");
    }

    if (daysUntilEvent > 7) {
      throw new Error("A confirmação abre 7 dias antes do churrasco.");
    }

    let confirmation = state.barbecueConfirmations.find(
      (item) =>
        item.eventId === event.id &&
        item.playerId === playerId,
    );

    if (confirmation) {
      confirmation.status = status;
      confirmation.updatedAt = new Date().toISOString();
    } else {
      confirmation = {
        id: crypto.randomUUID(),
        eventId: event.id,
        playerId,
        status,
        updatedAt: new Date().toISOString(),
      };
      state.barbecueConfirmations.push(confirmation);
    }

    this.#save(state);
    return { ...confirmation };
  }

  getBarbecueConfirmations(eventId) {
    return this.getState().barbecueConfirmations
      .filter((item) => item.eventId === eventId)
      .map((item) => ({ ...item }));
  }

  getPlayerBarbecueConfirmation(eventId, playerId) {
    const confirmation = this.getState().barbecueConfirmations.find(
      (item) =>
        item.eventId === eventId &&
        item.playerId === playerId,
    );

    return confirmation ? { ...confirmation } : null;
  }

  #getOrCreateSessionInState(state, groupId, date) {
    let session = state.sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );

    if (!session) {
      session = {
        id: crypto.randomUUID(),
        groupId,
        date,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      state.sessions.push(session);
    }

    return session;
  }

  getSession(groupId, date) {
    const session = this.getState().sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );
    return session ? { ...session } : null;
  }

  setAttendance({ groupId, playerId, date, status }) {
    if (!groupId || !playerId || !date) {
      throw new Error("Dados de presença incompletos.");
    }

    if (!["present", "absent"].includes(status)) {
      throw new Error("Status de presença inválido.");
    }

    if (!this.isPlayerInGroup(playerId, groupId)) {
      throw new Error("O atleta não pertence a esta patota.");
    }

    const state = this.getState();
    const session = this.#getOrCreateSessionInState(state, groupId, date);
    let attendance = state.attendances.find(
      (item) => item.sessionId === session.id && item.playerId === playerId,
    );

    if (attendance) {
      attendance.status = status;
      attendance.updatedAt = new Date().toISOString();
    } else {
      attendance = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        playerId,
        status,
        updatedAt: new Date().toISOString(),
      };
      state.attendances.push(attendance);
    }

    this.#save(state);
    return { ...attendance };
  }

  getAttendance(groupId, date) {
    const state = this.getState();
    const session = state.sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );

    if (!session) return [];

    return state.attendances
      .filter((item) => item.sessionId === session.id)
      .map((item) => ({ ...item }));
  }

  getPlayerAttendance(groupId, playerId, date) {
    return (
      this.getAttendance(groupId, date).find(
        (item) => item.playerId === playerId,
      ) ?? null
    );
  }

  saveDrawPairs(groupId, date, pairs) {
    const state = this.getState();
    const session = this.#getOrCreateSessionInState(state, groupId, date);
    const previous = state.pairResults.filter(
      (item) => item.sessionId === session.id,
    );

    const winsByPair = new Map(
      previous.map((item) => [
        `${item.leftPlayerId}:${item.rightPlayerId}`,
        item.wins,
      ]),
    );

    state.pairResults = state.pairResults.filter(
      (item) => item.sessionId !== session.id,
    );

    pairs.forEach((pair) => {
      const key = `${pair.leftPlayer.id}:${pair.rightPlayer.id}`;
      state.pairResults.push({
        id: crypto.randomUUID(),
        sessionId: session.id,
        leftPlayerId: pair.leftPlayer.id,
        rightPlayerId: pair.rightPlayer.id,
        wins: winsByPair.get(key) ?? 0,
      });
    });

    this.#save(state);
    return this.getPairResults(groupId, date);
  }

  addPairResult({ groupId, date, leftPlayerId, rightPlayerId, wins = 0 }) {
    const state = this.getState();
    const session = this.#getOrCreateSessionInState(state, groupId, date);

    if (leftPlayerId === rightPlayerId) {
      throw new Error("Escolha dois atletas diferentes.");
    }

    const left = state.players.find((item) => item.id === leftPlayerId);
    const right = state.players.find((item) => item.id === rightPlayerId);

    if (!left || !right) {
      throw new Error("Atleta não encontrado.");
    }

    if (left.side !== "left" || right.side !== "right") {
      throw new Error(
        "A dupla precisa ter um atleta de esquerda e um de direita.",
      );
    }

    const existing = state.pairResults.find(
      (item) =>
        item.sessionId === session.id &&
        item.leftPlayerId === leftPlayerId &&
        item.rightPlayerId === rightPlayerId,
    );

    if (existing) {
      throw new Error("Essa dupla já está registrada nesta noite.");
    }

    const result = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      leftPlayerId,
      rightPlayerId,
      wins: Math.max(0, Number(wins) || 0),
    };

    state.pairResults.push(result);
    this.#save(state);
    return { ...result };
  }

  updatePairWins(resultId, wins) {
    const state = this.getState();
    const result = state.pairResults.find((item) => item.id === resultId);

    if (!result) {
      throw new Error("Resultado da dupla não encontrado.");
    }

    result.wins = Math.max(0, Number(wins) || 0);
    this.#save(state);
  }

  getPairResults(groupId, date) {
    const state = this.getState();
    const session = state.sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );

    if (!session) return [];

    return state.pairResults
      .filter((item) => item.sessionId === session.id)
      .map((item) => ({ ...item }));
  }

  getRankingData(groupId, { asOfDate = dateKey() } = {}) {
    const state = this.getState();
    const sessionIds = new Set(
      state.sessions
        .filter((session) => session.groupId === groupId)
        .map((session) => session.id),
    );
    const eligibleBarbecueEventIds = new Set(
      state.barbecueEvents
        .filter(
          (event) =>
            event.groupId === groupId &&
            event.active !== false &&
            event.date <= asOfDate,
        )
        .map((event) => event.id),
    );

    return {
      players: this.getPlayersByGroup(groupId, { includeInactive: true }),
      attendances: state.attendances
        .filter((attendance) => sessionIds.has(attendance.sessionId))
        .map((item) => ({ ...item })),
      pairResults: state.pairResults
        .filter((result) => sessionIds.has(result.sessionId))
        .map((item) => ({ ...item })),
      barbecueConfirmations: state.barbecueConfirmations
        .filter((confirmation) =>
          eligibleBarbecueEventIds.has(confirmation.eventId),
        )
        .map((item) => ({ ...item })),
    };
  }
}
