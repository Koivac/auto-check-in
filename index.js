async function discordWebhookSend() {
  const embeds = []
  let temp = []
  let accountName = null
  let acctIndex = 0

  for (const msg of messages) {
    if (msg.string.startsWith("登入帳號：")) {

      // Finish previous embed
      if (accountName !== null) {
        embeds.push({
          title: accountName,
          description: temp.join("\n"),
          color:
            accountName === "魚"
              ? 9537247
              : acctIndex % 2 === 0 ? 0x4BD1FF : 0x44FF88
        })
      }

      temp = []
      accountName = msg.string.replace("登入帳號：", "")
      acctIndex++
      continue
    }

    temp.push(msg.string)
  }

  // Final account embed
  if (accountName) {
    embeds.push({
      title: accountName,
      description: temp.join("\n"),
      color:
        accountName === "魚"
          ? 9537247
          : acctIndex % 2 === 0 ? 0x4BD1FF : 0x44FF88
    })
  }

  const payload = {
    embeds,
    content: discordUser ? `<@${discordUser}>` : null
  }

  await fetch(discordWebhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
}
