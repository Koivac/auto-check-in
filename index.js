#!/usr/bin/env node

const cookies = process.env.COOKIE.split('\n').map(s => s.trim())
const games = process.env.GAMES.split('\n').map(s => s.trim())
const discordWebhook = process.env.DISCORD_WEBHOOK
const discordUser = process.env.DISCORD_USER
const messages = []

const endpoints = {
  zzz: 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign?act_id=e202406031448091',
  gi:  'https://sg-hk4e-api.hoyolab.com/event/sol/sign?act_id=e202102251931481',
  hsr: 'https://sg-public-api.hoyolab.com/event/luna/os/sign?act_id=e202303301540311',
  hi3: 'https://sg-public-api.hoyolab.com/event/mani/sign?act_id=e202110291205111',
  tot: 'https://sg-public-api.hoyolab.com/event/luna/os/sign?act_id=e202202281857121',
}

// 中文遊戲名
const gameNames = {
  zzz: 'ZZZ',
  gi: '原神',
  hsr: '崩鐵',
  hi3: '崩壞3rd',
  tot: '未定事件簿'
}

// Account names with special styling
const accountNames = {
  0: '魚',
  1: '嘟嘟噠'
}

const accountColors = {
  0: null, // Default color for 魚
  1: 0x4BD1FF // Blue color for 宇
}

let hasErrors = false
let latestGames = []

async function run(cookie, games) {
  if (!games) {
    games = latestGames
  } else {
    games = games.split(' ')
    latestGames = games
  }

  for (let game of games) {
    game = game.toLowerCase()

    if (!(game in endpoints)) {
      log('error', `遊戲 ${game} 無效，可用遊戲: zzz, gi, hsr, hi3, tot`)
      continue
    }

    const endpoint = endpoints[game]
    const url = new URL(endpoint)
    const actId = url.searchParams.get('act_id')
    url.searchParams.set('lang', 'en-us')

    const body = JSON.stringify({
      lang: 'en-us',
      act_id: actId
    })

    const headers = new Headers()
    headers.set('accept', 'application/json, text/plain, */*')
    headers.set('accept-encoding', 'gzip, deflate, br, zstd')
    headers.set('accept-language', 'en-US,en;q=0.6')
    headers.set('connection', 'keep-alive')
    headers.set('origin', 'https://act.hoyolab.com')
    headers.set('referrer', 'https://act.hoyolab.com')
    headers.set('content-type', 'application.json;charset=UTF-8')
    headers.set('cookie', cookie)
    headers.set('sec-ch-ua', '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"')
    headers.set('sec-ch-ua-mobile', '?0')
    headers.set('sec-ch-ua-platform', '"Linux"')
    headers.set('sec-fetch-dest', 'empty')
    headers.set('sec-fetch-mode', 'cors')
    headers.set('sec-fetch-site', 'same-site')
    headers.set('sec-gpc', '1')
    headers.set("x-rpc-signgame", game)
    headers.set('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

    const res = await fetch(url, { method: 'POST', headers, body })
    const json = await res.json()
    const code = String(json.retcode)

    const successCodes = {
      '0': '成功簽到！',
      '-5003': '今日已簽到過！'
    }

    if (code in successCodes) {
      log('info', `${gameNames[game]}：${successCodes[code]}`)
      continue
    }

    const errorCodes = {
      '-100': '錯誤：未登入（Cookie 無效 / CALL FISH）',
      '-10002': '尚未遊玩此遊戲'
    }

    if (code in errorCodes) {
      log('error', `${gameNames[game]}：${errorCodes[code]}`)
      continue
    }

    log('error', `${gameNames[game]}：未知錯誤，請回報 Issues`)
  }
}

function log(type, ...data) {
  console[type](...data)
  if (type === 'error') hasErrors = true
  if (type === 'debug') return

  const string = data
    .map(v => (typeof v === 'object' ? JSON.stringify(v, null, 2) : v))
    .join(' ')

  messages.push({ type, string })
}

async function discordWebhookSend() {
  let discordMsg = ""

  if (discordUser) discordMsg = `<@${discordUser}>\n`

  // Format messages with colors for Discord embed
  const formattedMessages = messages.map(m => {
    // Check if message contains account name
    for (const [index, name] of Object.entries(accountNames)) {
      if (m.string.includes(`帳號：${name}`)) {
        const color = accountColors[index]
        if (color) {
          // Create Discord embed format
          return {
            embeds: [{
              title: `帳號：${name}`,
              color: color,
              description: m.string.replace(`正在替帳號：${name} 登入`, '').trim() || '開始簽到...'
            }]
          }
        }
      }
    }
    return m.string
  })

  // Check if we have embeds
  const hasEmbeds = formattedMessages.some(m => typeof m === 'object')
  
  if (hasEmbeds) {
    // Send with embeds
    const embeds = formattedMessages.filter(m => typeof m === 'object')
    const plainMessages = formattedMessages.filter(m => typeof m === 'string')
    
    discordMsg += plainMessages.join('\n')
    
    const payload = {
      content: discordMsg,
      embeds: embeds.map(e => e.embeds[0])
    }
    
    const res = await fetch(discordWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.status !== 204) {
      log('error', 'Discord webhook 發送失敗')
    }
  } else {
    // Original plain text method
    discordMsg += messages.map(m => m.string).join('\n')
    
    const res = await fetch(discordWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: discordMsg })
    })

    if (res.status !== 204) {
      log('error', 'Discord webhook 發送失敗')
    }
  }
}

// main stuff
if (!cookies || !cookies.length) throw new Error('COOKIE 未設定!')
if (!games || !games.length) throw new Error('GAMES 未設定!')

for (const index in cookies) {
  // Get account name - use custom name if exists, otherwise use default 帳號X
  const name = accountNames[index] || `帳號${Number(index) + 1}`
  log('info', `正在替帳號：${name} 登入`)
  await run(cookies[index], games[index])
}

if (discordWebhook && URL.canParse(discordWebhook)) {
  await discordWebhookSend()
}

if (hasErrors) throw new Error('有錯誤發生!!!11!!1!!!!')
