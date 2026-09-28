const encodeHex = (buffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const hashPassword = async (password) => {
  if (!password || password.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  if (!globalThis.crypto?.subtle) {
    return `demo:${password}`;
  }

  const data = new TextEncoder().encode(password);
  return encodeHex(await globalThis.crypto.subtle.digest("SHA-256", data));
};

export class AuthService {
  constructor(repository) {
    this.repository = repository;
  }

  async register({ email, password, name, birthDate, side }) {
    const passwordHash = await hashPassword(password);
    return this.repository.createAccount({
      email,
      passwordHash,
      name,
      birthDate,
      side,
    });
  }

  async login(email, password) {
    const account = this.repository.getAccountByEmail(email);
    if (!account || account.active === false) {
      throw new Error("E-mail ou senha inválidos.");
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== account.passwordHash) {
      throw new Error("E-mail ou senha inválidos.");
    }

    this.repository.setCurrentUser(account.id);
    return account;
  }

  logout() {
    this.repository.signOut();
  }

  getCurrentAccount() {
    return this.repository.getCurrentAccount();
  }
}
