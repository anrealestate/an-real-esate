const ALLOWED_ORIGINS = ['https://anrealestate.es', 'https://www.anrealestate.es']

function isValidEmail(email) {
  return typeof email === 'string' && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email) && !email.includes('\n') && !email.includes('\r')
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { RESEND_API_KEY } = process.env
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'Email service not configured' })

  const { clientEmail, clientName, propRef, propTitle, visitDate, clientPdfBase64, agentPdfBase64 } = req.body || {}

  if (clientEmail && !isValidEmail(clientEmail)) return res.status(400).json({ error: 'Invalid email address' })

  const MAX_PDF_B64 = 8 * 1024 * 1024 // 8 MB base64 ≈ 6 MB PDF
  if (clientPdfBase64 && clientPdfBase64.length > MAX_PDF_B64) return res.status(413).json({ error: 'PDF too large' })
  if (agentPdfBase64 && agentPdfBase64.length > MAX_PDF_B64) return res.status(413).json({ error: 'PDF too large' })

  const send = async (payload) => {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await r.json().catch(() => ({}))
    const msg =
      (data && (data.message || data.error || data.name)) ||
      (Array.isArray(data?.errors) && data.errors.map((e) => e.message).filter(Boolean).join('; ')) ||
      ''
    return { ok: r.ok, status: r.status, data, message: msg || undefined }
  }

  const results = []
  const safeRef = (propRef || 'visita').replace(/[^A-Z0-9_-]/gi, '_')

  if (clientEmail && clientPdfBase64) {
    const r = await send({
      from: 'AN High End Real Estate <alvaro@anrealestate.es>',
      to: [clientEmail],
      subject: `Hoja de visita firmada — ${propRef || 'Propiedad'}`,
      html: `<p>Estimado/a ${clientName || 'visitante'},</p>
<p>Adjunto encontrará su hoja de visita firmada electrónicamente con AN High End Real Estate.</p>
<p>Conserve este documento como comprobante oficial de su visita${propTitle ? ' a ' + propTitle : ''}.</p>
<br>
<p style="color:#888;font-size:12px">D. Álvaro Navarro Mosca · Agente inmobiliario autónomo · AICAT 13069<br>
<a href="mailto:alvaro@anrealestate.es">alvaro@anrealestate.es</a> · anrealestate.es</p>`,
      attachments: [{ filename: `HojaVisita_${safeRef}.pdf`, content: clientPdfBase64 }]
    })
    results.push({
      type: 'client',
      ok: r.ok,
      status: r.status,
      ...(r.message && { error: r.message }),
      ...(r.data && !r.ok && Object.keys(r.data).length && { resend: r.data }),
    })
  }

  if (agentPdfBase64) {
    const r = await send({
      from: 'AN High End Real Estate <alvaro@anrealestate.es>',
      to: ['alvaro@anrealestate.es'],
      reply_to: clientEmail || undefined,
      subject: `[Agente] Nueva visita — ${propRef || 'Propiedad'} — ${clientName || ''}`,
      html: `<p>Nueva hoja de visita firmada.</p>
<p><strong>Propiedad:</strong> ${propRef || '—'} · ${propTitle || ''}</p>
<p><strong>Visitante:</strong> ${clientName || '—'}</p>
<p><strong>Fecha:</strong> ${visitDate || '—'}</p>
<p>Adjunto encontrará el documento completo del agente con dirección y datos de verificación.</p>`,
      attachments: [{ filename: `HojaVisita_AGENTE_${safeRef}.pdf`, content: agentPdfBase64 }]
    })
    results.push({
      type: 'agent',
      ok: r.ok,
      status: r.status,
      ...(r.message && { error: r.message }),
      ...(r.data && !r.ok && Object.keys(r.data).length && { resend: r.data }),
    })
  }

  const allOk = results.length > 0 && results.every((x) => x.ok)
  return res.status(allOk ? 200 : 502).json({ ok: allOk, results })
}
