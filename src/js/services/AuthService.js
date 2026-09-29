export class AuthService {
  constructor(client, repository) {
    this.client = client;
    this.repository = repository;
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

    this.repository.setAuthenticatedUser(data.user);
    await this.repository.sync();

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
      throw new Error("E-mail ou senha inválidos.");
    }

    this.repository.setAuthenticatedUser(data.user);
    await this.repository.sync();

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
