// Resolves where CSV data lives. Prod: vault. Dev: repo data/dev. Override with DATA_PATH.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "..");

export const DEFAULT_VAULT_PATH = "/Users/greg/Library/CloudStorage/Dropbox/Notebooks/Work";
export const DEFAULT_DATA_DIR = "10 Projects/Budget/data";

export function resolveConfig(env = process.env) {
  const mode = env.NODE_ENV === "production" ? "production" : "development";
  const vaultPath = env.VAULT_PATH || DEFAULT_VAULT_PATH;
  const dataDir = env.DATA_DIR || DEFAULT_DATA_DIR;
  const prodDir = path.resolve(vaultPath, dataDir);

  // Never write outside the vault in production.
  const rel = path.relative(path.resolve(vaultPath), prodDir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`DATA_DIR must stay inside VAULT_PATH (${dataDir})`);
  }

  const dir = env.DATA_PATH
    ? path.resolve(env.DATA_PATH)
    : mode === "production"
      ? prodDir
      : path.join(repoRoot, "data", "dev");

  return {
    mode,
    port: Number(env.PORT || 4001),
    vaultPath,
    prodDir,
    devDir: path.join(repoRoot, "data", "dev"),
    dir,
  };
}
