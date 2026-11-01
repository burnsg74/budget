<script>
  import { data } from "./lib/data.svelte.js";
  import { matchRoute, router } from "./lib/router.svelte.js";
  import AccountDetail from "./routes/AccountDetail.svelte";
  import Accounts from "./routes/Accounts.svelte";
  import Home from "./routes/Home.svelte";
  import Reports from "./routes/Reports.svelte";
  import Settings from "./routes/Settings.svelte";
  import Transactions from "./routes/Transactions.svelte";

  const route = $derived(matchRoute(router.path));

  const links = [
    { href: "/", label: "Home", match: (n) => n === "home" },
    { href: "/accounts", label: "Accounts", match: (n) => n === "accounts" || n === "account" },
    { href: "/transactions", label: "Transactions", match: (n) => n === "transactions" },
    { href: "/reports", label: "Reports", match: (n) => n === "reports" },
    { href: "/settings", label: "Settings", match: (n) => n === "settings" },
  ];

  data.load();
</script>

<svelte:window onclick={router.handleClick} />

<header>
  <a class="brand" href="/">Budget</a>
  <nav>
    {#each links as link (link.href)}
      <a href={link.href} class={{ active: link.match(route.name) }}>{link.label}</a>
    {/each}
  </nav>
</header>

{#if data.error}
  <div class="banner" role="alert">
    <span>{data.error}</span>
    <button onclick={() => (data.error = "")}>Dismiss</button>
  </div>
{/if}

<main>
  {#if !data.loaded}
    <p class="muted">Loading…</p>
  {:else if route.name === "home"}
    <Home />
  {:else if route.name === "accounts"}
    <Accounts />
  {:else if route.name === "transactions"}
    <Transactions />
  {:else if route.name === "account"}
    <AccountDetail name={route.accountName} />
  {:else if route.name === "reports"}
    <Reports />
  {:else if route.name === "settings"}
    <Settings />
  {:else}
    <h1>Not found</h1>
    <p><a href="/">Back to Home</a></p>
  {/if}
</main>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 10px 24px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .brand {
    font-weight: 700;
    font-size: 16px;
    color: var(--text);
  }

  nav {
    display: flex;
    gap: 4px;
  }

  nav a {
    padding: 5px 12px;
    border-radius: 6px;
    color: var(--muted);
  }

  nav a:hover {
    text-decoration: none;
    background: var(--bg);
  }

  nav a.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  main {
    padding: 18px 24px 40px;
    max-width: 1500px;
    margin: 0 auto;
  }

  .banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: var(--bad-soft);
    color: var(--bad);
    padding: 8px 24px;
    border-bottom: 1px solid var(--line);
  }
</style>
