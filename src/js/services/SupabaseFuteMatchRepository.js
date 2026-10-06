import { Group } from "../domain/Group.js";
import { Player } from "../domain/Player.js";

const CURRENT_GROUP_KEY = "futematch:current-group";

const initialState = () => ({
  groups: [],
  players: [],
  memberships: [],
  guests: [],
  attendances: [],
  barbecueEvents: [],
  barbecueConfirmations: [],
  sessions: [],
  pairResults: [],
});

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");

const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addDays = (date, amount) => {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + amount));

  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
};

const weekdayOf = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const daysBetween = (fromDate, toDate) => {
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);

  return Math.round((to - from) / 86400000);
};

const throwIfError = (error) => {
  if (error) {
    throw new Error(error.message ?? "Erro ao acessar o Supabase.");
  }
};

const timeLabel = (value) =>
  typeof value === "string" ? value.slice(0, 5) : value;

const normalizeName = (value) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export class SupabaseFuteMatchRepository {
  constructor(client) {
    this.client = client;
    this.user = null;
    this.state = initialState();
    this.currentGroupId =
      globalThis.localStorage?.getItem(CURRENT_GROUP_KEY) ?? null;
  }

  async initialize() {
    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    throwIfError(error);

    this.user = session?.user ?? null;

    if (this.user) {
      await this.sync();
    } else {
      this.state = initialState();
    }

    return this.user;
  }

  async sync() {
    if (!this.user) {
      this.state = initialState();
      return;
    }

    const [
      profilesResult,
      privateProfileResult,
      groupsResult,
      membershipsResult,
      guestsResult,
      attendanceResult,
      barbecueEventsResult,
      barbecueConfirmationsResult,
      sessionsResult,
      pairResultsResult,
    ] = await Promise.all([
      this.client
        .from("profiles")
        .select("id, full_name, side, active, created_at"),
      this.client
        .from("profile_private")
        .select("user_id, birth_date")
        .eq("user_id", this.user.id)
        .maybeSingle(),
      this.client
        .from("groups")
        .select(
          "id, name, weekday, start_time, end_time, timezone, owner_user_id, active, created_at",
        ),
      this.client
        .from("group_members")
        .select("group_id, user_id, active, joined_at, left_at, role, manual_points"),
      this.client
        .from("group_guests")
        .select("id, group_id, name, side, active, created_by, created_at, updated_at"),
      this.client
        .from("attendance")
        .select("group_id, user_id, event_date, status, updated_at"),
      this.client
        .from("barbecue_events")
        .select(
          "id, group_id, event_date, active, created_by, created_at, cancelled_at",
        ),
      this.client
        .from("barbecue_confirmations")
        .select("event_id, user_id, status, updated_at"),
      this.client
        .from("group_sessions")
        .select("id, group_id, event_date, status, created_at"),
      this.client
        .from("pair_results")
        .select(
          "id, session_id, left_user_id, right_user_id, left_guest_id, right_guest_id, wins, created_at, updated_at",
        ),
    ]);

    [
      profilesResult,
      privateProfileResult,
      groupsResult,
      membershipsResult,
      guestsResult,
      attendanceResult,
      barbecueEventsResult,
      barbecueConfirmationsResult,
      sessionsResult,
      pairResultsResult,
    ].forEach(({ error }) => throwIfError(error));

    const birthDate = privateProfileResult.data?.birth_date ?? null;

    this.state = {
      players: (profilesResult.data ?? []).map(
        (row) =>
          new Player(row.full_name, row.side, {
            id: row.id,
            birthDate: row.id === this.user.id ? birthDate : null,
            active: row.active,
            createdAt: row.created_at,
          }),
      ),
      groups: (groupsResult.data ?? []).map(
        (row) =>
          new Group(row.name, {
            id: row.id,
            weekday: row.weekday,
            startTime: timeLabel(row.start_time),
            endTime: timeLabel(row.end_time),
            timezone: row.timezone,
            ownerUserId: row.owner_user_id,
            active: row.active,
            createdAt: row.created_at,
          }),
      ),
      memberships: (membershipsResult.data ?? []).map((row) => ({
        groupId: row.group_id,
        playerId: row.user_id,
        active: row.active,
        joinedAt: row.joined_at,
        leftAt: row.left_at,
        role: row.role ?? "member",
        manualPoints: Number(row.manual_points) || 0,
      })),
      guests: (guestsResult.data ?? []).map((row) => ({
        id: row.id,
        groupId: row.group_id,
        name: row.name,
        side: row.side,
        active: row.active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isGuest: true,
      })),
      attendances: (attendanceResult.data ?? []).map((row) => ({
        groupId: row.group_id,
        playerId: row.user_id,
        eventDate: row.event_date,
        status: row.status,
        updatedAt: row.updated_at,
      })),
      barbecueEvents: (barbecueEventsResult.data ?? []).map((row) => ({
        id: row.id,
        groupId: row.group_id,
        date: row.event_date,
        active: row.active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        cancelledAt: row.cancelled_at,
      })),
      barbecueConfirmations: (barbecueConfirmationsResult.data ?? []).map(
        (row) => ({
          eventId: row.event_id,
          playerId: row.user_id,
          status: row.status,
          updatedAt: row.updated_at,
        }),
      ),
      sessions: (sessionsResult.data ?? []).map((row) => ({
        id: row.id,
        groupId: row.group_id,
        date: row.event_date,
        status: row.status,
        createdAt: row.created_at,
      })),
      pairResults: (pairResultsResult.data ?? []).map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        leftPlayerId: row.left_user_id,
        rightPlayerId: row.right_user_id,
        leftGuestId: row.left_guest_id,
        rightGuestId: row.right_guest_id,
        wins: row.wins,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };

    const currentStillExists = this.state.groups.some(
      (group) => group.id === this.currentGroupId && group.active !== false,
    );

    if (!currentStillExists) {
      const firstActiveGroup = this.state.groups.find(
        (group) => group.active !== false,
      );
      this.setCurrentGroup(firstActiveGroup?.id ?? null);
    }
  }

  setAuthenticatedUser(user) {
    this.user = user ?? null;

    if (!user) {
      this.state = initialState();
      this.setCurrentGroup(null);
    }
  }

  getState() {
    return this.state;
  }

  getCurrentAccount() {
    if (!this.user) return null;

    return {
      id: this.user.id,
      email: this.user.email ?? "",
      playerId: this.user.id,
      active: true,
    };
  }

  getAccountById(userId) {
    const player = this.getPlayerById(userId);
    if (!player) return null;

    return {
      id: userId,
      playerId: userId,
      active: player.active !== false,
      email: userId === this.user?.id ? this.user?.email ?? "" : null,
    };
  }

  getCurrentPlayer() {
    return this.user ? this.getPlayerById(this.user.id) : null;
  }

  getPlayers({ active = true } = {}) {
    return this.state.players.filter((player) =>
      active === null ? true : (player.active !== false) === active,
    );
  }

  getPlayerById(playerId) {
    return this.state.players.find((player) => player.id === playerId) ?? null;
  }

  getGroups({ active = true } = {}) {
    return this.state.groups.filter((group) =>
      active === null ? true : (group.active !== false) === active,
    );
  }

  getGroupById(groupId) {
    return this.state.groups.find((group) => group.id === groupId) ?? null;
  }

  getCurrentGroupId() {
    return this.currentGroupId;
  }

  setCurrentGroup(groupId) {
    this.currentGroupId = groupId ?? null;

    if (globalThis.localStorage) {
      if (groupId) {
        globalThis.localStorage.setItem(CURRENT_GROUP_KEY, groupId);
      } else {
        globalThis.localStorage.removeItem(CURRENT_GROUP_KEY);
      }
    }
  }

  getPlayersByGroup(groupId, { includeInactive = false } = {}) {
    const playerIds = new Set(
      this.state.memberships
        .filter(
          (membership) =>
            membership.groupId === groupId && membership.active === true,
        )
        .map((membership) => membership.playerId),
    );

    return this.state.players.filter(
      (player) =>
        playerIds.has(player.id) &&
        (includeInactive || player.active !== false),
    );
  }

  getPlayersNotInGroup(groupId) {
    const currentIds = new Set(
      this.getPlayersByGroup(groupId, { includeInactive: true }).map(
        (player) => player.id,
      ),
    );

    return this.state.players.filter(
      (player) => player.active !== false && !currentIds.has(player.id),
    );
  }

  getGroupsByPlayer(playerId, { includeInactive = false } = {}) {
    const groupIds = new Set(
      this.state.memberships
        .filter(
          (membership) =>
            membership.playerId === playerId && membership.active === true,
        )
        .map((membership) => membership.groupId),
    );

    return this.state.groups.filter(
      (group) =>
        groupIds.has(group.id) &&
        (includeInactive || group.active !== false),
    );
  }

  getGroupsForUser(userId, options = {}) {
    return this.getGroupsByPlayer(userId, options);
  }

  getGroupsOrganizedByUser(userId, { includeInactive = false } = {}) {
    return this.state.groups.filter(
      (group) =>
        this.isGroupOrganizer(group.id, userId) &&
        (includeInactive || group.active !== false),
    );
  }

  getMembership(groupId, playerId) {
    return (
      this.state.memberships.find(
        (membership) =>
          membership.groupId === groupId &&
          membership.playerId === playerId,
      ) ?? null
    );
  }

  getMemberRole(groupId, playerId) {
    if (this.getGroupById(groupId)?.ownerUserId === playerId) {
      return "organizer";
    }

    return this.getMembership(groupId, playerId)?.role ?? "member";
  }

  isPlayerInGroup(playerId, groupId) {
    return this.state.memberships.some(
      (membership) =>
        membership.playerId === playerId &&
        membership.groupId === groupId &&
        membership.active === true,
    );
  }

  isUserInGroup(userId, groupId) {
    return this.isPlayerInGroup(userId, groupId);
  }

  isGroupOrganizer(groupId, userId) {
    if (!userId) return false;

    const group = this.getGroupById(groupId);
    if (group?.ownerUserId === userId) return true;

    const membership = this.getMembership(groupId, userId);
    return Boolean(
      membership?.active === true && membership.role === "organizer",
    );
  }

  getGuestsByGroup(groupId, { includeInactive = false } = {}) {
    return this.state.guests
      .filter(
        (guest) =>
          guest.groupId === groupId &&
          (includeInactive || guest.active !== false),
      )
      .map((guest) => ({ ...guest, isGuest: true }));
  }

  getGuestById(guestId) {
    const guest = this.state.guests.find((item) => item.id === guestId);
    return guest ? { ...guest, isGuest: true } : null;
  }

  async addGuest({ groupId, name, side }) {
    if (!this.isGroupOrganizer(groupId, this.user?.id)) {
      throw new Error("Somente o organizador pode adicionar convidados.");
    }

    const trimmedName = String(name ?? "").trim();
    if (!trimmedName) {
      throw new Error("Informe o nome do convidado.");
    }

    if (!["left", "right"].includes(side)) {
      throw new Error("Informe o lado do convidado.");
    }

    const normalized = normalizeName(trimmedName);
    const duplicatePlayer = this.getPlayersByGroup(groupId, {
      includeInactive: true,
    }).some((player) => normalizeName(player.name) === normalized);
    const duplicateGuest = this.getGuestsByGroup(groupId).some(
      (guest) => normalizeName(guest.name) === normalized,
    );

    if (duplicatePlayer || duplicateGuest) {
      throw new Error("Já existe um participante com esse nome nesta patota.");
    }

    const { data, error } = await this.client
      .from("group_guests")
      .insert({
        group_id: groupId,
        name: trimmedName,
        side,
        created_by: this.user?.id,
      })
      .select()
      .single();

    throwIfError(error);
    await this.sync();
    return this.getGuestById(data.id);
  }

  async setGuestActive(guestId, active) {
    const guest = this.getGuestById(guestId);
    if (!guest) {
      throw new Error("Convidado não encontrado.");
    }

    if (!this.isGroupOrganizer(guest.groupId, this.user?.id)) {
      throw new Error("Somente o organizador pode gerenciar convidados.");
    }

    const { error } = await this.client
      .from("group_guests")
      .update({
        active: Boolean(active),
        updated_at: new Date().toISOString(),
      })
      .eq("id", guestId);

    throwIfError(error);
    await this.sync();
  }

  async createGroup({ name, weekday, startTime, endTime }) {
    const { data, error } = await this.client.rpc("create_group", {
      p_name: name,
      p_weekday: Number(weekday),
      p_start_time: startTime,
      p_end_time: endTime,
    });

    throwIfError(error);
    await this.sync();
    this.setCurrentGroup(data);

    return this.getGroupById(data);
  }

  async updateGroupSchedule(
    groupId,
    { weekday, startTime, endTime },
  ) {
    const { error } = await this.client
      .from("groups")
      .update({
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
      })
      .eq("id", groupId);

    throwIfError(error);
    await this.sync();

    return this.getGroupById(groupId);
  }

  async setGroupActive(groupId, active) {
    if (!this.isGroupOrganizer(groupId, this.user?.id)) {
      throw new Error("Somente o organizador pode alterar o status da patota.");
    }

    const { data, error } = await this.client
      .from("groups")
      .update({
        active: Boolean(active),
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId)
      .select("id, active")
      .maybeSingle();

    throwIfError(error);

    if (!data) {
      throw new Error("Patota não encontrada ou sem permissão.");
    }

    await this.sync();

    if (!active && this.currentGroupId === groupId) {
      const nextGroup = this.getGroupsForUser(this.user?.id).find(
        (group) => group.id !== groupId,
      );
      this.setCurrentGroup(nextGroup?.id ?? null);
    }

    return this.getGroupById(groupId);
  }

  async deleteGroup(groupId) {
    if (!this.isGroupOrganizer(groupId, this.user?.id)) {
      throw new Error("Somente o organizador pode excluir a patota.");
    }

    const { data, error } = await this.client
      .from("groups")
      .delete()
      .eq("id", groupId)
      .select("id")
      .maybeSingle();

    throwIfError(error);

    if (!data) {
      throw new Error("Patota não encontrada ou sem permissão.");
    }

    if (this.currentGroupId === groupId) {
      this.setCurrentGroup(null);
    }

    await this.sync();
  }

  async addPlayerToGroup(playerId, groupId) {
    const existing = this.state.memberships.find(
      (membership) =>
        membership.groupId === groupId && membership.playerId === playerId,
    );

    const payload = {
      group_id: groupId,
      user_id: playerId,
      active: true,
      joined_at: new Date().toISOString(),
      left_at: null,
      role: "member",
    };

    const query = existing
      ? this.client
          .from("group_members")
          .update(payload)
          .eq("group_id", groupId)
          .eq("user_id", playerId)
      : this.client.from("group_members").insert(payload);

    const { error } = await query;
    throwIfError(error);
    await this.sync();
  }

  async updateGroupMemberRole(groupId, playerId, role) {
    if (!["member", "organizer"].includes(role)) {
      throw new Error("Cargo inválido.");
    }

    const group = this.getGroupById(groupId);
    if (!group) {
      throw new Error("Patota não encontrada.");
    }

    if (!this.isGroupOrganizer(groupId, this.user?.id)) {
      throw new Error("Somente um organizador pode alterar cargos.");
    }

    if (group.ownerUserId === playerId && role !== "organizer") {
      throw new Error("O criador da patota deve permanecer como organizador.");
    }

    const { data, error } = await this.client
      .from("group_members")
      .update({ role })
      .eq("group_id", groupId)
      .eq("user_id", playerId)
      .eq("active", true)
      .select("group_id, user_id, role")
      .maybeSingle();

    throwIfError(error);

    if (!data) {
      throw new Error("Atleta não encontrado na patota.");
    }

    await this.sync();
    return this.getMembership(groupId, playerId);
  }

  async removePlayerFromGroup(playerId, groupId) {
    const { error } = await this.client
      .from("group_members")
      .update({
        active: false,
        left_at: new Date().toISOString(),
      })
      .eq("group_id", groupId)
      .eq("user_id", playerId);

    throwIfError(error);
    await this.sync();
  }

  getAttendanceWindow(groupId, currentDate = dateKey()) {
    const group = this.getGroupById(groupId);

    if (!group || group.active === false) {
      return {
        available: false,
        isOpen: false,
        targetDate: null,
        opensOn: null,
        daysUntil: null,
        reason: "Patota não encontrada ou inativa.",
      };
    }

    const weekday = Number(group.weekday);
    if (![1, 2, 3, 4, 5].includes(weekday)) {
      return {
        available: false,
        isOpen: false,
        targetDate: null,
        opensOn: null,
        daysUntil: null,
        reason: "O organizador precisa definir o dia da semana da patota.",
      };
    }

    if (!isValidDate(currentDate)) {
      throw new Error("Data atual inválida.");
    }

    const currentWeekday = weekdayOf(currentDate);
    const daysUntil = (weekday - currentWeekday + 7) % 7;
    const targetDate = addDays(currentDate, daysUntil);
    const opensOn = addDays(targetDate, -2);

    return {
      available: true,
      isOpen: daysUntil <= 2,
      targetDate,
      opensOn,
      daysUntil,
      reason: daysUntil <= 2 ? null : "A votação abre 2 dias antes da patota.",
    };
  }

  getAttendance(groupId, date) {
    return this.state.attendances.filter(
      (attendance) =>
        attendance.groupId === groupId && attendance.eventDate === date,
    );
  }

  getPlayerAttendance(groupId, playerId, date) {
    return (
      this.state.attendances.find(
        (attendance) =>
          attendance.groupId === groupId &&
          attendance.playerId === playerId &&
          attendance.eventDate === date,
      ) ?? null
    );
  }

  async setAttendance({ groupId, playerId, date, status }) {
    const { error } = await this.client.from("attendance").upsert(
      {
        group_id: groupId,
        user_id: playerId,
        event_date: date,
        status,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "group_id,user_id,event_date",
      },
    );

    throwIfError(error);
    await this.sync();

    return this.getPlayerAttendance(groupId, playerId, date);
  }

  async scheduleBarbecue(groupId, date) {
    const { data, error } = await this.client
      .from("barbecue_events")
      .insert({
        group_id: groupId,
        event_date: date,
        created_by: this.user?.id,
      })
      .select()
      .single();

    throwIfError(error);
    await this.sync();

    return this.getBarbecueEventById(data.id);
  }

  async cancelBarbecue(eventId) {
    const { error } = await this.client
      .from("barbecue_events")
      .update({
        active: false,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    throwIfError(error);
    await this.sync();
  }

  getBarbecueEventsByGroup(groupId, { includePast = false } = {}) {
    const currentDate = dateKey();

    return this.state.barbecueEvents
      .filter(
        (event) =>
          event.groupId === groupId &&
          event.active !== false &&
          (includePast || event.date >= currentDate),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getBarbecueEventsForUser(userId, { includePast = false } = {}) {
    const groupIds = new Set(
      this.getGroupsForUser(userId).map((group) => group.id),
    );
    const currentDate = dateKey();

    return this.state.barbecueEvents
      .filter(
        (event) =>
          groupIds.has(event.groupId) &&
          event.active !== false &&
          (includePast || event.date >= currentDate),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getBarbecueEventsOrganizedByUser(
    userId,
    { includePast = false } = {},
  ) {
    const groupIds = new Set(
      this.getGroupsOrganizedByUser(userId).map((group) => group.id),
    );
    const currentDate = dateKey();

    return this.state.barbecueEvents
      .filter(
        (event) =>
          groupIds.has(event.groupId) &&
          event.active !== false &&
          (includePast || event.date >= currentDate),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getBarbecueEventById(eventId) {
    return (
      this.state.barbecueEvents.find((event) => event.id === eventId) ?? null
    );
  }

  getBarbecueConfirmations(eventId) {
    return this.state.barbecueConfirmations.filter(
      (confirmation) => confirmation.eventId === eventId,
    );
  }

  getPlayerBarbecueConfirmation(eventId, playerId) {
    return (
      this.state.barbecueConfirmations.find(
        (confirmation) =>
          confirmation.eventId === eventId &&
          confirmation.playerId === playerId,
      ) ?? null
    );
  }

  async setBarbecueConfirmation({ eventId, playerId, status }) {
    const { error } = await this.client.from("barbecue_confirmations").upsert(
      {
        event_id: eventId,
        user_id: playerId,
        status,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "event_id,user_id",
      },
    );

    throwIfError(error);
    await this.sync();

    return this.getPlayerBarbecueConfirmation(eventId, playerId);
  }

  async saveDrawPairs(groupId, date, pairs) {
    let session = this.state.sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );

    if (!session) {
      const { data, error } = await this.client
        .from("group_sessions")
        .insert({
          group_id: groupId,
          event_date: date,
          status: "open",
        })
        .select()
        .single();

      throwIfError(error);
      session = {
        id: data.id,
        groupId: data.group_id,
        date: data.event_date,
        status: data.status,
      };
    }

    const { error: deleteError } = await this.client
      .from("pair_results")
      .delete()
      .eq("session_id", session.id);

    throwIfError(deleteError);

    if (pairs.length) {
      const { error: insertError } = await this.client
        .from("pair_results")
        .insert(
          pairs.map((pair) => ({
            session_id: session.id,
            left_user_id: pair.leftPlayer.isGuest
              ? null
              : pair.leftPlayer.id,
            left_guest_id: pair.leftPlayer.isGuest
              ? pair.leftPlayer.id
              : null,
            right_user_id: pair.rightPlayer.isGuest
              ? null
              : pair.rightPlayer.id,
            right_guest_id: pair.rightPlayer.isGuest
              ? pair.rightPlayer.id
              : null,
            wins: 0,
          })),
        );

      throwIfError(insertError);
    }

    await this.sync();
    return this.getPairResults(groupId, date);
  }

  getPairResults(groupId, date) {
    const session = this.state.sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );

    if (!session) return [];

    return this.state.pairResults.filter(
      (result) => result.sessionId === session.id,
    );
  }

  async addPairResult({
    groupId,
    date,
    leftPlayerId = null,
    rightPlayerId = null,
    leftGuestId = null,
    rightGuestId = null,
    wins = 0,
  }) {
    let session = this.state.sessions.find(
      (item) => item.groupId === groupId && item.date === date,
    );

    if (!session) {
      const { data, error } = await this.client
        .from("group_sessions")
        .insert({
          group_id: groupId,
          event_date: date,
          status: "open",
        })
        .select()
        .single();

      throwIfError(error);
      session = {
        id: data.id,
        groupId: data.group_id,
        date: data.event_date,
        status: data.status,
      };
    }

    const { error } = await this.client.from("pair_results").insert({
      session_id: session.id,
      left_user_id: leftPlayerId,
      right_user_id: rightPlayerId,
      left_guest_id: leftGuestId,
      right_guest_id: rightGuestId,
      wins: Math.max(0, Number(wins) || 0),
    });

    throwIfError(error);
    await this.sync();
  }

  async updatePairWins(resultId, wins) {
    const { error } = await this.client
      .from("pair_results")
      .update({
        wins: Math.max(0, Number(wins) || 0),
      })
      .eq("id", resultId);

    throwIfError(error);
    await this.sync();
  }

  getRankingData(groupId, { asOfDate = dateKey() } = {}) {
    const sessionIds = new Set(
      this.state.sessions
        .filter((session) => session.groupId === groupId)
        .map((session) => session.id),
    );

    const eligibleBarbecueEventIds = new Set(
      this.state.barbecueEvents
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
      attendances: this.state.attendances
        .filter((attendance) => attendance.groupId === groupId)
        .map((item) => ({ ...item })),
      pairResults: this.state.pairResults
        .filter((result) => sessionIds.has(result.sessionId))
        .map((item) => ({ ...item })),
      barbecueConfirmations: this.state.barbecueConfirmations
        .filter((confirmation) =>
          eligibleBarbecueEventIds.has(confirmation.eventId),
        )
        .map((item) => ({ ...item })),
      manualPoints: this.state.memberships
        .filter(
          (membership) =>
            membership.groupId === groupId &&
            membership.active === true &&
            Number(membership.manualPoints) !== 0,
        )
        .map((membership) => ({
          playerId: membership.playerId,
          points: Number(membership.manualPoints) || 0,
        })),
    };
  }
}
