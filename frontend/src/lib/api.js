// Thin fetch wrapper. The frontend only talks to /api/*, never to disk.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON error body
  }
  if (!res.ok) throw new Error(payload?.error ?? `Request failed (${res.status})`);
  return payload;
}

const enc = encodeURIComponent;

export const api = {
  data: () => request("GET", "/api/data"),
  createAccount: (input) => request("POST", "/api/accounts", input),
  updateAccount: (name, patch) => request("PATCH", `/api/accounts/${enc(name)}`, patch),
  deleteAccount: (name) => request("DELETE", `/api/accounts/${enc(name)}`),
  createTransaction: (input) => request("POST", "/api/transactions", input),
  updateTransaction: (hash, patch) => request("PATCH", `/api/transactions/${enc(hash)}`, patch),
  deleteTransaction: (hash) => request("DELETE", `/api/transactions/${enc(hash)}`),
};
