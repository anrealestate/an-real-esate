export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'No API key' })

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  )
  const data = await r.json()
  if (!r.ok) return res.status(500).json(data)

  // Return only vision-capable models
  const vision = (data.models || [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name)

  return res.json({ models: vision })
}
