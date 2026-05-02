/* ================================
   property-loader.js
   Reads ?slug= from URL and populates
   property.html dynamically from JSON
   ================================ */
;(function () {
  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
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
  const slug = new URLSearchParams(location.search).get('slug')

  function revealPropertyShell() {
    document.documentElement.classList.remove('property-shell-pending')
  }

  const el = document.getElementById('listings-data')
  if (!el) {
    revealPropertyShell()
    return
  }
  let listings = []
  try {
    listings = JSON.parse(el.textContent).listings || []
  } catch {
    revealPropertyShell()
    return
  }
  /* Merge admin cache with deployed data so published fields (e.g. youtubeUrl) are not
     wiped by an older an_listings_cache on the same browser. */
  try {
    const cached = JSON.parse(localStorage.getItem('an_listings_cache') || '{}').listings || []
    if (cached.length && listings.length) {
      const serverBySlug = Object.fromEntries(listings.map(l => [l.slug, l]))
      const merged = []
      const seen = new Set()
      cached.forEach(c => {
        merged.push({ ...c, ...(serverBySlug[c.slug] || {}) })
        seen.add(c.slug)
      })
      listings.forEach(l => {
        if (!seen.has(l.slug)) merged.push(l)
      })
      listings = merged
    } else if (cached.length) {
      listings = cached
    }
  } catch {}

  const baseListing = listings.find(l => l.slug === (slug || 'gracia-garden'))
  if (!baseListing) {
    revealPropertyShell()
    return
  }

  /* Promociones (obra nueva) usan development.html — misma URL antigua sigue funcionando */
  if (baseListing.propertyType === 'development') {
    const params = new URLSearchParams(location.search)
    if (!params.get('slug')) params.set('slug', baseListing.slug)
    location.replace(`development.html?${params.toString()}`)
    return
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
    const pageUrl = `https://anrealestate.es/property.html?slug=${listing.slug}`
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', ogImg)
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', ogImg)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${listing.title} — ${priceLabel} — AN Real Estate`)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', pageUrl)
    let canonEl = document.querySelector('link[rel="canonical"]')
    if (!canonEl) { canonEl = document.createElement('link'); canonEl.rel = 'canonical'; document.head.appendChild(canonEl) }
    canonEl.href = pageUrl

    /* ── JSON-LD structured data ── */
    const jsonLdEl = document.getElementById('property-jsonld')
    if (jsonLdEl) {
      jsonLdEl.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        'name': listing.title,
        'description': (listing.description || [])[0] || '',
        'url': pageUrl,
        'image': ogImg,
        'offers': {
          '@type': 'Offer',
          'price': listing.price.replace(/[^0-9]/g, ''),
          'priceCurrency': 'EUR',
          'availability': 'https://schema.org/InStock'
        },
        'numberOfRooms': listing.beds,
        'floorSize': { '@type': 'QuantitativeValue', 'value': listing.size, 'unitCode': 'MTK' },
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Barcelona',
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
            link.href = `development.html?slug=${esc(parent.slug)}`
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
    const priceEl = document.getElementById('ph-price')
    if (priceEl) {
      priceEl.innerHTML = isRent
        ? `${esc(listing.price)}<small>/mo</small>`
        : esc(listing.price)
    }
    const refEl = document.getElementById('ph-ref')
    if (refEl) refEl.textContent = `Ref. ${listing.ref}`

    /* ── sidebar contact panel ── */
    const pcPrice = document.querySelector('.pc-price')
    if (pcPrice) pcPrice.innerHTML = isRent ? `${esc(listing.price)}<small>/mo</small>` : esc(listing.price)
    const pcLoc = document.querySelector('.pc-loc')
    if (pcLoc) pcLoc.textContent = listing.neighbourhood || listing.city || ''

    /* ── specs ── */
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val }
    set('spec-beds',  listing.beds)
    set('spec-baths', listing.baths)
    set('spec-size',  `${listing.size} m²`)
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

    /* ── floor plans ── */
    const fpSec  = document.getElementById('ph-floorplans-section')
    const fpGrid = document.getElementById('ph-floorplans-grid')
    if (fpSec && fpGrid && listing.floorPlans?.length) {
      fpGrid.innerHTML = listing.floorPlans.map(fp => {
        const isPdf = /\.pdf(\?|$)/i.test(fp.src || '')
        return `<div class="fp-item">
          <div class="fp-img-wrap" onclick="window.open('${esc(fp.src)}','_blank')">
            ${isPdf
              ? `<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
              : `<img src="${esc(fp.src)}" alt="${esc(fp.label || '')}" loading="lazy" />`}
          </div>
          ${fp.label ? `<p class="fp-label">${esc(fp.label)}</p>` : ''}
          <a href="${esc(fp.src)}" class="fp-download" target="_blank" rel="noopener">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${isPdf ? 'PDF' : 'Ver'}
          </a>
        </div>`
      }).join('')
      fpSec.hidden = false
    } else if (fpSec) {
      fpSec.hidden = true
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
    if (stickyPrice) stickyPrice.textContent = priceLabel

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
      hero.dataset.src = imgs[0].src
      heroImg.src      = imgs[0].src
      heroImg.alt      = imgs[0].alt || baseListing.title
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

    // Inject hidden cells for photos beyond the 5 visible — property.js picks them up for the lightbox
    const pgSide = document.querySelector('.pg-grid-side')
    if (pgSide && imgs.length > 5) {
      imgs.slice(5).forEach(img => {
        const btn = document.createElement('button')
        btn.className = 'pg-cell'
        btn.dataset.src = img.src
        btn.style.display = 'none'
        const el = document.createElement('img')
        el.src = img.src
        el.alt = img.alt || baseListing.title
        btn.appendChild(el)
        pgSide.appendChild(btn)
      })
    }

    const moreText = document.querySelector('.pg-more-overlay')
    if (moreText) {
      moreText.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent = n.textContent.replace(/\d+ photos/, `${imgs.length} photos`)
      })
    }
    const lbCounter = document.getElementById('lb-counter')
    if (lbCounter) lbCounter.textContent = `1 / ${imgs.length}`
  }

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
    // 2. Hardcoded fallback coords
    const coord = COORDS[slug || 'gracia-garden']
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
    else { const coord = COORDS[slug || 'gracia-garden']; if (coord) renderOsmMap(coord) }
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
