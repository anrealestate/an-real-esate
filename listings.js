/* ================================
   Listings — fetch & render
   ================================ */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

var cachedListings = []

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
      if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status}`)
      const data = await res.json()
      listings = Array.isArray(data) ? data : (data.listings || [])
    } catch { return }
  }

  cachedListings = listings
    .filter(l => ['active', 'reserved', 'sold'].includes(l.stage) || l.published)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  if (!cachedListings.length) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:var(--fs-xs);letter-spacing:.06em;">No listings available at this time.</p>'
    return
  }

  renderGrid()
  initFilters()
}

function renderGrid() {
  const grid = document.getElementById('props-grid')
  if (!grid || !cachedListings.length) return
  grid.innerHTML = cachedListings.map(renderCard).join('')
  // Re-apply active filter if one is set
  const activeTab = document.querySelector('.ftab.active')
  if (activeTab && activeTab.dataset.filter !== 'all') {
    const f = activeTab.dataset.filter
    grid.querySelectorAll('.prop-card').forEach(c => {
      c.classList.toggle('hidden', !(c.dataset.type ?? '').includes(f))
    })
  }
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
  const propType   = listing.badge_type || listing.propertyType || ''
  const listType  = listing.type === 'rent' || listing.status === 'rent' ? 'rent' : 'sale'
  const dataType  = `${listType} ${propType}`
  const href      = `property.html?slug=${listing.slug || ''}`

  const BADGE_LABELS = {
    new:      { en: 'New',        es: 'Nueva',         ca: 'Nova',      fr: 'Nouveau',  de: 'Neu',         it: 'Nuovo',     ru: 'Новый' },
    exclusive:{ en: 'Exclusive',  es: 'Exclusiva',     ca: 'Exclusiva', fr: 'Exclusif', de: 'Exklusiv',    it: 'Esclusiva', ru: 'Эксклюзив' },
    reduced:  { en: 'Reduced',    es: 'Precio reducido',ca:'Preu reduït',fr: 'Prix réduit',de:'Reduziert',  it: 'Ridotto',   ru: 'Снижение' },
    offmarket:{ en: 'Off-market', es: 'Fuera mercado', ca: 'Fora mercat',fr:'Hors marché',de:'Off-market', it: 'Fuori mercato', ru: 'Off-market' },
  }
  const badgeMap = listing.badge ? BADGE_LABELS[listing.badge] : null
  const badgeText = badgeMap ? (badgeMap[lang] || badgeMap.en) : null
  const badgeHTML = badgeText ? `<span class="prop-badge prop-badge--${listing.badge}">${badgeText}</span>` : ''

  return `
    <a href="${escHtml(href)}" class="prop-card" data-type="${escHtml(dataType)}">
      <div class="prop-img-wrap">
        <img src="${escHtml(listing.image)}" alt="${escHtml(listing.title)}" class="prop-img" loading="lazy" />
        <span class="prop-tag ${tagClass}">${escHtml(tagLabel)}</span>
        ${badgeHTML}
      </div>
      <div class="prop-info">
        <div class="prop-meta">
          <span class="prop-loc">${escHtml(listing.neighbourhood)}</span>
          <span class="prop-price">${priceHTML}</span>
        </div>
        <h3 class="prop-title">${escHtml(title)}</h3>
        <p class="prop-specs">${propType ? escHtml(propType) + ' &nbsp;·&nbsp; ' : ''}${escHtml(String(listing.beds))} ${L['card.bed']||'bed'} &nbsp;·&nbsp; ${escHtml(String(listing.baths))} ${L['card.bath']||'bath'} &nbsp;·&nbsp; ${escHtml(String(listing.size))} m²</p>
      </div>
    </a>`
}

function initFilters() {
  const ftabs = document.querySelectorAll('.ftab')
  const grid  = document.getElementById('props-grid')
  if (!ftabs.length || !grid) return

  ftabs.forEach(tab => {
    tab.addEventListener('click', () => {
      ftabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const f = tab.dataset.filter
      grid.querySelectorAll('.prop-card').forEach(c => {
        c.classList.toggle('hidden', f !== 'all' && !(c.dataset.type ?? '').includes(f))
      })
    })
  })
}

// Re-render cards when language changes
window.addEventListener('an:langchange', function() {
  renderGrid()
})

initListings()
