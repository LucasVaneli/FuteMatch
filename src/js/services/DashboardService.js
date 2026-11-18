import { RANKING_POINTS } from "./RankingService.js";

const inRange = (date, startDate, endDate) =>
  Boolean(
    date &&
      (!startDate || date >= startDate) &&
      (!endDate || date <= endDate),
  );

const sortByWins = (a, b) =>
  b.wins - a.wins ||
  b.nights - a.nights ||
  a.name.localeCompare(b.name, "pt-BR");

const sortByPoints = (a, b) =>
  b.totalPoints - a.totalPoints ||
  b.wins - a.wins ||
  a.player.name.localeCompare(b.player.name, "pt-BR");

export class DashboardService {
  static calculate({
    players = [],
    guests = [],
    sessions = [],
    pairResults = [],
    attendances = [],
    barbecueEvents = [],
    barbecueConfirmations = [],
    startDate = null,
    endDate = null,
  }) {
    const playersById = new Map(players.map((player) => [player.id, player]));
    const guestsById = new Map(guests.map((guest) => [guest.id, guest]));
    const sessionsById = new Map(sessions.map((session) => [session.id, session]));

    const playerStats = new Map(
      players.map((player) => [
        player.id,
        {
          player,
          name: player.name,
          wins: 0,
          nightsSet: new Set(),
          attendances: 0,
          barbecues: 0,
          victoryPoints: 0,
          attendancePoints: 0,
          barbecuePoints: 0,
          totalPoints: 0,
        },
      ]),
    );

    const pairStats = new Map();
    const monthlyWins = new Map();
    const resultSessionIds = new Set();
    let totalWins = 0;

    const participant = (userId, guestId) => {
      if (userId) {
        const player = playersById.get(userId);
        return player
          ? { id: player.id, name: player.name, isGuest: false }
          : null;
      }

      const guest = guestsById.get(guestId);
      return guest
        ? { id: guest.id, name: guest.name, isGuest: true }
        : null;
    };

    pairResults.forEach((result) => {
      const session = sessionsById.get(result.sessionId);
      if (!session || !inRange(session.date, startDate, endDate)) return;

      const wins = Math.max(0, Number(result.wins) || 0);
      const left = participant(result.leftPlayerId, result.leftGuestId);
      const right = participant(result.rightPlayerId, result.rightGuestId);

      if (!left || !right) return;

      totalWins += wins;
      resultSessionIds.add(session.id);

      const month = session.date.slice(0, 7);
      monthlyWins.set(month, (monthlyWins.get(month) ?? 0) + wins);

      [result.leftPlayerId, result.rightPlayerId]
        .filter(Boolean)
        .forEach((playerId) => {
          const stats = playerStats.get(playerId);
          if (!stats) return;
          stats.wins += wins;
          stats.victoryPoints += wins * RANKING_POINTS.VICTORY;
          stats.nightsSet.add(session.id);
        });

      const pairKey = `${left.isGuest ? "guest" : "user"}:${left.id}|${right.isGuest ? "guest" : "user"}:${right.id}`;
      const existing = pairStats.get(pairKey) ?? {
        key: pairKey,
        left,
        right,
        name: `${left.name} + ${right.name}`,
        wins: 0,
        nightsSet: new Set(),
        hasGuest: left.isGuest || right.isGuest,
      };

      existing.wins += wins;
      existing.nightsSet.add(session.id);
      pairStats.set(pairKey, existing);
    });

    attendances.forEach((attendance) => {
      if (
        attendance.status !== "present" ||
        !inRange(attendance.eventDate, startDate, endDate)
      ) {
        return;
      }

      const stats = playerStats.get(attendance.playerId);
      if (!stats) return;
      stats.attendances += 1;
      stats.attendancePoints += RANKING_POINTS.ATTENDANCE;
    });

    const eligibleBarbecueIds = new Set(
      barbecueEvents
        .filter(
          (event) =>
            event.active !== false &&
            inRange(event.date, startDate, endDate),
        )
        .map((event) => event.id),
    );

    barbecueConfirmations.forEach((confirmation) => {
      if (
        confirmation.status !== "going" ||
        !eligibleBarbecueIds.has(confirmation.eventId)
      ) {
        return;
      }

      const stats = playerStats.get(confirmation.playerId);
      if (!stats) return;
      stats.barbecues += 1;
      stats.barbecuePoints += RANKING_POINTS.BARBECUE;
    });

    const playersSummary = [...playerStats.values()].map((stats) => ({
      player: stats.player,
      name: stats.name,
      wins: stats.wins,
      nights: stats.nightsSet.size,
      attendances: stats.attendances,
      barbecues: stats.barbecues,
      victoryPoints: stats.victoryPoints,
      attendancePoints: stats.attendancePoints,
      barbecuePoints: stats.barbecuePoints,
      totalPoints:
        stats.victoryPoints +
        stats.attendancePoints +
        stats.barbecuePoints,
    }));

    const pairsSummary = [...pairStats.values()]
      .map((pair) => ({
        key: pair.key,
        left: pair.left,
        right: pair.right,
        name: pair.name,
        wins: pair.wins,
        nights: pair.nightsSet.size,
        hasGuest: pair.hasGuest,
      }))
      .sort(sortByWins);

    const topPlayers = [...playersSummary]
      .filter((item) => item.wins > 0)
      .sort(sortByWins);

    const mostPresent = [...playersSummary]
      .filter((item) => item.attendances > 0)
      .sort(
        (a, b) =>
          b.attendances - a.attendances ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name, "pt-BR"),
      )[0] ?? null;

    const periodRanking = [...playersSummary]
      .filter(
        (item) =>
          item.totalPoints > 0 ||
          item.wins > 0 ||
          item.attendances > 0 ||
          item.barbecues > 0,
      )
      .sort(sortByPoints);

    const monthlyTrend = [...monthlyWins.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, wins]) => ({ month, wins }));

    return {
      summary: {
        totalWins,
        nights: resultSessionIds.size,
        athletes: playersSummary.filter(
          (item) =>
            item.wins > 0 ||
            item.attendances > 0 ||
            item.barbecues > 0,
        ).length,
      },
      mostVictoriousPlayer: topPlayers[0] ?? null,
      mostVictoriousPair: pairsSummary[0] ?? null,
      mostPresent,
      topPlayers,
      topPairs: pairsSummary,
      periodRanking,
      monthlyTrend,
    };
  }
}
