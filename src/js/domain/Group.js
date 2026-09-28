export const GROUP_WEEKDAY = Object.freeze({
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
});

export const GROUP_WEEKDAY_LABEL = Object.freeze({
  [GROUP_WEEKDAY.MONDAY]: "Segunda-feira",
  [GROUP_WEEKDAY.TUESDAY]: "Terça-feira",
  [GROUP_WEEKDAY.WEDNESDAY]: "Quarta-feira",
  [GROUP_WEEKDAY.THURSDAY]: "Quinta-feira",
  [GROUP_WEEKDAY.FRIDAY]: "Sexta-feira",
});

export class Group {
  constructor(name, options = {}) {
    if (!name?.trim()) {
      throw new Error("O nome da patota é obrigatório.");
    }

    this.id = options.id ?? crypto.randomUUID();
    this.name = name.trim();
    this.weekday =
      options.weekday === null || options.weekday === undefined
        ? null
        : Number(options.weekday);
    this.startTime = options.startTime ?? null;
    this.endTime = options.endTime ?? null;
    this.ownerUserId = options.ownerUserId ?? null;
    this.active = options.active ?? true;
    this.createdAt = options.createdAt ?? new Date().toISOString();

    Object.freeze(this);
  }

  static fromJSON(data) {
    return new Group(data.name, data);
  }
}
