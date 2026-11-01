// Entry point (pm2 and `npm start`). Binds loopback only.
import { resolveConfig } from "./config.js";
import { createApp } from "./server.js";

const config = resolveConfig();
const server = createApp(config);

server.listen(config.port, "127.0.0.1", () => {
  console.log(`budget-api ${config.mode} on http://127.0.0.1:${config.port}  data: ${config.dir}`);
});

const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
