/* ================================
   Listings — fetch & render
   ================================ */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

var cachedListings = []

var _activeFilter = 'all'
var _activeSort   = 'default'
var _revealed     = false

var DESKTOP_LIMIT  = 4
var DESKTOP_QUERY  = window.matchMedia('(min-width: 1024px)')

function _isDesktop() { return DESKTOP_QUERY.matches }

function _stagePriority(l) { return (l.stage === 'sold') ? 1 : 0 }

function _getSorted() {
  var copy = cachedListings.slice()
  if (_activeSort === 'price_desc') {
    copy.sort(function(a,b) {
      return _stagePriority(a) - _stagePriority(b) || _priceNum(b) - _priceNum(a)
    })
  } else if (_activeSort === 'price_asc') {
    copy.sort(function(a,b) {
      return _stagePriority(a) - _stagePriority(b) || _priceNum(a) - _priceNum(b)
    })
  } else {
    copy.sort(function(a,b) {
      return _stagePriority(a) - _stagePriority(b) || (a.order ?? 999) - (b.order ?? 999)
    })
  }
  return copy
}

function _priceNum(l) {
  var raw = String(l.price ?? '').replace(/[^0-9.]/g, '')
  return parseFloat(raw) || 0
}

function _getFiltered() {
  var f = _activeFilter
  return _getSorted().filter(function(l) {
    if (f === 'all')         return true
    if (f === 'sale')        return l.type === 'sale'
    if (f === 'rent')        return l.type === 'rent'
    if (f === 'development') return (l.propertyType === 'development' || l.badge === 'new_dev')
    return true
  })
}

async function initListings() {
  const grid = document.getElementById('props-grid')
  if (!grid) return

  let listings = []

  const inline = document.getElementById('listings-data')
  if (inline) {
    try {
      const data = JSON.parse(inline.textContent)
      listings = Array.isArray(data) ? data : (data.listings || [])
    } catch { /* malformed inline JSON */ }
  }

  if (!listings.length) {
    try {
      const res = await fetch('/data/listings.json')
      if (!res.ok) throw new Error()
      const data = await res.json()
      listings = Array.isArray(data) ? data : (data.listings || [])
    } catch { return }
  }

  cachedListings = listings
    .filter(l => (['active', 'reserved', 'sold'].includes(l.stage) || l.published) && !l.parent_slug)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  if (!cachedListings.length) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:var(--fs-xs);letter-spacing:.06em;">No listings available at this time.</p>'
    return
  }

  renderGrid()
  initFilters()
  initSort()

  DESKTOP_QUERY.addEventListener('change', function() {
    _revealed = false
    renderGrid()
  })
}

function renderGrid() {
  const grid    = document.getElementById('props-grid')
  const btnMore = document.getElementById('btn-view-more')
  const countEl = document.getElementById('props-count')
  const noteEl  = document.getElementById('rent-sort-note')
  if (!grid) return

  const lang = (typeof getLang === 'function') ? getLang() : 'en'
  const t    = k => window.I18N?.[lang]?.[k] || window.I18N?.en?.[k] || k

  const items   = _getFiltered()
  const limit   = (_isDesktop() && !_revealed) ? DESKTOP_LIMIT : items.length
  const shown   = items.slice(0, limit)
  const hiddenN = items.length - shown.length

  /* Empty state */
  if (!items.length) {
    grid.innerHTML = '<p class="grid-empty">No properties match this filter.</p>'
    if (btnMore) btnMore.hidden = true
    if (countEl) countEl.textContent = ''
    if (noteEl)  noteEl.style.display = 'none'
    return
  }

  grid.innerHTML = shown.map(function(l) { return renderCard(l) }).join('')

  /* Result count */
  if (countEl) {
    const available = items.filter(l => l.stage !== 'sold').length
    const soldCount = items.filter(l => l.stage === 'sold').length
    var parts = []
    if (available) parts.push(available + ' ' + t('prop.for_sale').toLowerCase().replace('for ', 'available ').split(' ').slice(0,1).join('') + (available === 1 ? ' available' : ' available'))
    if (soldCount) parts.push(soldCount + ' sold')
    /* simpler: just show numbers */
    var countParts = []
    if (available) countParts.push(available + ' available')
    if (soldCount) countParts.push(soldCount + ' sold')
    countEl.textContent = countParts.join(' · ')
  }

  /* View-more button */
  if (btnMore) {
    if (hiddenN > 0 && _isDesktop()) {
      btnMore.hidden = false
      btnMore.textContent = hiddenN + (hiddenN === 1 ? ' property' : ' properties') + ' more →'
    } else {
      btnMore.hidden = true
    }
  }

  /* Rent/sale price sort note */
  if (noteEl) {
    const hasMixed = _activeFilter === 'all' && _activeSort !== 'default'
    noteEl.style.display = hasMixed ? '' : 'none'
    if (hasMixed) noteEl.textContent = '* Rental prices (€/mo) and sale prices are sorted within availability groups.'
  }
}

function _renderWithFade(fn) {
  const grid = document.getElementById('props-grid')
  if (!grid) { fn(); return }
  grid.classList.add('is-fading')
  setTimeout(function() {
    fn()
    grid.classList.remove('is-fading')
  }, 140)
}

function formatBuiltArea(listing) {
  if (window.AN_FMT && window.AN_FMT.formatArea) return window.AN_FMT.formatArea(listing)
  const s = listing.size
  if (s === undefined || s === null || String(s).trim() === '') return ''
  if (listing.sizeUnit === 'sqft') return escHtml(String(s)) + ' sq ft'
  return escHtml(String(s)) + ' m²'
}

function renderCard(listing) {
  const lang     = (typeof getLang === 'function') ? getLang() : (localStorage.getItem('an_lang') || 'en')
  const L        = (window.I18N && window.I18N[lang]) || (window.I18N && window.I18N.en) || {}
  const tr       = (listing.translations && listing.translations[lang]) || {}
  const title    = tr.title || listing.title
  const stage    = listing.stage || (listing.sold ? 'sold' : (listing.published ? 'active' : 'draft'))
  const isSold   = stage === 'sold'
  const isReserved = stage === 'reserved'
  const isRent   = listing.type === 'rent' || listing.status === 'rent'
  const tagClass = isSold ? 'sold' : (isReserved ? 'reserved' : (isRent ? 'rent' : 'sale'))
  const tagLabel = isSold
    ? (L['prop.sold']     || 'Sold')
    : isReserved ? (L['prop.reserved'] || 'Reserved')
    : (isRent ? (L['prop.for_rent'] || 'For Rent') : (L['prop.for_sale'] || 'For Sale'))
  const priceHTML = isRent
    ? `${listing.price}<small>/mo</small>`
    : listing.price
  const propType  = listing.badge_type || listing.propertyType || ''
  const listType  = listing.type === 'rent' || listing.status === 'rent' ? 'rent' : 'sale'
  const dataType  = `${listType} ${propType}`
  const href      = `property.html?slug=${listing.slug || ''}`

  const BADGE_LABELS = {
    new:      { en: 'New',             es: 'Nueva',         ca: 'Nova',           fr: 'Nouveau',      de: 'Neu',         it: 'Nuovo',          ru: 'Новый' },
    exclusive:{ en: 'Exclusive',       es: 'Exclusiva',     ca: 'Exclusiva',      fr: 'Exclusif',     de: 'Exklusiv',    it: 'Esclusiva',      ru: 'Эксклюзив' },
    reduced:  { en: 'Reduced',         es: 'Precio reducido',ca:'Preu reduït',    fr: 'Prix réduit',  de: 'Reduziert',   it: 'Ridotto',        ru: 'Снижение' },
    offmarket:{ en: 'Off-market',      es: 'Fuera mercado', ca: 'Fora mercat',    fr: 'Hors marché',  de: 'Off-market',  it: 'Fuori mercato',  ru: 'Off-market' },
    new_dev:  { en: 'New Development', es: 'Obra Nueva',    ca: 'Nova Construcció', fr: 'Programme Neuf', de: 'Neubau',  it: 'Nuova Costruzione', ru: 'Новостройка' },
  }
  const badgeMap  = listing.badge ? BADGE_LABELS[listing.badge] : null
  const badgeText = badgeMap ? (badgeMap[lang] || badgeMap.en) : null
  const badgeHTML = badgeText ? `<span class="prop-badge prop-badge--${escHtml(listing.badge)}">${badgeText}</span>` : ''

  const isDev    = listing.propertyType === 'development'
  const devHref  = `development.html?slug=${listing.slug || ''}`
  const cardHref = isDev ? devHref : href
  const cardType = isDev ? `development ${listType}` : dataType

  const specsHTML = isDev
    ? `<p class="prop-specs prop-specs--dev">${listing.totalFloors ? listing.totalFloors + ' floors' : ''} ${listing.totalFloors && listing.totalUnits ? '&nbsp;·&nbsp;' : ''} ${listing.totalUnits ? listing.totalUnits + ' residences' : ''} &nbsp;·&nbsp; ${listing.constructionStatus || 'Pre-construction'}</p>`
    : `<p class="prop-specs">${propType ? escHtml(propType) + ' &nbsp;·&nbsp; ' : ''}${escHtml(String(listing.beds))} ${L['card.bed']||'bed'} &nbsp;·&nbsp; ${escHtml(String(listing.baths))} ${L['card.bath']||'bath'} &nbsp;·&nbsp; ${formatBuiltArea(listing)}</p>`

  const imgHTML = listing.image
    ? `<img src="${escHtml(listing.image)}" alt="${escHtml(listing.title)}" class="prop-img" loading="lazy" />`
    : `<div class="prop-img prop-img--placeholder"></div>`

  const soldClass = isSold ? ' is-sold' : ''

  return `
    <a href="${escHtml(cardHref)}" class="prop-card${isDev ? ' prop-card--dev' : ''}${soldClass}" data-type="${escHtml(cardType)}">
      <div class="prop-img-wrap">
        ${imgHTML}
        <span class="prop-tag ${tagClass}">${escHtml(tagLabel)}</span>
        ${badgeHTML}
      </div>
      <div class="prop-info">
        <div class="prop-meta">
          <span class="prop-loc">${escHtml(listing.neighbourhood)}</span>
          <span class="prop-price">${priceHTML}</span>
        </div>
        <h3 class="prop-title">${escHtml(title)}</h3>
        ${specsHTML}
      </div>
    </a>`
}

function initFilters() {
  const ftabs = document.querySelectorAll('.ftab')
  if (!ftabs.length) return

  ftabs.forEach(tab => {
    tab.addEventListener('click', () => {
      ftabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      _activeFilter = tab.dataset.filter
      _revealed = false
      _renderWithFade(renderGrid)
    })
  })
}

function initSort() {
  const sel = document.getElementById('props-sort')
  if (!sel) return
  sel.addEventListener('change', function() {
    _activeSort = sel.value
    _renderWithFade(renderGrid)
  })

  const btnMore = document.getElementById('btn-view-more')
  if (btnMore) {
    btnMore.addEventListener('click', function() {
      _revealed = true
      _renderWithFade(renderGrid)
    })
  }
}

/* Re-render cards when language changes */
window.addEventListener('an:langchange', function() {
  /* also update sort option text via applyI18n — then re-render */
  renderGrid()
})

initListings()
