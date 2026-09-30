import { PLAYER_SIDE } from "../domain/Player.js";

export const RANKING_POINTS = Object.freeze({
  ATTENDANCE: 2,
  VICTORY: 1,
  BARBECUE: 4,
});

export class RankingService {
  static calculate({
    players,
    attendances,
    pairResults,
    barbecueConfirmations = [],
    manualPoints = [],
  }) {
    const ranking = new Map(
      players.map((player) => [
        player.id,
        {
          player,
          attendancePoints: 0,
          barbecuePoints: 0,
          victoryPoints: 0,
          manualPoints: 0,
          totalPoints: 0,
          nights: 0,
          wins: 0,
          barbecues: 0,
        },
      ]),
    );

    attendances.forEach((attendance) => {
      const item = ranking.get(attendance.playerId);
      if (!item || attendance.status !== "present") return;

      item.nights += 1;
      item.attendancePoints += RANKING_POINTS.ATTENDANCE;
    });

    pairResults.forEach((result) => {
      const wins = Math.max(0, Number(result.wins) || 0);

      [result.leftPlayerId, result.rightPlayerId].forEach((playerId) => {
        const item = ranking.get(playerId);
        if (!item) return;

        item.wins += wins;
        item.victoryPoints += wins * RANKING_POINTS.VICTORY;
      });
    });

    barbecueConfirmations.forEach((confirmation) => {
      const item = ranking.get(confirmation.playerId);
      if (!item || confirmation.status !== "going") return;

      item.barbecues += 1;
      item.barbecuePoints += RANKING_POINTS.BARBECUE;
    });

    manualPoints.forEach((adjustment) => {
      const item = ranking.get(adjustment.playerId);
      if (!item) return;

      item.manualPoints += Number(adjustment.points) || 0;
    });

    ranking.forEach((item) => {
      item.totalPoints =
        item.attendancePoints +
        item.barbecuePoints +
        item.victoryPoints +
        item.manualPoints;
    });

    const sortRanking = (items) =>
      items.sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.wins - a.wins ||
          a.player.name.localeCompare(b.player.name, "pt-BR"),
      );

    return {
      left: sortRanking(
        [...ranking.values()].filter(
          (item) => item.player.side === PLAYER_SIDE.LEFT,
        ),
      ),
      right: sortRanking(
        [...ranking.values()].filter(
          (item) => item.player.side === PLAYER_SIDE.RIGHT,
        ),
      ),
    };
  }
}
