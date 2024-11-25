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
        PORT: 3002
      }
    },
  ],
}
