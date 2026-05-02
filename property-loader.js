/* ================================
   property-loader.js
   Reads ?slug= from URL and populates
   property.html dynamically from JSON
   ================================ */
;(async function () {
  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
  }

  function cloudinarySrcset(url) {
    if (!url || !url.includes('res.cloudinary.com')) return ''
    return [640, 1024, 1440, 1920].map(w => `${url.replace(/\bw_\d+/, `w_${w}`)} ${w}w`).join(', ')
  }

  function formatPrice(raw) {
    if (!raw) return raw
    const s = String(raw)
    // Already has thousands separators (e.g. "$419,900", "€830,000") → return as-is
    if (/\d[,.]\d{3}/.test(s)) return s
    const n = parseFloat(s.replace(/[^0-9.]/g, ''))
    if (isNaN(n)) return s
    // Insert thousands separators, keeping the original currency symbol and any prefix text (e.g. "From")
    return s.replace(/\d[\d.]*/, n.toLocaleString('en-US', { maximumFractionDigits: 0 }))
  }

  /* Allowlist of domains permitted as virtualTourUrl src (Matterport, Kuula, etc.).
     'javascript:' and other unsafe schemes are rejected by the https-only check. */
  const TOUR_ALLOWED_HOSTS = [
    'my.matterport.com', 'matterport.com',
    'kuula.co', 'roundme.com',
    'cloudpano.com', 'app.cloudpano.com',
    '3dvista.com', 'spinview.tv',
    'res.cloudinary.com',
  ]
  function sanitizeVirtualTourUrl(raw) {
    if (!raw || typeof raw !== 'string') return ''
    try {
      const u = new URL(raw.trim())
      if (u.protocol !== 'https:') return ''
      const host = u.hostname.toLowerCase()
      if (TOUR_ALLOWED_HOSTS.some(a => host === a || host.endsWith('.' + a))) return u.href
    } catch (_) {}
    return ''
  }

  function extractYoutubeVideoId(input) {
    if (!input || typeof input !== 'string') return null
    const s = input.trim()
    if (!s) return null
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s)
      const host = u.hostname.replace(/^www\./, '')
      if (host === 'youtu.be') {
        const id = u.pathname.replace(/^\//, '').split('/')[0]
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
      }
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
        if (u.pathname.startsWith('/embed/')) {
          const id = u.pathname.slice('/embed/'.length).split('/')[0].split('?')[0]
          return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
        }
        if (u.pathname.startsWith('/shorts/')) {
          const id = u.pathname.slice('/shorts/'.length).split('/')[0].split('?')[0]
          return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
        }
        const v = u.searchParams.get('v')
        return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null
      }
    } catch (_) {}
    return null
  }

  /** Canonical house-of-wellness en JSON; compat typo antigua house-of-wellnes en URL/caché */
  function listingsSlugFromUrl(urlSlug) {
    const s = String(urlSlug || '').trim()
    if (!s) return ''
    if (s === 'house-of-wellnes') return 'house-of-wellness'
    const m = /^house-of-wellnes-u-(.+)$/.exec(s)
    if (m) return 'house-of-wellness-u-' + m[1]
    return s
  }

  function publicSlugFromJson(jsonSlug) {
    const s = String(jsonSlug || '').trim()
    if (s === 'house-of-wellnes') return 'house-of-wellness'
    const m = /^house-of-wellnes-u-(.+)$/.exec(s)
    if (m) return 'house-of-wellness-u-' + m[1]
    return s
  }

  /** URL absoluta para planos (JSON puede usar /docs/... relativo al site). */
  function resolveFloorplanAssetUrl(src) {
    if (!src) return ''
    try {
      return new URL(src, window.location.href).href
    } catch (_) {
      return String(src)
    }
  }

  let _pdfJsPromise = null
  function loadPdfJs() {
    if (typeof window.pdfjsLib !== 'undefined' && window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
    if (_pdfJsPromise) return _pdfJsPromise
    _pdfJsPromise = new Promise((resolve, reject) => {
      const ver = '3.11.174'
      const base = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${ver}/legacy/build/`
      const s = document.createElement('script')
      s.src = base + 'pdf.min.js'
      s.async = true
      s.onload = () => {
        const lib = window.pdfjsLib
        if (!lib) {
          reject(new Error('pdfjsLib'))
          return
        }
        lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'
        resolve(lib)
      }
      s.onerror = () => reject(new Error('pdf.js'))
      document.head.appendChild(s)
    })
    return _pdfJsPromise
  }

  async function renderPdfFirstPage(canvas, pdfUrl, maxW, maxH) {
    const pdfjsLib = await loadPdfJs()
    const task = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false })
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const baseVp = page.getViewport({ scale: 1 })
    const scale = Math.min(maxW / baseVp.width, maxH / baseVp.height)
    const viewport = page.getViewport({ scale: Math.max(scale, 0.08) })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr))
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr))
    canvas.style.width = Math.floor(viewport.width) + 'px'
    canvas.style.height = Math.floor(viewport.height) + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    await page.render({ canvasContext: ctx, viewport }).promise
  }

  const urlSlug = new URLSearchParams(location.search).get('slug')
  const lookupSlug = urlSlug != null && String(urlSlug).trim() !== ''
    ? listingsSlugFromUrl(urlSlug)
    : 'gracia-garden'

  function revealPropertyShell() {
    document.documentElement.classList.remove('property-shell-pending')
  }

  function readInlineListings() {
    const el = document.getElementById('listings-data')
    if (!el) return []
    try {
      const parsed = JSON.parse(el.textContent)
      return Array.isArray(parsed.listings) ? parsed.listings : []
    } catch {
      return []
    }
  }

  /**
   * fetch(listings.json) puede estar cacheado / desactualizado en CDN-FTP mientras
   * data-listings.js ya inyectó #listings-data con floorPlans. Si solo usamos fetch,
   * las fichas pierden planos aunque el bundle sea correcto.
   */
  function mergeFetchWithInline(fromFetch, fromInline) {
    if (!fromFetch.length) return fromInline
    if (!fromInline.length) return fromFetch
    const inlineBySlug = Object.fromEntries(fromInline.map(l => [l.slug, l]))
    const merged = fromFetch.map(srv => {
      const inl = inlineBySlug[srv.slug]
      if (!inl) return srv
      if (!srv.floorPlans?.length && inl.floorPlans?.length)
        return { ...srv, floorPlans: inl.floorPlans }
      return srv
    })
    const fetchSlugs = new Set(fromFetch.map(l => l.slug))
    const extras = fromInline.filter(l => !fetchSlugs.has(l.slug))
    return extras.length ? merged.concat(extras) : merged
  }

  async function loadListings() {
    let fromFetch = []
    try {
      const listingsUrl = new URL('data/listings.json', window.location.href).href
      const r = await fetch(listingsUrl, { cache: 'no-store', credentials: 'same-origin' })
      if (r.ok) {
        const j = await r.json()
        if (Array.isArray(j.listings) && j.listings.length) fromFetch = j.listings
      }
    } catch (_) {}
    const fromInline = readInlineListings()
    if (fromFetch.length) return mergeFetchWithInline(fromFetch, fromInline)
    return fromInline
  }

  let listings = await loadListings()
  if (!listings.length) {
    revealPropertyShell()
    return
  }

  /* Merge admin cache: servidor (JSON / bundle) gana; floorPlans siempre del servidor si vienen */
  try {
    const cached = JSON.parse(localStorage.getItem('an_listings_cache') || '{}').listings || []
    if (cached.length && listings.length) {
      const serverBySlug = Object.fromEntries(listings.map(l => [l.slug, l]))
      listings = listings.map(srv => {
        const c = cached.find(x => x.slug === srv.slug)
        if (!c) return srv
        const merged = { ...c, ...srv }
        if (Array.isArray(srv.floorPlans) && srv.floorPlans.length) merged.floorPlans = srv.floorPlans
        return merged
      })
      cached.forEach(c => {
        if (!serverBySlug[c.slug]) listings.push(c)
      })
    }
  } catch {}

  const baseListing = listings.find(l => l.slug === lookupSlug)
  if (!baseListing) {
    revealPropertyShell()
    return
  }

  /* Promociones (obra nueva) usan development.html — slug público alineado con vercel */
  if (baseListing.propertyType === 'development') {
    const params = new URLSearchParams(location.search)
    params.set('slug', publicSlugFromJson(baseListing.slug))
    location.replace(`development.html?${params.toString()}`)
    return
  }

  // True when this unit belongs to a new-development promotion (parent_slug → development listing).
  // Only these units get a section reorder; standalone / resale properties keep the default HTML order.
  const isNewDevUnit = !!(
    baseListing.parent_slug &&
    listings.some(p => p.slug === baseListing.parent_slug && p.propertyType === 'development')
  )

  function reorderPropertyMainForNewDevUnit() {
    if (!isNewDevUnit) return
    const mainEl = document.querySelector('main.prop-main')
    if (!mainEl || mainEl.dataset.orderApplied === 'new-dev') return

    const descSec  = document.getElementById('prop-description')?.closest('section')
    const fpSec    = document.getElementById('ph-floorplans-section')
    const detSec   = document.getElementById('prop-details')?.closest('section')
    const featSec  = document.getElementById('prop-features-section')
    const vidSec   = document.getElementById('prop-video-section')
    const tourSec  = document.getElementById('prop-tour-section')
    const nearSec  = document.getElementById('prop-nearby-section')

    /* Obra nueva: Details → Floor plans → Description → Features → Video → Tour 360° → Location */
    for (const sec of [detSec, fpSec, descSec, featSec, vidSec, tourSec, nearSec]) {
      if (sec && sec.parentElement === mainEl) mainEl.appendChild(sec)
    }
    mainEl.dataset.orderApplied = 'new-dev'
  }

  function getTranslatedListing(lang) {
    if (lang && baseListing.translations?.[lang]) {
      const tr = baseListing.translations[lang]
      const merged = Object.assign({}, baseListing)
      if (tr.title)       merged.title       = tr.title
      if (tr.description) merged.description = tr.description
      if (tr.features)    merged.features    = tr.features
      if (tr.details)     merged.details     = tr.details
      if (tr.nearby)      merged.nearby      = tr.nearby
      return merged
    }
    return baseListing
  }

  function renderContent(listing) {
    const lang = (typeof getLang === 'function') ? getLang() : (localStorage.getItem('an_lang') || 'en')
    const forSale  = window.I18N?.[lang]?.['prop.for_sale']  || (lang === 'es' ? 'En Venta'    : lang === 'fr' ? 'À Vendre'     : lang === 'de' ? 'Zu Verkaufen' : lang === 'it' ? 'In Vendita' : lang === 'ca' ? 'En Venda'  : lang === 'ru' ? 'Продаётся' : 'For Sale')
    const forRent  = window.I18N?.[lang]?.['prop.for_rent']  || (lang === 'es' ? 'En Alquiler' : lang === 'fr' ? 'À Louer'      : lang === 'de' ? 'Zu Vermieten': lang === 'it' ? 'In Affitto' : lang === 'ca' ? 'En Lloguer': lang === 'ru' ? 'В аренду'  : 'For Rent')
    const isRent = listing.type === 'rent' || listing.status === 'rent'
    const priceLabel = isRent ? listing.price + '/mo' : listing.price

    /* ── <title> & meta ── */
    document.title = `${listing.title} — ${priceLabel} — AN Real Estate`
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.content = (listing.description || [])[0] || ''

    /* ── OG / Twitter image + canonical ── */
    const rawFirst = (baseListing.images || []).find(i => !(typeof i === 'object' ? i.hidden : false))
    const ogImg = typeof rawFirst === 'string' ? rawFirst : (rawFirst?.src || listing.image || '')
    const pageUrl = `https://anrealestate.es/property.html?slug=${publicSlugFromJson(listing.slug)}`
    const ogTitle = `${listing.title} — ${priceLabel} — AN Real Estate`
    const ogDesc  = (listing.description || [])[0] || ''
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', ogImg)
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', ogImg)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', ogTitle)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', ogTitle)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', ogDesc)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', ogDesc)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', pageUrl)
    let canonEl = document.querySelector('link[rel="canonical"]')
    if (!canonEl) { canonEl = document.createElement('link'); canonEl.rel = 'canonical'; document.head.appendChild(canonEl) }
    canonEl.href = pageUrl

    /* ── JSON-LD structured data ── */
    const jsonLdEl = document.getElementById('property-jsonld')
    if (jsonLdEl) {
      const priceCurrency = /^\$/.test(String(listing.price || '')) ? 'USD' : 'EUR'
      const priceNum = String(listing.price || '').replace(/[^0-9]/g, '')
      jsonLdEl.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        'name': listing.title,
        'description': ogDesc,
        'url': pageUrl,
        'image': ogImg,
        'offers': {
          '@type': 'Offer',
          'price': priceNum,
          'priceCurrency': priceCurrency,
          'availability': 'https://schema.org/InStock'
        },
        'numberOfRooms': listing.beds,
        'floorSize': { '@type': 'QuantitativeValue', 'value': listing.size, 'unitCode': 'MTK' },
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': listing.city || 'Barcelona',
          'addressRegion': 'Catalunya',
          'addressCountry': 'ES'
        }
      })
    }

    /* ── breadcrumb ── */
    const bcLast = document.querySelector('.prop-breadcrumb [aria-current]')
    if (bcLast) bcLast.textContent = listing.title
    if (listing.parent_slug) {
      const parent = listings.find(l => l.slug === listing.parent_slug)
      if (parent) {
        const bcHolder = document.querySelector('.prop-breadcrumb .holder')
        if (bcHolder) {
          const regionSpan = Array.from(bcHolder.querySelectorAll('span'))
            .find(s => !s.hasAttribute('aria-current') && s.textContent.trim() !== '›')
          if (regionSpan) {
            const link = document.createElement('a')
            link.href = `development.html?slug=${esc(publicSlugFromJson(parent.slug))}`
            link.textContent = parent.title
            regionSpan.replaceWith(link)
          }
        }
      }
    }

    /* ── badges ── */
    const badgeType = document.querySelector('.ph-badge--type')
    if (badgeType) badgeType.textContent = listing.badge_type || listing.propertyType || listing.type
    const badgeSale = document.querySelector('.ph-badge--sale, .ph-badge--rent')
    if (badgeSale) {
      badgeSale.textContent = isRent ? forRent : forSale
      badgeSale.className   = `ph-badge ph-badge--${isRent ? 'rent' : 'sale'}`
    }

    /* ── title & location ── */
    const titleEl = document.getElementById('ph-title')
    if (titleEl) titleEl.textContent = listing.title

    const locEl = document.getElementById('ph-location')
    if (locEl) {
      const svg = locEl.querySelector('svg')
      locEl.innerHTML = (svg ? svg.outerHTML : '') + ' ' + esc(listing.neighbourhood) + ', Spain'
    }

    /* ── price bar ── */
    const displayPrice = formatPrice(listing.price)
    const priceEl = document.getElementById('ph-price')
    if (priceEl) {
      priceEl.innerHTML = isRent
        ? `${esc(displayPrice)}<small>/mo</small>`
        : esc(displayPrice)
    }
    const refEl = document.getElementById('ph-ref')
    if (refEl) refEl.textContent = `Ref. ${listing.ref}`

    /* ── sidebar contact panel ── */
    const pcPrice = document.querySelector('.pc-price')
    if (pcPrice) pcPrice.innerHTML = isRent ? `${esc(displayPrice)}<small>/mo</small>` : esc(displayPrice)
    const pcLoc = document.querySelector('.pc-loc')
    if (pcLoc) pcLoc.textContent = listing.neighbourhood || listing.city || ''

    /* ── specs ── */
    const FMT = window.AN_FMT || {}
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val }
    const areaParts = FMT.formatAreaParts ? FMT.formatAreaParts(listing) : null
    const interiorStr = areaParts?.interior || (listing.size ? (listing.sizeUnit === 'sqft' ? listing.size + ' sq ft' : listing.size + ' m²') : '—')
    const exteriorStr = areaParts?.exterior || null

    /* Label: show 'Interior' when exterior also exists, else keep existing i18n 'Built area' */
    const specSizeEl = document.getElementById('spec-size')
    const specSizeKey = document.querySelector('#spec-size ~ .ph-spec-key, [data-i18n="spec.built_area"]')
    if (specSizeEl) specSizeEl.textContent = interiorStr
    if (specSizeKey && exteriorStr) specSizeKey.setAttribute('data-i18n', 'area.interior')

    /* Exterior spec — inject dynamically when data present */
    const specExteriorEl = document.getElementById('spec-exterior')
    if (exteriorStr) {
      if (specExteriorEl) {
        specExteriorEl.style.display = ''
        const valEl = specExteriorEl.querySelector('.ph-spec-val')
        if (valEl) valEl.textContent = exteriorStr
      } else {
        /* Build and insert after spec-size's parent .ph-spec */
        const sizeSpec = specSizeEl?.closest('.ph-spec')
        if (sizeSpec) {
          const ext = document.createElement('div')
          ext.id = 'spec-exterior'
          ext.className = 'ph-spec'
          ext.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><div class="ph-spec-text"><span class="ph-spec-val" id="spec-ext-val">${esc(exteriorStr)}</span><span class="ph-spec-key" data-i18n="area.exterior">Exterior</span></div>`
          sizeSpec.after(ext)
        }
      }
    } else if (specExteriorEl) {
      specExteriorEl.style.display = 'none'
    }

    set('spec-beds',  listing.beds)
    set('spec-baths', listing.baths)
    set('spec-floor', listing.floor || '—')

    /* hide extra Gràcia-specific specs if not needed */
    document.querySelectorAll('.ph-spec--extra').forEach(s => {
      s.style.display = listing.slug === 'gracia-garden' ? '' : 'none'
    })

    /* ── description ── */
    const descEl = document.getElementById('prop-description')
    if (descEl && listing.description) {
      const paras = Array.isArray(listing.description) ? listing.description : [listing.description]
      descEl.innerHTML = paras.map(p => `<p>${esc(p)}</p>`).join('')
    }

    /* ── YouTube (nocookie + modest UI params) ── */
    const vidSec = document.getElementById('prop-video-section')
    const vidFrame = document.getElementById('prop-video-iframe')
    if (vidSec && vidFrame) {
      const yid = extractYoutubeVideoId(listing.youtubeUrl || listing.videoYoutubeUrl || '')
      if (yid) {
        vidSec.hidden = false
        vidFrame.src =
          'https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(yid) +
          '?rel=0&modestbranding=1&playsinline=1'
      } else {
        vidSec.hidden = true
        vidFrame.src = ''
        vidFrame.removeAttribute('src')
      }
    }

    /* ── Virtual Tour 360° (allowlisted embed URL) ── */
    const tourSec = document.getElementById('prop-tour-section')
    const tourFrame = document.getElementById('prop-tour-iframe')
    if (tourSec && tourFrame) {
      const tourUrl = sanitizeVirtualTourUrl(listing.virtualTourUrl || '')
      if (tourUrl) {
        tourSec.hidden = false
        tourFrame.src = tourUrl
      } else {
        tourSec.hidden = true
        tourFrame.removeAttribute('src')
      }
    }

    /* ── property details table ── */
    const detailsEl = document.getElementById('prop-details')
    if (detailsEl && listing.details) {
      detailsEl.innerHTML = listing.details.map(d =>
        `<div class="pd-row"><span class="pd-key">${esc(d.key)}</span><span class="pd-val">${esc(d.val)}</span></div>`
      ).join('')
    }

    /* ── features ── */
    const featSec = document.getElementById('prop-features-section')
    const featEl  = document.getElementById('prop-features')
    if (featSec && featEl) {
      if (listing.features) {
        featEl.innerHTML = Object.entries(listing.features).map(([cat, items]) => `
          <div class="prop-tags-group">
            <p class="feat-group">${esc(cat)}</p>
            <div class="prop-tags">${items.map(f => `<span class="prop-tag-pill">${esc(f)}</span>`).join('')}</div>
          </div>`).join('')
        featSec.style.display = ''
      } else {
        featSec.style.display = 'none'
      }
    }

    /* ── floor plans (ejemplo opción B: hero + strip, armonizado con galería / secciones) ── */
    const fpSec  = document.getElementById('ph-floorplans-section')
    const fpRoot = document.getElementById('ph-floorplans-root')
    const FP_PDF_ICON = '<svg class="fp-pdf-icon" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    const fpDlSvg = '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'

    function fpIsPdf(fp) {
      return /\.pdf(\?|$)/i.test(fp.src || '')
    }
    function fpThumbUrl(fp) {
      const raw = fp.thumb || fp.preview
      if (raw && String(raw).trim()) return String(raw).trim()
      if (!fpIsPdf(fp) && fp.src) return String(fp.src).trim()
      return ''
    }

    if (fpSec && fpRoot && listing.floorPlans?.length) {
      const plans = listing.floorPlans

      fpRoot.innerHTML = `
        <figure class="fp-hero-stage">
          <a class="fp-hero-hit" id="ph-fp-hero-link" href="#" target="_blank" rel="noopener">
            <div class="fp-hero-visual" id="ph-fp-hero-visual"></div>
          </a>
          <figcaption class="fp-hero-caption">
            <span class="fp-hero-label" id="ph-fp-hero-label"></span>
            <span class="fp-hero-badge" id="ph-fp-hero-badge" hidden>PDF</span>
          </figcaption>
        </figure>
        <div class="fp-strip-wrap" id="ph-fp-strip-wrap">
          <div class="fp-strip" id="ph-fp-strip" role="tablist" aria-label="Floor plans"></div>
        </div>
        <div class="fp-hero-actions">
          <a href="#" class="fp-download" id="ph-fp-open-tab" target="_blank" rel="noopener">${fpDlSvg}<span id="ph-fp-open-label"></span></a>
        </div>`

      const heroVisual = document.getElementById('ph-fp-hero-visual')
      const heroLink = document.getElementById('ph-fp-hero-link')
      const heroLabel = document.getElementById('ph-fp-hero-label')
      const heroBadge = document.getElementById('ph-fp-hero-badge')
      const stripWrap = document.getElementById('ph-fp-strip-wrap')
      const stripEl = document.getElementById('ph-fp-strip')
      const openTab = document.getElementById('ph-fp-open-tab')
      const openLbl = document.getElementById('ph-fp-open-label')

      let fpPdfGen = 0

      function setHeroVisual(fp) {
        const myGen = ++fpPdfGen
        const thumb = fpThumbUrl(fp)
        const isPdf = fpIsPdf(fp)
        const pdfAbs = isPdf ? resolveFloorplanAssetUrl(fp.src) : ''

        if (thumb) {
          heroVisual.innerHTML = `<div class="fp-hero-visual-inner"><img src="${esc(thumb)}" alt="${esc(fp.label || 'Floor plan')}" loading="lazy" /></div>`
          return
        }

        if (isPdf && pdfAbs) {
          heroVisual.innerHTML = `<div class="fp-hero-visual-inner"><div class="fp-pdf-render"><p class="fp-pdf-loading">Loading preview…</p><canvas class="fp-pdf-canvas" aria-label="${esc(fp.label || 'Floor plan preview')}"></canvas></div></div>`
          const paintPdf = () => {
            if (myGen !== fpPdfGen) return
            const inner = heroVisual.querySelector('.fp-hero-visual-inner')
            const canvas = heroVisual.querySelector('.fp-pdf-canvas')
            const loading = heroVisual.querySelector('.fp-pdf-loading')
            if (!inner || !canvas) return
            const r = inner.getBoundingClientRect()
            const maxW = Math.max(80, r.width)
            const maxH = Math.max(80, r.height)
            renderPdfFirstPage(canvas, pdfAbs, maxW, maxH)
              .then(() => {
                if (myGen !== fpPdfGen || !loading) return
                loading.remove()
              })
              .catch(() => {
                if (myGen !== fpPdfGen) return
                heroVisual.innerHTML = `<div class="fp-hero-visual-inner"><div class="fp-hero-placeholder">${FP_PDF_ICON}<p class="fp-hero-placeholder-note">Preview unavailable — open the PDF</p></div></div>`
              })
          }
          requestAnimationFrame(() => requestAnimationFrame(paintPdf))
          return
        }

        heroVisual.innerHTML = `<div class="fp-hero-visual-inner"><div class="fp-hero-placeholder">${FP_PDF_ICON}</div></div>`
      }

      function setActive(i) {
        const fp = plans[i]
        if (!fp) return
        const isPdf = fpIsPdf(fp)
        const absOpen = resolveFloorplanAssetUrl(fp.src)
        const hrefOpen = fp.src ? absOpen : '#'
        setHeroVisual(fp)
        heroLabel.textContent = fp.label || (isPdf ? 'Floor plan' : 'Plan')
        heroBadge.hidden = !isPdf
        heroLink.href = hrefOpen
        openTab.href = hrefOpen
        openLbl.textContent = isPdf ? 'PDF' : 'Ver'
        stripEl.querySelectorAll('.fp-strip-item').forEach((btn, j) => {
          const on = j === i
          btn.classList.toggle('is-active', on)
          btn.setAttribute('aria-selected', on ? 'true' : 'false')
          btn.tabIndex = on ? 0 : -1
        })
      }

      stripEl.innerHTML = plans.map((fp, i) => {
        const thumb = fpThumbUrl(fp)
        let inner
        if (thumb) {
          inner = `<span class="fp-strip-thumb"><span class="fp-strip-inner"><img src="${esc(thumb)}" alt="" loading="lazy" /></span></span>`
        } else if (fpIsPdf(fp) && fp.src) {
          inner = `<span class="fp-strip-thumb"><span class="fp-strip-inner fp-strip-inner--pdf"><span class="fp-pdf-loading fp-pdf-loading--strip" aria-hidden="true">…</span><canvas class="fp-strip-canvas" aria-hidden="true"></canvas></span></span>`
        } else {
          inner = `<span class="fp-strip-thumb fp-strip-fallback">${FP_PDF_ICON}</span>`
        }
        const tabLabel = fp.label || `Plan ${i + 1}`
        return `<button type="button" class="fp-strip-item" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" data-fp-i="${i}" aria-label="${esc(tabLabel)}">${inner}</button>`
      }).join('')

      stripWrap.hidden = plans.length <= 1

      stripEl.addEventListener('click', e => {
        const btn = e.target.closest('.fp-strip-item')
        if (!btn || btn.disabled) return
        setActive(parseInt(btn.dataset.fpI, 10))
      })

      stripEl.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        const items = [...stripEl.querySelectorAll('.fp-strip-item')]
        const cur = items.findIndex(b => b.classList.contains('is-active'))
        if (cur < 0) return
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        const next = Math.max(0, Math.min(items.length - 1, cur + dir))
        items[next].focus()
        setActive(next)
      })

      setActive(0)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          plans.forEach((fp, i) => {
            if (fpThumbUrl(fp) || !fpIsPdf(fp) || !fp.src) return
            const btn = stripEl.querySelector(`button[data-fp-i="${i}"]`)
            const canvas = btn && btn.querySelector('.fp-strip-canvas')
            const loading = btn && btn.querySelector('.fp-pdf-loading--strip')
            if (!canvas) return
            const url = resolveFloorplanAssetUrl(fp.src)
            renderPdfFirstPage(canvas, url, 76, 58)
              .then(() => { if (loading) loading.remove() })
              .catch(() => { if (loading) loading.remove() })
          })
        })
      })

      fpSec.removeAttribute('hidden')
      fpSec.hidden = false
    } else if (fpSec) {
      fpSec.hidden = true
      if (fpRoot) fpRoot.innerHTML = ''
    }

    /* ── nearby ── */
    const nearSec = document.getElementById('prop-nearby-section')
    const nearEl  = document.getElementById('prop-nearby')
    if (nearSec && nearEl) {
      nearSec.style.display = '' // always show — section contains the map
      if (listing.nearby) {
        nearEl.innerHTML = listing.nearby.map(n => `
          <div class="nearby-item">
            <span class="nearby-icon"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></span>
            <span class="nearby-name">${esc(n.name)}</span>
            <span class="nearby-dist">${esc(n.dist)}</span>
          </div>`).join('')
      } else {
        nearEl.style.display = 'none'
      }
    }

    /* ── form hidden field ── */
    const propInput = document.querySelector('[name="property"]')
    if (propInput) propInput.value = `${listing.title} — ${priceLabel} — ${listing.neighbourhood}`

    /* ── mobile sticky CTA ── */
    const stickyPrice = document.querySelector('.psc-price')
    if (stickyPrice) stickyPrice.textContent = isRent ? `${displayPrice}/mo` : displayPrice

    // Reorder sections for new-dev units before the shell is revealed (idempotent)
    reorderPropertyMainForNewDevUnit()

  }

  /* ── gallery (runs once) ── */
  const rawImgs = baseListing.images || []
  const imgs = rawImgs
    .map(img => typeof img === 'string' ? { src: img, alt: baseListing.title } : img)
    .filter(img => !img.hidden)
  if (imgs.length) {
    const hero    = document.querySelector('.pg-hero')
    const heroImg = document.getElementById('pg-hero-img')
    if (hero && heroImg) {
      hero.dataset.src  = imgs[0].src
      heroImg.src       = imgs[0].src
      heroImg.alt       = imgs[0].alt || baseListing.title
      const hSrcset = cloudinarySrcset(imgs[0].src)
      if (hSrcset) { heroImg.srcset = hSrcset; heroImg.sizes = '100vw' }
    }
    document.querySelectorAll('.pg-cell').forEach((cell, i) => {
      const img = imgs[i + 1]
      if (img) {
        cell.dataset.src = img.src
        const ci = cell.querySelector('img')
        if (ci) { ci.src = img.src; ci.alt = img.alt || baseListing.title }
        cell.style.display = ''
      } else {
        cell.style.display = 'none'
      }
    })

    const moreText = document.querySelector('.pg-more-overlay')
    if (moreText) {
      moreText.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent = n.textContent.replace(/\d+ photos/, `${imgs.length} photos`)
      })
    }
    const lbCounter = document.getElementById('lb-counter')
    if (lbCounter) lbCounter.textContent = `1 / ${imgs.length}`
  }

  /* Expose full image array so lightbox uses all photos, not just DOM cells */
  window.__propertyGalleryImages = imgs
  /* Signal property.js that gallery DOM is ready (resolves lightbox race condition) */
  window._galleryReady = true
  document.dispatchEvent(new CustomEvent('gallery:ready', { detail: { images: imgs } }))

  /* ── Map ── */
  const COORDS = {
    'gracia-garden':               { lat: 41.4025, lng: 2.1535 },
    'eixample-golden-square-rent': { lat: 41.3916, lng: 2.1649 },
    'sant-gervasi-galvany':        { lat: 41.3975, lng: 2.1548 },
    'el-born-corner':              { lat: 41.3844, lng: 2.1818 },
    'rambla-catalunya-corner':     { lat: 41.3920, lng: 2.1649 },
    'eixample-golden-mile':        { lat: 41.3953, lng: 2.1696 },
    'vallvidrera-villa':           { lat: 41.4208, lng: 2.0865 },
    'eixample-villarroel':         { lat: 41.3875, lng: 2.1528 },
    'villa-cascades':              { lat: 41.4328796, lng: 2.0927754 },
    'house-of-wellness':           { lat: 41.3851, lng: 2.1734 },
  }
  const MAP_STYLE = [
    { elementType: 'geometry',            stylers: [{ color: '#18180f' }] },
    { elementType: 'labels.text.fill',    stylers: [{ color: '#9a8f7a' }] },
    { elementType: 'labels.text.stroke',  stylers: [{ color: '#18180f' }] },
    { featureType: 'road',               elementType: 'geometry',       stylers: [{ color: '#252519' }] },
    { featureType: 'road.arterial',      elementType: 'geometry',       stylers: [{ color: '#2b2b1e' }] },
    { featureType: 'road.highway',       elementType: 'geometry',       stylers: [{ color: '#323224' }] },
    { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#7a7060' }] },
    { featureType: 'water',              elementType: 'geometry',       stylers: [{ color: '#0b0e12' }] },
    { featureType: 'landscape',          elementType: 'geometry',       stylers: [{ color: '#1a1a12' }] },
    { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative',     elementType: 'geometry.stroke', stylers: [{ color: '#2e2e22' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c8b99a' }] },
  ]

  function renderOsmMap(coord) {
    const mapEl = document.getElementById('prop-map')
    if (!mapEl) return
    const { lat, lng } = coord
    const d = 0.008
    const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
    mapEl.innerHTML = `<iframe
      src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}"
      style="width:100%;height:100%;border:none;filter:invert(1) hue-rotate(200deg) saturate(.6) brightness(.85)"
      loading="lazy"
    ></iframe>`
  }

  function renderMap(coord) {
    const mapEl = document.getElementById('prop-map')
    if (!mapEl) return
    window._propMapCoord = coord  // store for gm_authFailure fallback
    const map = new google.maps.Map(mapEl, {
      center: coord,
      zoom: 15,
      styles: MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
      backgroundColor: '#18180f',
    })
    new google.maps.Marker({
      position: coord,
      map,
      icon: {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: '#c8a96e',
        fillOpacity: 1,
        strokeColor: '#18180f',
        strokeWeight: 1,
        scale: 2,
        anchor: new google.maps.Point(12, 22),
      }
    })
  }

  // Fallback to OSM when Google Maps API key is rejected for this domain
  window.gm_authFailure = function () {
    const coord = window._propMapCoord
    if (coord) renderOsmMap(coord)
  }

  function initPropertyMap() {
    const mapEl = document.getElementById('prop-map')
    if (!mapEl) return

    // 1. Coords from listing JSON
    if (baseListing.lat && baseListing.lng) {
      renderMap({ lat: parseFloat(baseListing.lat), lng: parseFloat(baseListing.lng) })
      return
    }
    // 2. Hardcoded fallback coords — strip unit suffix for child unit pages
    const coord = COORDS[lookupSlug] || COORDS[lookupSlug.replace(/-u-[^/]*$/, '')]
    if (coord) {
      renderMap(coord)
      return
    }
    // 3. Geocode from address
    const address = baseListing.address || baseListing.neighbourhood || baseListing.city
    if (!address) return
    new google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location
        renderMap({ lat: loc.lat(), lng: loc.lng() })
      }
    })
  }

  var _mapAttempts = 0
  function tryInitMap() {
    if (window.google && window.google.maps) { initPropertyMap(); return }
    if (++_mapAttempts < 25) setTimeout(tryInitMap, 400)
    else { const coord = COORDS[lookupSlug] || COORDS[lookupSlug.replace(/-u-[^/]*$/, '')]; if (coord) renderOsmMap(coord) }
  }
  tryInitMap()

  /* ── initial render ── */
  const initLang = localStorage.getItem('an_lang') || 'en'
  try {
    renderContent(getTranslatedListing(initLang))
  } finally {
    revealPropertyShell()
  }

  /* ── re-render on language change (no reload needed) ── */
  window.addEventListener('an:langchange', e => {
    const lang = e.detail.lang
    renderContent(getTranslatedListing(lang))
    // Re-apply i18n static labels after render (in case dynamic content overwrote badge text etc.)
    if (typeof applyI18n === 'function') applyI18n(lang)
  })
})()
