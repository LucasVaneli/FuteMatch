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

  getGroups() {
    return this.getState().groups.map(Group.fromJSON);
  }

  getPlayers() {
    return this.getState().players.map(Player.fromJSON);
  }

  getCurrentGroupId() {
    return this.getState().currentGroupId;
  }

  setCurrentGroup(groupId) {
    const state = this.getState();
    const exists = groupId && state.groups.some((group) => group.id === groupId);
    state.currentGroupId = exists ? groupId : null;
    this.#save(state);
  }

  createGroup(name) {
    const state = this.getState();

    if (state.groups.some((group) => normalize(group.name) === normalize(name))) {
      throw new Error("Já existe uma patota com esse nome.");
    }

    const group = new Group(name);
    state.groups.push(group);

    if (!state.currentGroupId) {
      state.currentGroupId = group.id;
    }

    this.#save(state);
    return group;
  }

  createPlayer({ name, birthDate, side, groupIds = [] }) {
    const state = this.getState();

    if (state.players.some((player) => normalize(player.name) === normalize(name))) {
      throw new Error("Já existe um jogador com esse nome.");
    }

    if (!birthDate) {
      throw new Error("Informe a data de nascimento.");
    }

    const player = new Player(name, side, { birthDate });
    state.players.push(player);

    const validGroupIds = new Set(state.groups.map((group) => group.id));
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

  getPlayersByGroup(groupId) {
    if (!groupId) {
      return [];
    }

    const state = this.getState();
    const playerIds = new Set(
      state.memberships
        .filter((membership) => membership.groupId === groupId && membership.active)
        .map((membership) => membership.playerId),
    );

    return state.players
      .filter((player) => player.active !== false && playerIds.has(player.id))
      .map(Player.fromJSON);
  }

  getGroupsByPlayer(playerId) {
    const state = this.getState();
    const groupIds = new Set(
      state.memberships
        .filter((membership) => membership.playerId === playerId && membership.active)
        .map((membership) => membership.groupId),
    );

    return state.groups.filter((group) => groupIds.has(group.id)).map(Group.fromJSON);
  }

  updatePlayerGroups(playerId, groupIds) {
    const state = this.getState();
    const validGroupIds = new Set(state.groups.map((group) => group.id));
    const desiredGroupIds = new Set(groupIds.filter((groupId) => validGroupIds.has(groupId)));

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
