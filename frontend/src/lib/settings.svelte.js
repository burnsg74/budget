// Small UI preferences persisted in localStorage (no schema change needed in the CSVs).

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable; preference just won't persist
  }
}

class Settings {
  /** Checking balance Home should try to stay above (cents). */
  bufferCents = $state(read("budget.bufferCents", 0));
  /** Income account names that count as "mine" for the job-search floor. null = not chosen yet. */
  myIncome = $state(read("budget.myIncome", null));
  /** Include typical household/other spending in the job-search floor. */
  floorIncludesSpending = $state(read("budget.floorIncludesSpending", false));

  setBuffer(cents) {
    this.bufferCents = cents;
    write("budget.bufferCents", cents);
  }

  setMyIncome(names) {
    this.myIncome = names;
    write("budget.myIncome", names);
  }

  setFloorIncludesSpending(value) {
    this.floorIncludesSpending = value;
    write("budget.floorIncludesSpending", value);
  }

  /** Chosen names, or income accounts matching /barrelhead/i by default. */
  resolveMyIncome(accounts) {
    if (this.myIncome) return this.myIncome;
    return accounts.filter((a) => a.type === "income" && /barrelhead/i.test(a.name)).map((a) => a.name);
  }
}

export const settings = new Settings();
