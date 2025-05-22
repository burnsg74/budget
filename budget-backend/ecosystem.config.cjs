module.exports = {
  apps: [
    {
      name: "budget",
      script: "app.js",
      instances: 1,
      watch: false,
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      },
      node_args: "--max-http-header-size=20480", // 20KB for headers
      max_restarts: 10,
      kill_timeout: 4000, // Give time for uploads to complete when restarting
      wait_ready: true

    },
  ],
}
