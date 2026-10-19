const isJwtClockSkewError = (error) =>
  /jwt issued at future/i.test(String(error?.message ?? error ?? ""));

export class AuthService {
  constructor(
    client,
    repository,
    { syncRetryDelayMs = 750 } = {},
  ) {
    this.client = client;
    this.repository = repository;
    this.syncRetryDelayMs = syncRetryDelayMs;
  }

  async #syncAuthenticatedUser(user) {
    this.repository.setAuthenticatedUser(user);

    try {
      await this.repository.sync();
    } catch (error) {
      if (!isJwtClockSkewError(error)) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.syncRetryDelayMs),
      );
      await this.repository.sync();
    }
  }

  async register({ email, password, name, birthDate, side }) {
    if (!password || password.length < 6) {
      throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    }

    const redirectTo = new URL(
      "./",
      globalThis.location?.href ?? "http://localhost:5500/",
    ).href;

    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: name.trim(),
          birth_date: birthDate,
          side,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.session) {
      return {
        requiresEmailConfirmation: true,
        email: data.user?.email ?? email.trim(),
      };
    }

    await this.#syncAuthenticatedUser(data.user);

    return {
      requiresEmailConfirmation: false,
      account: this.repository.getCurrentAccount(),
    };
  }

  async login(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      const message = String(error.message ?? "");
      if (
        error.code === "invalid_credentials" ||
        /invalid login credentials/i.test(message)
      ) {
        throw new Error("E-mail ou senha inválidos.");
      }

      throw new Error(
        message || "Não foi possível acessar o Supabase.",
      );
    }

    await this.#syncAuthenticatedUser(data.user);

    return this.repository.getCurrentAccount();
  }

  async logout() {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    this.repository.setAuthenticatedUser(null);
  }

  getCurrentAccount() {
    return this.repository.getCurrentAccount();
  }
}
