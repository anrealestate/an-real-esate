const PROMPT = (name, docType) => `Analyse this identity document image.
Submitted name: "${name}"
Document type declared: "${docType || 'unspecified'}"

Respond ONLY with valid JSON (no markdown):
{
  "isIdDocument": true,
  "docType": "DNI",
  "nameOnDoc": "GARCÍA LÓPEZ, ANTONIO",
  "nameMatch": true,
  "confidence": "high",
  "message": "Documento reconocido como DNI. El nombre coincide con el formulario."
}

Rules:
- isIdDocument: true only if the image clearly shows a real ID (DNI, NIE, passport, driver licence)
- nameOnDoc: full name exactly as printed; null if unreadable
- nameMatch: compare nameOnDoc with submitted name (ignore case/accents); null if nameOnDoc is null
- message: one short sentence in Spanish`

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const { imageBase64, name, docType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ error: 'No image' })
  if (!name)        return res.status(400).json({ error: 'No name' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' })

  const match = imageBase64.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  if (!match) return res.status(400).json({ error: 'Invalid image format' })
  const mimeType = match[1]
  const b64data  = match[2]

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: b64data } },
          { text: PROMPT(name, docType) }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json', max_output_tokens: 256 }
    })
  })

  const data = await r.json()
  if (!r.ok) return res.status(500).json({ error: data.error?.message || 'Gemini API error' })

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  try {
    return res.json(JSON.parse(raw))
  } catch {
    return res.status(500).json({ error: 'Could not parse AI response', raw })
  }
}
