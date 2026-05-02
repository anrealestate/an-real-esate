/* ================================
   development-loader.js
   Reads ?slug= from URL and populates
   development.html dynamically
   ================================ */
;(async function () {
  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
  }

  function cloudinarySrcset(url) {
    if (!url || !url.includes('res.cloudinary.com')) return ''
    return [640, 1024, 1440, 1920].map(w => `${url.replace(/\bw_\d+/, `w_${w}`)} ${w}w`).join(', ')
  }


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

  /**
   * Canonical en listings.json: house-of-wellness / house-of-wellness-u-*.
   * Compat: URLs o caché antigua con typo house-of-wellnes → mismo slug corregido.
   */
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

  /** Absolute URL for floor plan assets (JSON may use /docs/… relative to site root). */
  function resolveFloorplanAssetUrl(src) {
    if (!src) return ''
    try { return new URL(src, window.location.href).href } catch (_) { return String(src) }
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
        if (!lib) { reject(new Error('pdfjsLib')); return }
        lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'
        resolve(lib)
      }
      s.onerror = () => reject(new Error('pdf.js'))
      document.head.appendChild(s)
    })
    return _pdfJsPromise
  }

  async function renderPdfFirstPage(canvas, pdfUrl, maxW, maxH) {
    const lib = await loadPdfJs()
    const pdf = await lib.getDocument({ url: pdfUrl, withCredentials: false }).promise
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

  const slug = listingsSlugFromUrl(new URLSearchParams(location.search).get('slug') || '')

  function readInlineListings() {
    const el = document.getElementById('listings-data')
    if (!el) return []
    try {
      const parsed = JSON.parse(el.textContent)
      return Array.isArray(parsed.listings) ? parsed.listings : []
    } catch (_) {
      return []
    }
  }

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
  if (!listings.length) return

  /* Merge admin cache: servidor publicado gana; floorPlans del servidor si existen */
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

  const listing = listings.find(l => l.slug === (slug || ''))
  if (!listing || listing.propertyType !== 'development') return

  /* ── Map helpers (copied from property-loader.js) ── */
  const MAP_STYLE = [
    { elementType: 'geometry',            stylers: [{ color: '#18180f' }] },
    { elementType: 'labels.text.fill',    stylers: [{ color: '#9a8f7a' }] },
    { elementType: 'labels.text.stroke',  stylers: [{ color: '#18180f' }] },
    { featureType: 'road',               elementType: 'geometry',           stylers: [{ color: '#252519' }] },
    { featureType: 'road.arterial',      elementType: 'geometry',           stylers: [{ color: '#2b2b1e' }] },
    { featureType: 'road.highway',       elementType: 'geometry',           stylers: [{ color: '#323224' }] },
    { featureType: 'road',               elementType: 'labels.text.fill',   stylers: [{ color: '#7a7060' }] },
    { featureType: 'water',              elementType: 'geometry',           stylers: [{ color: '#0b0e12' }] },
    { featureType: 'landscape',          elementType: 'geometry',           stylers: [{ color: '#1a1a12' }] },
    { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative',     elementType: 'geometry.stroke',    stylers: [{ color: '#2e2e22' }] },
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
    window._propMapCoord = coord
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
        fillColor: '#c8a96e', fillOpacity: 1, strokeColor: '#18180f', strokeWeight: 1,
        scale: 2, anchor: new google.maps.Point(12, 22),
      }
    })
  }

  window.gm_authFailure = function () {
    const coord = window._propMapCoord
    if (coord) renderOsmMap(coord)
  }

  function initMap() {
    if (listing.lat && listing.lng) {
      renderMap({ lat: parseFloat(listing.lat), lng: parseFloat(listing.lng) })
      return
    }
    const address = listing.address || listing.neighbourhood || listing.city
    if (!address) return
    if (window.google && window.google.maps) {
      new google.maps.Geocoder().geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location
          renderMap({ lat: loc.lat(), lng: loc.lng() })
        }
      })
    }
  }

  var _mapAttempts = 0
  function tryInitMap() {
    if (window.google && window.google.maps) { initMap(); return }
    if (++_mapAttempts < 25) setTimeout(tryInitMap, 400)
    else if (listing.lat && listing.lng) renderOsmMap({ lat: parseFloat(listing.lat), lng: parseFloat(listing.lng) })
  }

  /* ── Floor plans section — module-scope state ── */
  let _fpInited      = false  // section scaffold built only once
  let _fpRenderGen   = 0      // bumped on each grid re-render to cancel stale PDF renders
  let _fpObserver    = null   // single IntersectionObserver for lazy PDF previews
  let _fpAllGroups   = []     // layout groups cached on first init
  let _fpPage        = 1      // load-more page cursor (1 = first FP_PAGE cards visible)
  let _fpFilter      = 'all'  // active beds filter chip value
  let _fpSort        = 'default'
  let _fpLastCard    = null   // card element that triggered modal (for focus restore)
  let _fpTrapHandler = null   // keydown handler for modal focus trap

  /* ── Main render ── */
  function renderContent() {
    const lang = (typeof getLang === 'function') ? getLang() : (localStorage.getItem('an_lang') || 'en')

    /* Meta + OG */
    const firstImg = (listing.images || []).find(i => !(typeof i === 'object' ? i.hidden : false))
    const ogImg = typeof firstImg === 'string' ? firstImg : (firstImg?.src || listing.image || '')
    const pageUrl = `https://anrealestate.es/development.html?slug=${esc(publicSlugFromJson(listing.slug))}`
    const dvDesc = (listing.description || [])[0] || ''
    const dvTitle = `${listing.title} — AN Real Estate`
    document.title = `${listing.title} — ${listing.price} — AN Real Estate`
    document.querySelector('meta[name="description"]')?.setAttribute('content', dvDesc)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', dvTitle)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', dvTitle)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', dvDesc)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', dvDesc)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', pageUrl)
    if (ogImg) {
      document.querySelector('meta[property="og:image"]')?.setAttribute('content', ogImg)
      document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', ogImg)
    }
    let canonEl = document.querySelector('link[rel="canonical"]')
    if (!canonEl) { canonEl = document.createElement('link'); canonEl.rel = 'canonical'; document.head.appendChild(canonEl) }
    canonEl.href = pageUrl

    /* JSON-LD */
    const jsonLdEl = document.getElementById('property-jsonld')
    if (jsonLdEl) {
      const dvPriceCurrency = /^\$/.test(String(listing.price || '')) ? 'USD' : 'EUR'
      const dvPriceNum = String(listing.price || '').replace(/[^0-9]/g, '')
      jsonLdEl.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        'name': listing.title,
        'description': dvDesc,
        'url': pageUrl,
        'image': ogImg,
        ...(dvPriceNum ? { 'offers': { '@type': 'Offer', 'price': dvPriceNum, 'priceCurrency': dvPriceCurrency } } : {}),
        'address': { '@type': 'PostalAddress', 'streetAddress': listing.address || '', 'addressLocality': listing.city || 'Barcelona', 'addressCountry': 'ES' }
      })
    }

    /* Breadcrumb */
    const bcTitle = document.getElementById('dv-bc-title')
    if (bcTitle) bcTitle.textContent = listing.title

    /* Gallery */
    const imgs = (listing.images || [])
      .filter(i => !(typeof i === 'object' ? i.hidden : false))
      .map(i => typeof i === 'string' ? { src: i, alt: listing.title } : i)

    const heroEl  = document.getElementById('dv-pg-hero')
    const heroImg = document.getElementById('dv-hero-img')
    const gridEl  = document.getElementById('dv-pg-grid')

    if (imgs.length && heroEl && heroImg) {
      heroEl.dataset.src = imgs[0].src
      heroImg.src = imgs[0].src
      heroImg.alt = imgs[0].alt || listing.title
      const hSrcset = cloudinarySrcset(imgs[0].src)
      if (hSrcset) { heroImg.srcset = hSrcset; heroImg.sizes = '100vw' }
      heroEl.removeAttribute('hidden')
    }

    if (gridEl && imgs.length > 1) {
      const cells = imgs.slice(1, 5)
      const isLast = i => i === cells.length - 1 && imgs.length > 5
      gridEl.innerHTML = cells.map((img, i) => `
        <button class="pg-cell${isLast(i) ? ' pg-cell--last' : ''}" data-src="${esc(img.src)}">
          <img src="${esc(img.src)}" alt="${esc(img.alt || listing.title)}" loading="lazy" />
          ${isLast(i) ? `<div class="pg-more-overlay"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>View all ${imgs.length} photos</div>` : ''}
        </button>`).join('')
      gridEl.style.display = ''
    }

    /* Expose full image array so lightbox uses all photos, not just DOM cells */
    window.__propertyGalleryImages = imgs
    /* Signal property.js that gallery DOM is ready (resolves lightbox race condition) */
    window._galleryReady = true
    document.dispatchEvent(new CustomEvent('gallery:ready', { detail: { images: imgs } }))

    /* Update lb-counter */
    const lbCounter = document.getElementById('lb-counter')
    if (lbCounter) lbCounter.textContent = `1 / ${imgs.length}`

    /* Header bar */
    const titleEl = document.getElementById('dv-title')
    if (titleEl) titleEl.textContent = listing.title

    const addrEl = document.getElementById('dv-address-text')
    if (addrEl) addrEl.textContent = listing.address || listing.neighbourhood || ''

    const priceEl = document.getElementById('dv-price')
    if (priceEl) priceEl.textContent = listing.price || '—'

    const refEl = document.getElementById('dv-ref')
    if (refEl && listing.ref) refEl.textContent = `Ref. ${listing.ref}`

    /* Badges */
    const badgesEl = document.getElementById('dv-badges')
    if (badgesEl) {
      const statusClass = {
        'pre-construction': 'dv-badge--status-pre',
        'under construction': 'dv-badge--status-construction',
        'ready': 'dv-badge--status-ready',
      }[(listing.constructionStatus || '').toLowerCase()] || 'dv-badge--status-pre'
      badgesEl.innerHTML =
        `<span class="dv-badge dv-badge--type">New Development</span>` +
        (listing.constructionStatus ? `<span class="dv-badge ${statusClass}">${esc(listing.constructionStatus)}</span>` : '')
    }

    /* Stats row */
    const set = (id, val) => { const e = document.getElementById(id); if (e && val) e.textContent = val }
    set('dv-floors',       listing.totalFloors ? String(listing.totalFloors) : null)
    set('dv-res-count',    listing.totalUnits  ? String(listing.totalUnits)  : null)
    set('dv-amenities-area', listing.amenitiesArea || null)
    set('dv-delivery',     listing.deliveryDate || null)
    set('dv-status-stat',  listing.constructionStatus || null)

    /* Description */
    const descEl = document.getElementById('dv-description')
    if (descEl && listing.description?.length) {
      descEl.innerHTML = listing.description.map(p => `<p>${esc(p)}</p>`).join('')
    }

    const vidSec = document.getElementById('dv-video-section')
    const vidFrame = document.getElementById('dv-video-iframe')
    if (vidSec && vidFrame) {
      const yid = extractYoutubeVideoId(listing.youtubeUrl || listing.videoYoutubeUrl || '')
      if (yid) {
        vidSec.removeAttribute('hidden')
        vidFrame.src =
          'https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(yid) +
          '?rel=0&modestbranding=1&playsinline=1'
      } else {
        vidSec.setAttribute('hidden', '')
        vidFrame.src = ''
        vidFrame.removeAttribute('src')
      }
    }

    /* ── Virtual Tour 360° ── */
    const tourSec = document.getElementById('dv-tour-section')
    const tourFrame = document.getElementById('dv-tour-iframe')
    if (tourSec && tourFrame) {
      const tourUrl = sanitizeVirtualTourUrl(listing.virtualTourUrl || '')
      if (tourUrl) {
        tourSec.removeAttribute('hidden')
        tourFrame.src = tourUrl
      } else {
        tourSec.setAttribute('hidden', '')
        tourFrame.removeAttribute('src')
      }
    }

    /* Features */
    const featSection = document.getElementById('dv-features-section')
    const featEl = document.getElementById('dv-features')
    if (featSection && featEl && listing.features && Object.keys(listing.features).length) {
      featEl.innerHTML = Object.entries(listing.features).map(([cat, items]) => `
        <div class="dv-feat-group">
          <p class="dv-feat-title">${esc(cat)}</p>
          <ul class="dv-feat-list">${items.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>`).join('')
      featSection.removeAttribute('hidden')
    }

    /* Units — inventario units[] de la promoción primero; si no hay, unidades hijas (fichas) */
    const unitsSection = document.getElementById('dv-units-section')
    const unitGrid     = document.getElementById('dv-unit-grid')
    const unitFilters  = document.getElementById('dv-unit-filters')

    /* Child listings are PUBLIC_STAGES only (active/reserved/sold); draft hidden from web */
    const PUBLIC_STAGES = ['active', 'reserved', 'sold']
    const children = listings
      .filter(l => l.parent_slug === listing.slug && PUBLIC_STAGES.includes(l.stage))
      .sort((a, b) => (a.ref || '').localeCompare(b.ref || ''))

    if (unitsSection && unitGrid) {
      const FILTER_LABEL = { 0: 'Studio', 1: '1 Bed', 2: '2 Bed', 3: '3 Bed' }
      const STAGE_LABEL  = { active: 'Available', reserved: 'Reserved', sold: 'Sold' }
      const STAGE_CLASS  = { active: 'dv-unit-avail--available', reserved: 'dv-unit-avail--reserved', sold: 'dv-unit-avail--sold' }

      function wireFilters(bedsValues) {
        if (!unitFilters || bedsValues.size < 2) return
        const sorted = [...bedsValues].sort((a, b) => a - b)
        sorted.forEach(b => {
          const btn = document.createElement('button')
          btn.className = 'dv-uftab'
          btn.dataset.ufilter = String(b)
          btn.textContent = FILTER_LABEL[b] || `${b} Bed`
          unitFilters.appendChild(btn)
        })
        unitFilters.querySelectorAll('.dv-uftab').forEach(tab => {
          tab.addEventListener('click', () => {
            unitFilters.querySelectorAll('.dv-uftab').forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            const f = tab.dataset.ufilter
            /* When filtering, reveal all cards so the full filtered set is visible */
            unitGrid.querySelectorAll('.dv-more-hidden').forEach(c => c.classList.remove('dv-more-hidden'))
            if (loadMoreBtn) loadMoreBtn.hidden = true
            applyFilter(f)
          })
        })
      }

      const PAGE_SIZE    = 12
      const countEl      = document.getElementById('dv-units-count')
      const loadMoreBtn  = document.getElementById('dv-units-loadmore')
      const sortSel      = document.getElementById('dv-units-sort')
      const FMT          = window.AN_FMT || {}
      const L            = (window.I18N && window.I18N[lang]) || {}
      const t            = k => L[k] || k

      /* ── Sort helpers ── */
      function parsePrice(str) {
        return FMT.parsePrice ? FMT.parsePrice(str) : Infinity
      }
      function sizeVal(c) {
        return FMT.sortableSize ? FMT.sortableSize(c) : parseFloat(String(c.size ?? 0)) || 0
      }

      /* Sort a copy of arr; doesn't mutate original */
      function sortArr(arr, criterion) {
        const a2 = [...arr]
        switch (criterion) {
          case 'price-asc':  a2.sort((a,b) => parsePrice(a.price) - parsePrice(b.price)); break
          case 'price-desc': a2.sort((a,b) => parsePrice(b.price) - parsePrice(a.price)); break
          case 'size-asc':   a2.sort((a,b) => sizeVal(a) - sizeVal(b)); break
          case 'size-desc':  a2.sort((a,b) => sizeVal(b) - sizeVal(a)); break
          case 'floor-asc':  a2.sort((a,b) => (a.floor ?? 999) - (b.floor ?? 999)); break
          case 'floor-desc': a2.sort((a,b) => (b.floor ?? -1) - (a.floor ?? -1)); break
          default: /* keep original order (by ref) */
        }
        return a2
      }

      /* Build sort <option> list */
      function buildSortOptions() {
        if (!sortSel) return
        const opts = [
          { v: 'default',    k: 'sort.default' },
          { v: 'price-asc',  k: 'sort.price_asc' },
          { v: 'price-desc', k: 'sort.price_desc' },
          { v: 'size-asc',   k: 'sort.size_asc' },
          { v: 'size-desc',  k: 'sort.size_desc' },
          { v: 'floor-asc',  k: 'sort.floor_asc' },
          { v: 'floor-desc', k: 'sort.floor_desc' },
        ]
        const cur = sortSel.value || 'default'
        sortSel.innerHTML = opts.map(o =>
          `<option value="${o.v}"${o.v === cur ? ' selected' : ''}>${esc(t(o.k))}</option>`
        ).join('')
      }

      /* Track active filter for re-application after sort */
      let _activeFilter = 'all'

      function applyFilter(f) {
        _activeFilter = f
        unitGrid.querySelectorAll('[data-beds]').forEach(card => {
          const hidden = f !== 'all' && card.dataset.beds !== f
          card.classList.toggle('hidden', hidden)
        })
      }

      function applyPagination(visibleCount) {
        if (!loadMoreBtn) return
        const allCards = [...unitGrid.querySelectorAll('.dv-unit-card')]
        allCards.forEach((c, i) => c.classList.toggle('dv-more-hidden', i >= PAGE_SIZE))
        if (visibleCount > PAGE_SIZE) {
          const rem = visibleCount - PAGE_SIZE
          const lbl = t('dv.loadmore').replace('{n}', rem)
          loadMoreBtn.textContent = lbl || `${lang === 'es' ? 'Ver más' : 'Show more'} (${rem})`
          loadMoreBtn.hidden = false
        } else {
          loadMoreBtn.hidden = true
        }
      }

      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          unitGrid.querySelectorAll('.dv-more-hidden').forEach(c => c.classList.remove('dv-more-hidden'))
          loadMoreBtn.hidden = true
        })
      }

      if (listing.units?.length) {
        /* ── Inventario en la promoción (p. ej. listado PDF importado en admin) ── */
        const AVAIL_LABEL = { available: 'Available', reserved: 'Reserved', sold: 'Sold' }
        const availClass  = { available: 'dv-unit-avail--available', reserved: 'dv-unit-avail--reserved', sold: 'dv-unit-avail--sold' }
        const bedsSet = new Set(listing.units.map(u => u.beds ?? 0))
        wireFilters(bedsSet)

        if (countEl) {
          countEl.textContent = `${listing.units.length} ${lang === 'es' ? 'unidades' : 'units'}`
          countEl.hidden = false
        }
        unitGrid.innerHTML = listing.units.map(u => {
          const sizeRange = u.sizeMin && u.sizeMax
            ? `${u.sizeMin}–${u.sizeMax} sq ft`
            : (u.sizeMin ? `${u.sizeMin} sq ft` : '')
          const avail  = u.availability || 'available'
          const aClass = availClass[avail] || 'dv-unit-avail--available'
          const isSold = avail === 'sold'
          return `
            <div class="dv-unit-card" data-beds="${u.beds ?? 0}">
              <div class="dv-unit-head">
                <span class="dv-unit-id">${esc(u.id)}</span>
                <span class="dv-unit-avail ${aClass}">${esc(AVAIL_LABEL[avail] || avail)}</span>
              </div>
              <p class="dv-unit-layout">${esc(u.layout || '')}</p>
              <div class="dv-unit-meta">
                ${sizeRange ? `<span>${esc(sizeRange)}</span>` : ''}
                ${u.floorsAvailable ? `<span>Floors ${esc(u.floorsAvailable)}</span>` : ''}
              </div>
              <p class="dv-unit-price">${esc(u.priceFrom || '—')}</p>
              ${!isSold ? `<a href="#enquire" class="dv-unit-cta" onclick="document.querySelector('#prop-form [name=message]').value='Interested in unit type ${esc(u.id)} (${esc(u.layout||'')})'">Enquire</a>` : ''}
            </div>`
        }).join('')
        applyPagination(listing.units.length)
        unitsSection.removeAttribute('hidden')

      } else if (children.length) {
        /* ── Unidades hijas con ficha propia (property.html) ── */
        const bedsSet = new Set(children.map(c => c.beds ?? 0))
        wireFilters(bedsSet)
        buildSortOptions()

        const ctaLabel = t('unit.view_listing') || (lang === 'es' ? 'Ver ficha →' : 'View listing →')
        const areaIntLabel = t('area.interior') || 'Interior'
        const areaExtLabel = t('area.exterior') || 'Exterior'

        function renderChildren(arr) {
          const frag = document.createDocumentFragment()
          arr.forEach(c => {
            const stage  = c.stage || 'active'
            const sLabel = STAGE_LABEL[stage] || stage
            const sClass = STAGE_CLASS[stage] || 'dv-unit-avail--available'
            const isSold = stage === 'sold'
            const areaParts = FMT.formatAreaParts ? FMT.formatAreaParts(c) : null
            const interior  = areaParts ? areaParts.interior : (c.size ? c.size + (c.sizeUnit === 'sqft' ? ' sq ft' : ' m²') : null)
            const exterior  = areaParts ? areaParts.exterior : null
            const floor     = c.floor ? `Floor ${esc(c.floor)}` : ''
            const beds      = c.beds != null ? (c.beds === 0 ? 'Studio' : c.beds + ' bed') : ''
            const baths     = c.baths ? c.baths + ' bath' : ''

            const div = document.createElement('div')
            div.className = 'dv-unit-card dv-child-card'
            div.dataset.beds = String(c.beds ?? 0)
            div.innerHTML = `
              <div class="dv-unit-head">
                <span class="dv-child-ref">${esc(c.ref || c.slug)}</span>
                <span class="dv-unit-avail ${sClass}">${esc(sLabel)}</span>
              </div>
              <p class="dv-unit-layout">${esc(c.title || '')}</p>
              <div class="dv-unit-meta">
                ${beds    ? `<span>${esc(beds)}</span>`     : ''}
                ${baths   ? `<span>${esc(baths)}</span>`    : ''}
                ${interior ? `<span title="${esc(areaIntLabel)}">${esc(interior)}</span>` : ''}
                ${floor   ? `<span>${floor}</span>`          : ''}
              </div>
              ${exterior ? `<p class="dv-unit-ext-meta" title="${esc(areaExtLabel)}">+ ${esc(exterior)} ext.</p>` : ''}
              <p class="dv-unit-price">${esc(c.price || '—')}</p>
              ${!isSold ? `<a href="property.html?slug=${esc(publicSlugFromJson(c.slug))}" class="dv-unit-cta dv-child-cta">${ctaLabel}</a>` : ''}
            `
            frag.appendChild(div)
          })
          unitGrid.innerHTML = ''
          unitGrid.appendChild(frag)
        }

        /* Initial render (default sort: by ref, already sorted) */
        renderChildren(children)

        /* Unit count badge */
        if (countEl) {
          const availCount = children.filter(c => c.stage === 'active').length
          const avStr = t('dv.units_available').replace('{n}', availCount) || `${availCount} residences available`
          const totStr = t('dv.units_total').replace('{n}', children.length) || `${children.length} total`
          countEl.textContent = `${avStr} · ${totStr}`
          countEl.hidden = false
        }

        applyPagination(children.length)

        /* Sort handler */
        if (sortSel) {
          sortSel.addEventListener('change', () => {
            const criterion = sortSel.value
            const sorted = sortArr(children, criterion)
            renderChildren(sorted)
            applyFilter(_activeFilter)
            const visibleCount = unitGrid.querySelectorAll('.dv-unit-card:not(.hidden)').length
            applyPagination(visibleCount)
          })
        }

        unitsSection.removeAttribute('hidden')

      } else {
        if (unitsSection) unitsSection.setAttribute('hidden', '')
      }
    }

    /* ══════════════════════════════════════════════════════════════════
       Floor Plans — group child units by layout; interactive grid + modal
       ══════════════════════════════════════════════════════════════════ */
    const fpSec  = document.getElementById('dv-floorplans-section')
    const fpGrid = document.getElementById('dv-floorplans-grid')

    /*
     * Layout group key = normalised URL pathname of floorPlans[0].src (query stripped).
     * Units sharing the same PDF/image file collapse into one layout card.
     * Fallback: floorPlans[0].label (lowercase-trimmed) when src is absent.
     * A unit is assigned to the group of its FIRST floorPlan only; multiple plans
     * on the same unit are accessible via the PDF link on the card.
     * Units without floorPlans are excluded from this section.
     */
    function fpLayoutKey(fp) {
      if (!fp) return null
      const raw = (fp.src || '').trim()
      if (raw) {
        try { return new URL(raw, window.location.href).pathname }
        catch (_) { return raw.replace(/\?.*$/, '') }
      }
      const lbl = (fp.label || '').toLowerCase().trim()
      return lbl || null
    }

    if (!_fpInited) {
      /* Build layout groups once (children data doesn't change with lang switch) */
      const groupMap = new Map()
      for (const child of children) {
        if (!child.floorPlans?.length) continue
        const fp = child.floorPlans[0]
        const key = fpLayoutKey(fp)
        if (!key) continue
        if (!groupMap.has(key)) groupMap.set(key, { fp: { ...fp }, units: [] })
        groupMap.get(key).units.push(child)
      }
      _fpAllGroups = [...groupMap.values()]

      if (!fpSec || !fpGrid || !_fpAllGroups.length) {
        if (fpSec) { fpSec.setAttribute('hidden', ''); fpSec.hidden = true }
      } else {
        const FP_PAGE = 12
        const STAGE_LABEL = { active: 'Available', reserved: 'Reserved', sold: 'Sold' }
        const STAGE_CLASS  = { active: 'dv-unit-avail--available', reserved: 'dv-unit-avail--reserved', sold: 'dv-unit-avail--sold' }
        const BEDS_LABEL   = { 0: 'Studio', 1: '1 Bed', 2: '2 Bed', 3: '3 Bed', 4: '4 Bed', 5: '5 Bed' }

        function fpIsPdf(fp) { return /\.pdf(\?|$)/i.test(fp?.src || '') }
        function fpThumbUrl(fp) {
          const raw = fp?.thumb || fp?.preview
          if (raw && String(raw).trim()) return String(raw).trim()
          if (!fpIsPdf(fp) && fp?.src) return String(fp.src).trim()
          return ''
        }

        /* Most-common beds value among a group's units (for filter assignment) */
        function groupBedsKey(group) {
          const beds = group.units.map(u => u.beds).filter(b => b != null)
          if (!beds.length) return -1
          const freq = {}
          beds.forEach(b => { freq[b] = (freq[b] || 0) + 1 })
          return Number(Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0])
        }

        /* Human-readable aggregate: "2 bed · 4 residences" */
        function groupMeta(group) {
          const units = group.units
          const bedsVals = units.map(u => u.beds).filter(b => b != null)
          const bMin = bedsVals.length ? Math.min(...bedsVals) : null
          const bMax = bedsVals.length ? Math.max(...bedsVals) : null
          const bedsStr = bMin === null ? '' :
            bMin === bMax ? (bMin === 0 ? 'Studio' : `${bMin} bed`) : `${bMin}–${bMax} bed`
          const unitStr = units.length === 1 ? '1 residence' : `${units.length} residences`
          return [bedsStr, unitStr].filter(Boolean).join(' · ')
        }

        function sortGroups(arr, criterion) {
          const a2 = [...arr]
          switch (criterion) {
            case 'label-asc':   a2.sort((a, b) => (a.fp.label || '').localeCompare(b.fp.label || '')); break
            case 'label-desc':  a2.sort((a, b) => (b.fp.label || '').localeCompare(a.fp.label || '')); break
            case 'count-desc':  a2.sort((a, b) => b.units.length - a.units.length); break
            case 'count-asc':   a2.sort((a, b) => a.units.length - b.units.length); break
          }
          return a2
        }

        function getFilteredSorted() {
          let g = sortGroups(_fpAllGroups, _fpSort)
          if (_fpFilter !== 'all') g = g.filter(gr => String(groupBedsKey(gr)) === _fpFilter)
          return g
        }

        /* ── IntersectionObserver for lazy PDF renders ── */
        function makeObserver(gen) {
          return new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return
              _fpObserver && _fpObserver.unobserve(entry.target)
              if (gen !== _fpRenderGen) return
              const card   = entry.target
              const canvas = card.querySelector('.fp-lcard-canvas')
              const loadEl = card.querySelector('.fp-lcard-loading')
              const pdfUrl = card.dataset.pdfUrl
              if (!canvas || !pdfUrl) return
              const prev = canvas.closest('.fp-lcard-preview')
              const maxW = Math.max(60, (prev ? prev.offsetWidth : 0) || 200)
              const maxH = Math.max(60, (prev ? prev.offsetHeight : 0) || 150)
              renderPdfFirstPage(canvas, pdfUrl, maxW, maxH)
                .then(() => { if (gen === _fpRenderGen && loadEl) loadEl.remove() })
                .catch(() => { if (loadEl) loadEl.remove() })
            })
          }, { rootMargin: '200px' })
        }

        /* ── Build a layout card element ── */
        function buildFpCard(group) {
          const fp      = group.fp
          const isPdf   = fpIsPdf(fp)
          const thumb   = fpThumbUrl(fp)
          const pdfAbs  = isPdf && !thumb ? resolveFloorplanAssetUrl(fp.src) : ''
          const label   = fp.label || 'Floor Plan'
          const meta    = groupMeta(group)

          let previewInner = ''
          if (thumb) {
            previewInner = `<img src="${esc(thumb)}" alt="${esc(label)}" loading="lazy" />`
          } else if (pdfAbs) {
            previewInner = `<canvas class="fp-lcard-canvas" aria-label="${esc(label)} preview"></canvas><div class="fp-lcard-loading" aria-hidden="true">Loading…</div>`
          } else {
            previewInner = `<div class="fp-lcard-preview-placeholder" aria-hidden="true"><svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Floor Plan</span></div>`
          }

          const card = document.createElement('button')
          card.type = 'button'
          card.className = 'fp-lcard'
          card.setAttribute('aria-label', `${label}${meta ? ' — ' + meta : ''}`)
          if (pdfAbs) card.dataset.pdfUrl = pdfAbs

          const hasPdfLink = isPdf && fp.src
          card.innerHTML = `
            <div class="fp-lcard-preview">${previewInner}</div>
            <div class="fp-lcard-body">
              <div class="fp-lcard-label">${esc(label)}</div>
              ${meta ? `<div class="fp-lcard-meta">${esc(meta)}</div>` : ''}
            </div>
            <div class="fp-lcard-actions">
              <span class="fp-lcard-cta">View residences</span>
              ${hasPdfLink ? `<a class="fp-lcard-pdf" href="${esc(resolveFloorplanAssetUrl(fp.src))}" target="_blank" rel="noopener" aria-label="Open PDF for ${esc(label)}" onclick="event.stopPropagation()"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF</a>` : ''}
            </div>`
          card.addEventListener('click', () => { _fpLastCard = card; openFpModal(group) })
          return card
        }

        /* ── Render (or append) cards to the grid ── */
        const loadMoreBtn = document.createElement('button')
        loadMoreBtn.className = 'dv-fp-loadmore'
        loadMoreBtn.hidden = true
        fpGrid.after(loadMoreBtn)

        function renderFpGrid(mode) {
          if (mode !== 'append') {
            if (_fpObserver) { _fpObserver.disconnect(); _fpObserver = null }
            _fpRenderGen++
            fpGrid.innerHTML = ''
            _fpPage = 1
          } else {
            _fpPage++
          }

          const groups    = getFilteredSorted()
          const startIdx  = mode === 'append' ? (_fpPage - 1) * FP_PAGE : 0
          const endIdx    = _fpPage * FP_PAGE
          const slice     = groups.slice(startIdx, endIdx)

          const gen = _fpRenderGen
          if (!_fpObserver) _fpObserver = makeObserver(gen)

          slice.forEach(group => {
            const card = buildFpCard(group)
            fpGrid.appendChild(card)
            if (card.dataset.pdfUrl) _fpObserver.observe(card)
          })

          const remaining = Math.max(0, groups.length - Math.min(endIdx, groups.length))
          loadMoreBtn.textContent = remaining > 0 ? `Show more (${remaining})` : ''
          loadMoreBtn.hidden = remaining <= 0
        }

        loadMoreBtn.addEventListener('click', () => renderFpGrid('append'))

        /* ── Modal ── */
        const fpModalOverlay = document.getElementById('fp-modal-overlay')
        const fpModalTitle   = document.getElementById('fp-modal-title')
        const fpModalBody    = document.getElementById('fp-modal-body')
        const fpModalClose   = document.getElementById('fp-modal-close')

        function openFpModal(group) {
          if (!fpModalOverlay || !fpModalTitle || !fpModalBody) return
          fpModalTitle.textContent = group.fp.label || 'Floor Plan'
          fpModalBody.innerHTML = group.units.map(u => {
            const stage  = u.stage || 'active'
            const sLabel = STAGE_LABEL[stage] || stage
            const sClass = STAGE_CLASS[stage] || 'dv-unit-avail--available'
            const isSold = stage === 'sold'
            const beds   = u.beds != null ? (u.beds === 0 ? 'Studio' : `${u.beds} bed`) : ''
            const floor  = u.floor ? `Fl. ${u.floor}` : ''
            const meta   = [beds, floor].filter(Boolean).join(' · ')
            return `<div class="fp-modal-unit">
              <span class="fp-modal-unit-ref">${esc(u.ref || u.slug)}</span>
              <div class="fp-modal-unit-info">
                <div class="fp-modal-unit-title">${esc(u.title || '')}</div>
                ${meta ? `<div class="fp-modal-unit-meta">${esc(meta)}</div>` : ''}
              </div>
              <span class="fp-modal-unit-price">${esc(u.price || '—')}</span>
              <span class="dv-unit-avail ${sClass}">${esc(sLabel)}</span>
              ${!isSold ? `<a href="property.html?slug=${esc(publicSlugFromJson(u.slug))}" class="fp-modal-unit-link">View →</a>` : ''}
            </div>`
          }).join('')
          fpModalOverlay.classList.add('is-open')
          fpModalOverlay.setAttribute('aria-hidden', 'false')
          document.body.style.overflow = 'hidden'
          if (fpModalClose) fpModalClose.focus()
          _fpTrapHandler = function(e) {
            if (e.key === 'Escape') { closeFpModal(); return }
            if (e.key !== 'Tab') return
            const sel = 'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'
            const els = [...fpModalOverlay.querySelectorAll(sel)]
            if (!els.length) return
            const first = els[0], last = els[els.length - 1]
            if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
            else            { if (document.activeElement === last)  { e.preventDefault(); first.focus() } }
          }
          document.addEventListener('keydown', _fpTrapHandler)
        }

        function closeFpModal() {
          if (!fpModalOverlay) return
          fpModalOverlay.classList.remove('is-open')
          fpModalOverlay.setAttribute('aria-hidden', 'true')
          document.body.style.overflow = ''
          if (_fpTrapHandler) { document.removeEventListener('keydown', _fpTrapHandler); _fpTrapHandler = null }
          if (_fpLastCard) { _fpLastCard.focus(); _fpLastCard = null }
        }

        if (fpModalClose) fpModalClose.addEventListener('click', closeFpModal)
        if (fpModalOverlay) fpModalOverlay.addEventListener('click', e => { if (e.target === fpModalOverlay) closeFpModal() })

        /* ── Toolbar ── */
        const fpH2 = fpSec.querySelector('h2')
        const subtitleEl = document.createElement('p')
        subtitleEl.className = 'dv-fp-subtitle'
        subtitleEl.textContent = 'Each plan groups residences sharing the same layout'
        if (fpH2) fpH2.after(subtitleEl)

        const allBeds = [...new Set(_fpAllGroups.map(g => groupBedsKey(g)).filter(b => b >= 0))].sort((a, b) => a - b)
        const allCounts  = _fpAllGroups.map(g => g.units.length)
        const allLabels  = _fpAllGroups.map(g => g.fp.label || '')
        const countsSame = new Set(allCounts).size <= 1
        const labelsSame = new Set(allLabels).size <= 1

        const FP_SORT_OPTS = [
          { v: 'default',    label: 'Label A–Z',   disabled: labelsSame },
          { v: 'label-desc', label: 'Label Z–A',   disabled: labelsSame },
          { v: 'count-desc', label: 'Residences ↓', disabled: countsSame },
          { v: 'count-asc',  label: 'Residences ↑', disabled: countsSame },
        ]

        const toolbarEl = document.createElement('div')
        toolbarEl.className = 'dv-fp-toolbar'
        toolbarEl.innerHTML = `
          <div class="dv-fp-filters" role="group" aria-label="Filter by bedrooms">
            <button class="dv-uftab active" data-fpf="all" type="button">All</button>
            ${allBeds.map(b => `<button class="dv-uftab" data-fpf="${b}" type="button">${esc(BEDS_LABEL[b] || b + ' Bed')}</button>`).join('')}
          </div>
          <div class="dv-sort-wrap">
            <label class="dv-sort-label" for="dv-fp-sort">Sort</label>
            <select class="dv-sort-sel" id="dv-fp-sort">
              ${FP_SORT_OPTS.map(o => `<option value="${o.v}"${o.disabled ? ' disabled' : ''}>${esc(o.label)}${o.disabled ? ' (n/a)' : ''}</option>`).join('')}
            </select>
          </div>`
        fpGrid.before(toolbarEl)

        toolbarEl.querySelectorAll('[data-fpf]').forEach(btn => {
          btn.addEventListener('click', () => {
            toolbarEl.querySelectorAll('[data-fpf]').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            _fpFilter = btn.dataset.fpf
            renderFpGrid('reset')
          })
        })

        const fpSortSel = toolbarEl.querySelector('#dv-fp-sort')
        if (fpSortSel) {
          fpSortSel.addEventListener('change', () => {
            _fpSort = fpSortSel.value
            renderFpGrid('reset')
          })
        }

        renderFpGrid('reset')
        fpSec.removeAttribute('hidden')
        fpSec.hidden = false
        _fpInited = true
      }
    } else if (fpSec && !fpSec.hidden && !_fpAllGroups.length) {
      fpSec.setAttribute('hidden', '')
      fpSec.hidden = true
    }

    /* Details */
    const detailsSection = document.getElementById('dv-details-section')
    const detailsEl = document.getElementById('dv-details')
    if (detailsSection && detailsEl && listing.details?.length) {
      detailsEl.innerHTML = listing.details.map(d =>
        `<div class="pd-row"><span class="pd-key">${esc(d.key)}</span><span class="pd-val">${esc(d.val)}</span></div>`
      ).join('')
      detailsSection.removeAttribute('hidden')
    }

    /* Team */
    const teamSection = document.getElementById('dv-team-section')
    const teamEl = document.getElementById('dv-team')
    const TEAM_DESCS = {
      'North Development': 'Alliance between Oak Capital and Edifica — two firms with extensive experience in innovative residential projects. Mission: create residential concepts with added value, maximising returns for investors.',
      'Mc+G Architecture': 'Studio Mc+G Architecture specialises in hotel and resort design, historic preservation, commercial retail and residential projects. Founded by Jennifer McConney with over 600 projects across 18 years of practice.',
      'Urban Robot Associates': 'Multidisciplinary design collective based in Miami Beach, specialising in architecture, interior design, landscape architecture and urban design. Every project is built to elevate the human experience.',
      'North Management': 'Created by North Development to maintain its property portfolio under the highest standards of service, design and operational excellence — drawing on decades of luxury hospitality leadership.',
      'Fortune Development Sales': 'The leading exclusive on-site sales and marketing representative for third-party development projects in South Florida. Over 80 of the region\'s most successful projects; 21 offices worldwide.',
    }
    const teamMembers = [
      listing.developer       && { role: 'Developer',         name: listing.developer },
      listing.architect       && { role: 'Architecture',      name: listing.architect },
      listing.interiorDesign  && { role: 'Interior Design',   name: listing.interiorDesign },
      listing.managementCompany && { role: 'Property Management', name: listing.managementCompany },
      listing.salesAgency     && { role: 'Sales & Marketing', name: listing.salesAgency },
    ].filter(Boolean)

    if (teamSection && teamEl && teamMembers.length) {
      teamEl.innerHTML = teamMembers.map(m => `
        <div class="dv-team-card">
          <p class="dv-team-role">${esc(m.role)}</p>
          <p class="dv-team-name">${esc(m.name)}</p>
          ${TEAM_DESCS[m.name] ? `<p class="dv-team-desc">${esc(TEAM_DESCS[m.name])}</p>` : ''}
        </div>`).join('')
      teamSection.removeAttribute('hidden')
    }

    /* Aside */
    const asidePriceEl = document.getElementById('dv-aside-price')
    if (asidePriceEl) asidePriceEl.textContent = listing.price || '—'

    const pscPrice = document.getElementById('dv-psc-price')
    if (pscPrice) pscPrice.textContent = listing.price || '—'

    const asideMeta = document.getElementById('dv-aside-meta')
    if (asideMeta) {
      const rows = [
        listing.totalFloors     && { k: 'Floors',    v: String(listing.totalFloors) },
        listing.totalUnits      && { k: 'Residences', v: String(listing.totalUnits) },
        listing.deliveryDate    && { k: 'Delivery',   v: listing.deliveryDate },
        listing.constructionStatus && { k: 'Status',  v: listing.constructionStatus },
      ].filter(Boolean)
      asideMeta.innerHTML = rows.map(r => `
        <div class="dv-aside-meta-row">
          <span class="dv-aside-meta-key">${esc(r.k)}</span>
          <span class="dv-aside-meta-val">${esc(r.v)}</span>
        </div>`).join('')
    }

    /* Brochure */
    const brochureLink = document.getElementById('dv-brochure-link')
    if (brochureLink && listing.brochureUrl) {
      brochureLink.href = listing.brochureUrl
      brochureLink.style.display = ''
    }

    /* Hidden form field */
    const propField = document.getElementById('dv-property-field')
    if (propField) propField.value = `${listing.title} — ${listing.price} — ${listing.neighbourhood}`

    /* Map */
    tryInitMap()

    /* Reveal shell (mirrors property-loader.js anti-FOUC) */
    document.documentElement.classList.remove('property-shell-pending')
  }

  renderContent()

  window.addEventListener('an:langchange', () => {
    renderContent()
    if (typeof applyI18n === 'function') applyI18n((typeof getLang === 'function') ? getLang() : 'en')
  })
})()
