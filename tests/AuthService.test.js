import test from "node:test";
import assert from "node:assert/strict";

import { AuthService } from "../src/js/services/AuthService.js";
import { PLAYER_SIDE } from "../src/js/domain/Player.js";

const accountData = {
  email: "athlete@example.test",
  password: "supabase-access",
  name: "Lucas",
  birthDate: "1999-03-31",
  side: PLAYER_SIDE.LEFT,
};

class RepositoryMock {
  constructor() {
    this.user = null;
    this.syncCount = 0;
  }

  setAuthenticatedUser(user) {
    this.user = user ?? null;
  }

  async sync() {
    this.syncCount += 1;
  }

  getCurrentAccount() {
    if (!this.user) return null;

    return {
      id: this.user.id,
      email: this.user.email,
      playerId: this.user.id,
      active: true,
    };
  }
}

test("cadastro com sessão autentica e sincroniza o atleta", async () => {
  const user = { id: "user-1", email: accountData.email };
  const client = {
    auth: {
      async signUp(payload) {
        assert.equal(payload.email, accountData.email);
        assert.equal(payload.options.data.full_name, "Lucas");
        assert.equal(payload.options.data.birth_date, "1999-03-31");
        assert.equal(payload.options.data.side, PLAYER_SIDE.LEFT);

        return {
          data: {
            user,
            session: { user },
          },
          error: null,
        };
      },
    },
  };
  const repository = new RepositoryMock();
  const auth = new AuthService(client, repository);

  const result = await auth.register(accountData);

  assert.equal(result.requiresEmailConfirmation, false);
  assert.equal(repository.getCurrentAccount().id, "user-1");
  assert.equal(repository.syncCount, 1);
});

test("cadastro sem sessão informa que o e-mail precisa ser confirmado", async () => {
  const client = {
    auth: {
      async signUp() {
        return {
          data: {
            user: { id: "user-1", email: accountData.email },
            session: null,
          },
          error: null,
        };
      },
    },
  };
  const repository = new RepositoryMock();
  const auth = new AuthService(client, repository);

  const result = await auth.register(accountData);

  assert.equal(result.requiresEmailConfirmation, true);
  assert.equal(result.email, accountData.email);
  assert.equal(repository.syncCount, 0);
});

test("login usa Supabase Auth e sincroniza a sessão", async () => {
  const user = { id: "user-2", email: accountData.email };
  const client = {
    auth: {
      async signInWithPassword({ email, password }) {
        assert.equal(email, accountData.email);
        assert.equal(password, accountData.password);

        return {
          data: { user, session: { user } },
          error: null,
        };
      },
    },
  };
  const repository = new RepositoryMock();
  const auth = new AuthService(client, repository);

  const account = await auth.login(
    accountData.email,
    accountData.password,
  );

  assert.equal(account.id, "user-2");
  assert.equal(repository.syncCount, 1);
});

test("logout encerra a sessão do Supabase", async () => {
  let signedOut = false;
  const client = {
    auth: {
      async signOut() {
        signedOut = true;
        return { error: null };
      },
    },
  };
  const repository = new RepositoryMock();
  repository.setAuthenticatedUser({
    id: "user-3",
    email: accountData.email,
  });
  const auth = new AuthService(client, repository);

  await auth.logout();

  assert.equal(signedOut, true);
  assert.equal(repository.getCurrentAccount(), null);
});
