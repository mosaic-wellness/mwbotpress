module.exports = {
  apps: [
    {
      name: "mwbotpress",
      cwd: "./",
      script: "yarn",
      args: "start",
      instances: "2",
      instance_var: "INSTANCE_ID",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "staging",
        PORT: "3000",
        BUILD_NUMBER: process.env.BUILD_NUMBER || "NA",
      },
      env_staging: {
        NODE_ENV: "staging",
        PORT: "3000",
        BUILD_NUMBER: process.env.BUILD_NUMBER || "NA",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3001",
        BUILD_NUMBER: process.env.BUILD_NUMBER || "NA",
      },
    },
  ],
};