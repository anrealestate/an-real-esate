const ALLOWED_ORIGINS = ['https://anrealestate.es', 'https://www.anrealestate.es']

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin || ''
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ visits: [], error: 'Forbidden' })
    res.setHeader('Cache-Control', 'no-store')

    const { GITHUB_TOKEN, GIST_ID } = process.env
    if (!GITHUB_TOKEN || !GIST_ID) return res.json({ visits: [], configured: false })

    const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'anrealestate-visits'
      }
    })
    if (!gistRes.ok) {
      const errText = await gistRes.text()
      return res.json({ visits: [], configured: true, error: `GitHub ${gistRes.status}: ${errText.slice(0, 100)}` })
    }

    const gist = await gistRes.json()
    const content = gist.files?.['visits.json']?.content || '[]'
    let visits = []
    try { visits = JSON.parse(content) } catch { visits = [] }
    return res.json({ visits, configured: true })
  } catch (e) {
    return res.status(500).json({ visits: [], configured: true, error: e.message })
  }
}
