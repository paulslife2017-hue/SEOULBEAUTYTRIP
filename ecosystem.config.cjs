module.exports = {
  apps: [
    {
      name: 'kbeauty',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000 --binding GSK_TOKEN=' + process.env.GSK_TOKEN,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
