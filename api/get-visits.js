export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
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
