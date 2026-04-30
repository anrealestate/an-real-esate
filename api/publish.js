export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { GITHUB_TOKEN } = process.env
  if (!GITHUB_TOKEN) return res.status(503).json({ error: 'GitHub token not configured' })

  const { listings } = req.body || {}
  if (!Array.isArray(listings)) return res.status(400).json({ error: 'Invalid listings data' })

  const OWNER  = 'dajungcho-cmyk'
  const REPO   = 'an-real-esate'
  const BRANCH = 'main'
  const apiBase = `https://api.github.com/repos/${OWNER}/${REPO}/contents`

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    'User-Agent': 'anrealestate-admin',
    'Content-Type': 'application/json'
  }

  const getFile = async (path) => {
    const r = await fetch(`${apiBase}/${path}`, { headers })
    if (!r.ok) throw new Error(`Cannot read ${path}: ${r.status}`)
    return r.json()
  }

  const putFile = async (path, content, sha, message) => {
    const r = await fetch(`${apiBase}/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha, branch: BRANCH })
    })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      throw new Error(e.message || `GitHub ${r.status} on ${path}`)
    }
    return r.json()
  }

  try {
    const results = []

    // 1 — Update data/listings.json
    const jsonContent = JSON.stringify({ listings }, null, 2)
    const jsonFile    = await getFile('data/listings.json')
    await putFile('data/listings.json', jsonContent, jsonFile.sha,
      `Publish listings (${listings.length} properties)`)
    results.push('data/listings.json ✓')

    // 2 — Update inline data in index.html
    const indexFile    = await getFile('index.html')
    const indexContent = Buffer.from(indexFile.content, 'base64').toString('utf-8')
    const inlineJson   = JSON.stringify({ listings })
    const updated = indexContent.replace(
      /(<script[^>]+id="listings-data"[^>]*>)([\s\S]*?)(<\/script>)/,
      `$1${inlineJson}$3`
    )
    if (updated !== indexContent) {
      await putFile('index.html', updated, indexFile.sha,
        `Sync inline listings data (${listings.length} properties)`)
      results.push('index.html ✓')
    }

    return res.json({ ok: true, count: listings.length, updated: results })
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message })
  }
}
