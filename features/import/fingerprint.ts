import { createHash } from "node:crypto";

export function fingerprint(parts: (string | number | null)[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
