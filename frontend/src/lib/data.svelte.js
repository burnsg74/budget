// Shared app data. Server is the source of truth: every write reloads both CSVs.
import { api } from "./api.js";

class AppData {
  accounts = $state.raw([]);
  transactions = $state.raw([]);
  loaded = $state(false);
  error = $state("");

  async load() {
    try {
      const { accounts, transactions } = await api.data();
      this.accounts = accounts;
      this.transactions = transactions;
      this.error = "";
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loaded = true;
    }
  }

  /** Run a write, then reload. Errors are reported and rethrown to the caller. */
  async #write(fn) {
    try {
      const result = await fn();
      await this.load();
      return result;
    } catch (e) {
      this.error = e.message;
      await this.load();
      this.error = e.message; // load() clears it on success; keep the write error visible
      throw e;
    }
  }

  createAccount = (input) => this.#write(() => api.createAccount(input));
  updateAccount = (name, patch) => this.#write(() => api.updateAccount(name, patch));
  deleteAccount = (name) => this.#write(() => api.deleteAccount(name));
  createTransaction = (input) => this.#write(() => api.createTransaction(input));
  updateTransaction = (hash, patch) => this.#write(() => api.updateTransaction(hash, patch));
  deleteTransaction = (hash) => this.#write(() => api.deleteTransaction(hash));
}

export const data = new AppData();
