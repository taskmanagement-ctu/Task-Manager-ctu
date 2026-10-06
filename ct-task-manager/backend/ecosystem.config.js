module.exports = {
  apps: [
    {
      name: 'ct-backend',
      script: './dist/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
