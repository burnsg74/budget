// Tiny history-API router. nginx serves index.html for every path (SPA fallback).

class Router {
  path = $state(window.location.pathname);

  constructor() {
    window.addEventListener("popstate", () => {
      this.path = window.location.pathname;
    });
  }

  navigate(to, { replace = false } = {}) {
    if (to === this.path) return;
    if (replace) window.history.replaceState({}, "", to);
    else window.history.pushState({}, "", to);
    this.path = to;
    window.scrollTo(0, 0);
  }

  /** Intercept same-origin <a href="/..."> clicks. */
  handleClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    event.preventDefault();
    this.navigate(href);
  };
}

export const router = new Router();

export const accountPath = (name) => `/accounts/${encodeURIComponent(name)}`;

/** Match the current path against the route table. */
export function matchRoute(path) {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/") return { name: "home" };
  if (clean === "/accounts") return { name: "accounts" };
  if (clean === "/transactions") return { name: "transactions" };
  if (clean === "/reports") return { name: "reports" };
  if (clean === "/settings") return { name: "settings" };
  const detail = /^\/accounts\/([^/]+)$/.exec(clean);
  if (detail) {
    try {
      return { name: "account", accountName: decodeURIComponent(detail[1]) };
    } catch {
      return { name: "notfound" };
    }
  }
  return { name: "notfound" };
}
