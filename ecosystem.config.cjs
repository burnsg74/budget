const node =
  "/Users/greg/.local/share/fnm/node-versions/v24.18.1/installation/bin/node";

module.exports = {
  apps: [
    {
      name: "3000-budget",
      cwd: "/Users/greg/Code/Local/3000-budget",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      interpreter: node,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
