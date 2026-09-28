import test from "node:test";
import assert from "node:assert/strict";

import { FuteMatchRepository } from "../src/js/services/FuteMatchRepository.js";
import { AuthService } from "../src/js/services/AuthService.js";
import { PLAYER_SIDE } from "../src/js/domain/Player.js";

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, value); }
}

const accountData = {
  email: "athlete@example.test",
  password: "local-demo-access",
  name: "Lucas",
  birthDate: "1999-03-31",
  side: PLAYER_SIDE.LEFT,
};

test("criação de conta cria perfil e autentica o atleta", async () => {
  const repository = new FuteMatchRepository(new MemoryStorage());
  const auth = new AuthService(repository);
  const account = await auth.register(accountData);
  assert.equal(repository.getCurrentUserId(), account.id);
  assert.equal(repository.getCurrentPlayer().name, "Lucas");
});

test("login valida acesso e restaura usuário atual", async () => {
  const repository = new FuteMatchRepository(new MemoryStorage());
  const auth = new AuthService(repository);
  await auth.register(accountData);
  auth.logout();
  assert.equal(repository.getCurrentUserId(), null);
  await auth.login(accountData.email, accountData.password);
  assert.equal(repository.getCurrentPlayer().name, "Lucas");
  await assert.rejects(
    () => auth.login(accountData.email, "acesso-incorreto"),
    /inválidos/i,
  );
});
