export const PLAYER_SIDE = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
});

export class Player {
  constructor(name, side, options = {}) {
    if (!name?.trim()) {
      throw new Error("O nome do jogador é obrigatório.");
    }

    if (!Object.values(PLAYER_SIDE).includes(side)) {
      throw new Error("O lado informado para o jogador é inválido.");
    }

    this.id = options.id ?? crypto.randomUUID();
    this.name = name.trim();
    this.side = side;
    this.birthDate = options.birthDate ?? null;
    this.active = options.active ?? true;
    this.createdAt = options.createdAt ?? new Date().toISOString();

    Object.freeze(this);
  }

  static fromJSON(data) {
    return new Player(data.name, data.side, data);
  }
}
