const ALLOWED_ORIGINS = ['https://anrealestate.es', 'https://www.anrealestate.es', 'https://an-real-esate-topaz.vercel.app']

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { GITHUB_TOKEN } = process.env
  if (!GITHUB_TOKEN) return res.status(503).json({ error: 'GitHub token not configured' })

  const { listings } = req.body || {}
  if (!Array.isArray(listings)) return res.status(400).json({ error: 'Invalid listings data' })

  const OWNER   = 'anrealestate'
  const REPO    = 'an-real-esate'
  const BRANCH  = 'main'
  const apiBase = `https://api.github.com/repos/${OWNER}/${REPO}/contents`

  const ghHeaders = {
    Authorization: `token ${GITHUB_TOKEN}`,
    'User-Agent':  'anrealestate-admin',
    'Content-Type': 'application/json',
  }

  const getFile = async (path) => {
    const r = await fetch(`${apiBase}/${path}`, { headers: ghHeaders })
    if (!r.ok) throw new Error(`Cannot read ${path}: ${r.status}`)
    return r.json()
  }

  const putFile = async (path, content, sha, message) => {
    const r = await fetch(`${apiBase}/${path}`, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha, branch: BRANCH }),
    })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      throw new Error(e.message || `GitHub ${r.status} on ${path}`)
    }
    return r.json()
  }

  try {
    const results = []

    // 1 — data/listings.json
    const jsonContent = JSON.stringify({ listings }, null, 2)
    const jsonFile    = await getFile('data/listings.json')
    await putFile('data/listings.json', jsonContent, jsonFile.sha, `Publish listings (${listings.length} properties)`)
    results.push('data/listings.json ✓')

    // 2 — inline data in index.html
    const indexFile    = await getFile('index.html')
    const indexContent = Buffer.from(indexFile.content, 'base64').toString('utf-8')
    const inlineJson   = JSON.stringify({ listings })
    const updated = indexContent.replace(
      /(<script[^>]+id="listings-data"[^>]*>)([\s\S]*?)(<\/script>)/,
      `$1${inlineJson}$3`
    )
    if (updated !== indexContent) {
      await putFile('index.html', updated, indexFile.sha, `Sync inline listings data (${listings.length} properties)`)
      results.push('index.html ✓')
    }

    // 3 — data-listings.js (used by property.html)
    const dlFile    = await getFile('data-listings.js')
    const dlContent = `/* Shared listings data — auto-generated */\n;(function () {\n  const el = document.getElementById('listings-data')\n  if (el) return\n  const s = document.createElement('script')\n  s.id   = 'listings-data'\n  s.type = 'application/json'\n  s.textContent = JSON.stringify(${JSON.stringify({ listings })})\n  document.head.appendChild(s)\n})()\n`
    await putFile('data-listings.js', dlContent, dlFile.sha, `Sync data-listings.js (${listings.length} properties)`)
    results.push('data-listings.js ✓')

    return res.status(200).json({ ok: true, count: listings.length, updated: results })
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message })
  }
}
