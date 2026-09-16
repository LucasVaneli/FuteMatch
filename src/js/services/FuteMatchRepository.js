import { Group } from "../domain/Group.js";
import { Player } from "../domain/Player.js";

const STORAGE_KEY = "futematch:data:v1";

const initialState = () => ({
  groups: [],
  players: [],
  memberships: [],
  currentGroupId: null,
});

const normalize = (value) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const matchesActiveStatus = (item, active) =>
  active === null ? true : (item.active !== false) === active;

export class FuteMatchRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  getState() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      return raw ? { ...initialState(), ...JSON.parse(raw) } : initialState();
    } catch {
      return initialState();
    }
  }

  #save(state) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getGroups({ active = true } = {}) {
    return this.getState().groups
      .filter((group) => matchesActiveStatus(group, active))
      .map(Group.fromJSON);
  }

  getPlayers({ active = true } = {}) {
    return this.getState().players
      .filter((player) => matchesActiveStatus(player, active))
      .map(Player.fromJSON);
  }

  getCurrentGroupId() {
    return this.getState().currentGroupId;
  }

  setCurrentGroup(groupId) {
    const state = this.getState();
    const exists =
      groupId &&
      state.groups.some(
        (group) => group.id === groupId && group.active !== false,
      );

    state.currentGroupId = exists ? groupId : null;
    this.#save(state);
  }

  createGroup(name) {
    const state = this.getState();

    if (!name?.trim()) {
      throw new Error("Informe o nome da patota.");
    }

    if (state.groups.some((group) => normalize(group.name) === normalize(name))) {
      throw new Error(
        "Já existe uma patota com esse nome. Reative-a se estiver inativa.",
      );
    }

    const group = new Group(name);
    state.groups.push(group);

    if (!state.currentGroupId) {
      state.currentGroupId = group.id;
    }

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
      throw new Error(
        "Esse jogador já está cadastrado. Use a opção de adicionar jogador existente ou reative-o se estiver inativo.",
      );
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
    if (!groupId) {
      return [];
    }

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
    if (!groupId) {
      return this.getPlayers();
    }

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

  getGroupsByPlayer(playerId, { includeInactive = true } = {}) {
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

  addPlayerToGroup(playerId, groupId) {
    const state = this.getState();
    const player = state.players.find((item) => item.id === playerId);
    const group = state.groups.find((item) => item.id === groupId);

    if (!player || !group) {
      throw new Error("Jogador ou patota não encontrados.");
    }

    if (player.active === false) {
      throw new Error("Reative o jogador antes de adicioná-lo a uma patota.");
    }

    if (group.active === false) {
      throw new Error("Reative a patota antes de adicionar jogadores.");
    }

    const existingMembership = state.memberships.find(
      (membership) =>
        membership.playerId === playerId && membership.groupId === groupId,
    );

    if (existingMembership?.active) {
      return;
    }

    if (existingMembership) {
      existingMembership.active = true;
      existingMembership.joinedAt = new Date().toISOString();
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

  removePlayerFromGroup(playerId, groupId) {
    const state = this.getState();
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

  updatePlayerGroups(playerId, groupIds) {
    const state = this.getState();
    const validGroupIds = new Set(
      state.groups
        .filter((group) => group.active !== false)
        .map((group) => group.id),
    );
    const desiredGroupIds = new Set(
      groupIds.filter((groupId) => validGroupIds.has(groupId)),
    );

    state.memberships = state.memberships.filter(
      (membership) => membership.playerId !== playerId,
    );

    desiredGroupIds.forEach((groupId) => {
      state.memberships.push({
        groupId,
        playerId,
        active: true,
        joinedAt: new Date().toISOString(),
      });
    });

    this.#save(state);
  }
}
