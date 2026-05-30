const fs = require('fs')
const path = require('path')

// .dev.vars 파일에서 환경변수 읽기
function readDevVars() {
  try {
    const content = fs.readFileSync(path.join(__dirname, '.dev.vars'), 'utf-8')
    const vars = {}
    content.split('\n').forEach(line => {
      const m = line.match(/^([^=]+)=(.*)$/)
      if (m) vars[m[1].trim()] = m[2].trim()
    })
    return vars
  } catch { return {} }
}

const devVars = readDevVars()
const gskToken = process.env.GSK_TOKEN || devVars.GSK_TOKEN || ''
const genskToken = process.env.GENSPARK_TOKEN || devVars.GENSPARK_TOKEN || gskToken

module.exports = {
  apps: [
    {
      name: 'kbeauty',
      script: 'npx',
      args: `wrangler pages dev dist --ip 0.0.0.0 --port 3000 --binding GSK_TOKEN=${gskToken} --binding GENSPARK_TOKEN=${genskToken}`,
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
