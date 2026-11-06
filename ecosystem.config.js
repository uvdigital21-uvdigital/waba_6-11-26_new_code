module.exports = {
  apps: [
    {
      name: 'waba-backend',
      script: 'server.js',
      instances: 'max',             // Run in cluster mode over all CPU cores
      exec_mode: 'cluster',         // Enable Node clustering
      watch: false,                 // Do not restart on file changes in production
      max_memory_restart: '1G',     // Restart if memory exceeds 1GB to prevent leaks
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
