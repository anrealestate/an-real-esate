/* ================================
   Listings — fetch & render
   ================================ */
async function initListings() {
  const grid = document.getElementById('props-grid')
  if (!grid) return

  let listings = []

  try {
    const res = await fetch('/data/listings.json')
    if (!res.ok) throw new Error('fetch failed')
    const data = await res.json()
    listings = Array.isArray(data) ? data : (data.listings || [])
  } catch {
    // Running locally via file:// — grid stays empty, no error thrown
    return
  }

  const published = listings.filter(l => l.published)

  if (!published.length) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:var(--fs-xs);letter-spacing:.06em;">No listings available at this time.</p>'
    return
  }

  grid.innerHTML = published.map(renderCard).join('')
  initFilters()
}

function renderCard(listing) {
  const isRent    = listing.status === 'rent'
  const tagClass  = isRent ? 'rent' : 'sale'
  const tagLabel  = isRent ? 'For Rent' : 'For Sale'
  const priceHTML = isRent
    ? `${listing.price}<small>/mo</small>`
    : listing.price
  const dataType  = `${listing.status} ${listing.type}`

  return `
    <a href="property.html" class="prop-card" data-type="${dataType}">
      <div class="prop-img-wrap">
        <img src="${listing.image}" alt="${listing.title}" class="prop-img" loading="lazy" />
        <span class="prop-tag ${tagClass}">${tagLabel}</span>
      </div>
      <div class="prop-info">
        <div class="prop-meta">
          <span class="prop-loc">${listing.neighbourhood}</span>
          <span class="prop-price">${priceHTML}</span>
        </div>
        <h3 class="prop-title">${listing.title}</h3>
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

initListings()
