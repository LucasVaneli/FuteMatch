export class Group {
  constructor(name, options = {}) {
    if (!name?.trim()) {
      throw new Error("O nome da patota é obrigatório.");
    }

    this.id = options.id ?? crypto.randomUUID();
    this.name = name.trim();
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
