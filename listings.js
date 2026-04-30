/* ================================
   Listings — fetch & render
   ================================ */
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
      if (!res.ok) throw new Error()
      const data = await res.json()
      listings = Array.isArray(data) ? data : (data.listings || [])
    } catch { return }
  }

  cachedListings = listings.filter(l => ['active', 'reserved', 'sold'].includes(l.stage) || l.published)

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
  const propType  = listing.propertyType || listing.type || ''
  const listType  = listing.type === 'rent' || listing.status === 'rent' ? 'rent' : 'sale'
  const dataType  = `${listType} ${propType}`
  const href      = `property.html?slug=${listing.slug || ''}`

  const BADGE_LABELS = { new: 'Nueva', exclusive: 'Exclusiva', reduced: 'Precio reducido', offmarket: 'Off-market' }
  const badgeHTML = listing.badge ? `<span class="prop-badge prop-badge--${listing.badge}">${BADGE_LABELS[listing.badge] || listing.badge}</span>` : ''

  return `
    <a href="${href}" class="prop-card" data-type="${dataType}">
      <div class="prop-img-wrap">
        <img src="${listing.image}" alt="${listing.title}" class="prop-img" loading="lazy" />
        <span class="prop-tag ${tagClass}">${tagLabel}</span>
        ${badgeHTML}
      </div>
      <div class="prop-info">
        <div class="prop-meta">
          <span class="prop-loc">${listing.neighbourhood}</span>
          <span class="prop-price">${priceHTML}</span>
        </div>
        <h3 class="prop-title">${title}</h3>
        <p class="prop-specs">${listing.beds} bed &nbsp;·&nbsp; ${listing.baths} bath &nbsp;·&nbsp; ${listing.size} m²</p>
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
