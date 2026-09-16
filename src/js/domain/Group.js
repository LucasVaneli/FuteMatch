export class Group {
  constructor(name, options = {}) {
    if (!name?.trim()) {
      throw new Error("O nome da patota é obrigatório.");
    }

    this.id = options.id ?? crypto.randomUUID();
    this.name = name.trim();
    this.createdAt = options.createdAt ?? new Date().toISOString();

    Object.freeze(this);
  }

  static fromJSON(data) {
    return new Group(data.name, data);
  }
}
