module.exports = {
  apps: [
    {
      name: 'kbeauty',
      script: 'npx',
      // wrangler pages dev는 .dev.vars 파일을 자동으로 읽음
      // --binding 대신 .dev.vars를 사용해서 토큰 이스케이프 문제 방지
      args: 'wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
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
