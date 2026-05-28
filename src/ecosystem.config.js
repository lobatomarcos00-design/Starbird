module.exports = {
  apps: [{
    name: "starbird",
    script: "./index.js",
    env: {
      "NODE_ENV": "production"
    },
    env_file: "./.env"  // Explicitly points PM2 to your .env file
  }]
}
