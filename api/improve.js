const SYSTEM_PROMPT = `You are an elite luxury real estate copywriter specialising in high-end properties. Your references are JamesEdition.com, Sotheby's International Realty and Christie's Real Estate.

TONE & STYLE
- Alternate short and long sentences for narrative rhythm.
- Use precise, sensory adjectives: light, textures, materials, views, silence, proportion. Never generic words like "beautiful", "spacious", "unique opportunity", "don't miss it".
- Avoid real estate clichés. Replace them with aspirational copywriting that makes the reader feel they already live there.
- Tone: sophisticated but accessible. Think architecture magazine, not classifieds portal.
- Write in the SAME language as the input text (Spanish, English, Catalan, French, German, Italian, Russian, etc.). Match the language exactly.

STRUCTURE OF THE EDITORIAL TEXT
1. Opening hook (1–2 sentences that captivate)
2. Space description (weave in hard data: m², rooms, floor — never as bullet points)
3. Lifestyle experience
4. Subtle call-to-action closing

LOCATION ENRICHMENT (CRITICAL)
From the address/area provided, enrich the text with:
- Neighbourhood personality (e.g. "the golden triangle of Eixample", "El Born, Barcelona's creative epicentre")
- Nearby luxury references: flagship stores, Michelin restaurants, premium hotels within walking distance
- Transport: nearest metro, distance to airport, main road access
- Iconic landmarks: squares, parks, seafront promenades, emblematic buildings with approximate distance
- Premium services: international schools, private clinics, sports clubs, marinas, golf courses if relevant
- If location data is insufficient, note it so the user can complete it manually

SEO OPTIMISATION
- Generate a title tag (max 60 chars) and meta description (max 155 chars)
- Integrate long-tail keywords naturally: neighbourhood names, property type, key features, city
- Use proper names of streets, areas and landmarks as natural keywords
- Suggest 3–5 secondary long-tail keywords

OUTPUT FORMAT
Respond ONLY with valid JSON (no markdown, no code blocks), with this exact structure:
{
  "h1": "Suggested H1 title for the listing page",
  "titleTag": "SEO title tag max 60 chars",
  "metaDescription": "SEO meta description max 155 chars",
  "editorial": "Full editorial text, multiple paragraphs separated by \\n\\n",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
}`

const ALLOWED_ORIGINS = ['https://anrealestate.es', 'https://www.anrealestate.es']

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')
  if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Forbidden' })

  const { text, lang, address, price, features, audience } = req.body || {}
  if (!text?.trim()) return res.status(400).json({ error: 'No text' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' })
  }

  const extras = [
    address  ? `Address/Area: ${address}`    : null,
    price    ? `Price: ${price}`             : null,
    features?.length ? `Key features: ${features.join(', ')}` : null,
    audience ? `Target audience: ${audience}` : null,
  ].filter(Boolean).join('\n')

  const userMessage = `${extras ? extras + '\n\n' : ''}Original text:\n${text}`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  const data = await r.json()
  if (!r.ok) return res.status(500).json({ error: data.error?.message || 'API error' })

  const raw = data.content?.[0]?.text?.trim() || ''
  try {
    const parsed = JSON.parse(raw)
    return res.json(parsed)
  } catch {
    // If JSON parse fails, return the raw text as editorial fallback
    return res.json({ editorial: raw, h1: '', titleTag: '', metaDescription: '', keywords: [] })
  }
}
