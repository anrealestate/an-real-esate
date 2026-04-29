/* =============================================
   AN Real Estate — Admin Panel
   ============================================= */

const ADMIN_PASSWORD    = 'ANadmin2026'  // cambia esto en producción
const DATA_URL          = '/data/listings.json'
const SESSION_KEY       = 'an_admin_auth'
const CLD_CLOUD         = 'dbume3eak'
const CLD_PRESET        = 'f3eiclx5'
const CLD_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`
const MEDIA_KEY         = 'an_media_library'
const VISITS_KEY        = 'an_visits'

let _listings    = []
let _editSlug    = null
let _filter      = 'all'
let _wmPosition  = 'bottom-left'
let _mediaItems  = []
let _wmProcessed = []
let _visitSort   = 'date'
let _visitSortDir = -1

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
    showApp()
  }

  document.getElementById('login-form').addEventListener('submit', handleLogin)
  document.getElementById('logout-btn').addEventListener('click', logout)
  document.getElementById('export-btn').addEventListener('click', exportJSON)
  document.getElementById('btn-new-prop').addEventListener('click', () => showForm(null))
  document.getElementById('btn-add-new')?.addEventListener('click', () => showForm(null))
  document.getElementById('btn-back').addEventListener('click', showPropsList)
  document.getElementById('btn-save').addEventListener('click', saveProperty)
  document.getElementById('btn-delete').addEventListener('click', confirmDelete)
  document.getElementById('btn-translate').addEventListener('click', translateListing)

  // Sidebar nav
  document.querySelectorAll('.sb-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const view = link.dataset.view
      if (view === 'new') { showForm(null); return }
      switchView(view)
      document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'))
      link.classList.add('active')
      if (view === 'visits') initVisits()
    })
  })

  // Filter chips
  document.querySelectorAll('.fchip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      _filter = chip.dataset.f
      renderTable()
    })
  })

  // Form tabs
  document.querySelectorAll('.ftab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active', 'hidden'))
      tab.classList.add('active')
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active')
    })
  })

  // Dynamic list add buttons
  document.getElementById('add-gallery-url').addEventListener('click', () => addGalleryCard())
  document.getElementById('add-para').addEventListener('click', () => addDescRow())
  document.getElementById('add-detail').addEventListener('click', () => addDetailRow())
  document.getElementById('add-feat-cat').addEventListener('click', () => addFeatCat())
  document.getElementById('add-nearby').addEventListener('click', () => addNearbyRow())

  // (imagen principal managed via gallery grid — no separate preview button)

  // Slug auto-gen from title
  document.getElementById('f-title').addEventListener('input', autoSlug)

  // Watermark tool
  initWatermarkTool()

  // (upload-main-file removed — use gallery upload instead)

  // Upload: gallery (multiple)
  document.getElementById('upload-gallery-files').addEventListener('change', async e => {
    const files = [...e.target.files]; if (!files.length) return
    const total = files.length
    for (let i = 0; i < files.length; i++) {
      document.getElementById('upload-gallery-status').textContent = `Subiendo ${i+1} de ${total}…`
      const url = await uploadFile(files[i], 'upload-gallery-progress', 'upload-gallery-fill', 'upload-gallery-status')
      if (url) { addGalleryCard({ src: url, alt: files[i].name.replace(/\.[^.]+$/, '') }); saveToMediaLibrary(url, files[i].name) }
    }
    document.getElementById('upload-gallery-progress').classList.add('hidden')
    toast(`${total} imagen${total>1?'es':''} subida${total>1?'s':''}`, 'success')
    e.target.value = ''
  })

  // Upload: media repository
  document.getElementById('media-upload-input').addEventListener('change', async e => {
    const files = [...e.target.files]; if (!files.length) return
    const total = files.length
    document.getElementById('media-progress').classList.remove('hidden')
    for (let i = 0; i < files.length; i++) {
      document.getElementById('media-progress-status').textContent = `Subiendo ${i+1} de ${total}…`
      setProgress('media-progress-fill', Math.round((i/total)*100))
      const url = await uploadFile(files[i], null, null, null)
      if (url) saveToMediaLibrary(url, files[i].name)
    }
    setProgress('media-progress-fill', 100)
    document.getElementById('media-progress-status').textContent = `${total} imagen${total>1?'es':''} subida${total>1?'s':''}`
    setTimeout(() => document.getElementById('media-progress').classList.add('hidden'), 2000)
    renderMediaGrid()
    toast(`${total} imagen${total>1?'es':''} subida${total>1?'s':''}`, 'success')
    e.target.value = ''
  })

  // Confirm dialog
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.add('hidden')
  })
})

// ── AUTH ──────────────────────────────────────
function handleLogin(e) {
  e.preventDefault()
  const val = document.getElementById('pwd-input').value
  if (val === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, 'ok')
    document.getElementById('login-error').classList.add('hidden')
    showApp()
  } else {
    document.getElementById('login-error').classList.remove('hidden')
    document.getElementById('pwd-input').value = ''
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY)
  document.getElementById('app').classList.add('hidden')
  document.getElementById('login-screen').classList.remove('hidden')
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden')
  document.getElementById('app').classList.remove('hidden')
  loadData()
  loadMediaLibrary()
  handleVisitParam()
}

function handleVisitParam() {
  const params = new URLSearchParams(location.search)
  const raw = params.get('visit')
  if (!raw) return
  try {
    const json = decodeURIComponent(escape(atob(raw)))
    const record = JSON.parse(json)
    record.id = Date.now() + '-' + Math.random().toString(36).slice(2, 7)
    const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]')
    const isDup = visits.some(v => v.timestamp === record.timestamp && v.docNum === record.docNum)
    if (!isDup) {
      visits.unshift(record)
      localStorage.setItem(VISITS_KEY, JSON.stringify(visits))
    }
    history.replaceState({}, '', location.pathname)
    switchView('visits')
    document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view === 'visits'))
    initVisits()
  } catch (e) {
    console.error('Error al guardar visita:', e)
    alert('Error al procesar el enlace de visita. Comprueba la consola.')
  }
}

// ── DATA ──────────────────────────────────────
function loadData() {
  const el = document.getElementById('listings-data')
  if (el) {
    try { _listings = JSON.parse(el.textContent).listings || [] } catch {}
  }

  // Merge admin-only fields (address, etc.) from cache — the static JSON never has them
  try {
    const prev = JSON.parse(localStorage.getItem('an_listings_cache') || '{}').listings || []
    if (prev.length) {
      if (!_listings.length) {
        _listings = prev
      } else {
        _listings.forEach(l => {
          const p = prev.find(c => c.slug === l.slug)
          if (p?.address) l.address = p.address
        })
      }
    }
  } catch {}

  if (_listings.length) cacheListings()
  renderTable()
  updateSummary()
}

function updateSummary() {
  const total = _listings.length
  const active = _listings.filter(l => l.published && !l.sold).length
  const sold = _listings.filter(l => l.sold).length
  document.getElementById('props-summary').textContent =
    `${total} propiedades · ${active} activas · ${sold} vendidas`
}

// ── TABLE ─────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('prop-tbody')
  let filtered = [..._listings]

  if (_filter === 'sale')  filtered = filtered.filter(l => l.status === 'sale' && !l.sold)
  if (_filter === 'rent')  filtered = filtered.filter(l => l.status === 'rent' && !l.sold)
  if (_filter === 'sold')  filtered = filtered.filter(l => l.sold)
  if (_filter === 'draft') filtered = filtered.filter(l => !l.published)

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted);font-size:.82rem;">Sin resultados</td></tr>`
    return
  }

  tbody.innerHTML = filtered.map(l => {
    const typeLabel = { apartment:'Apartamento', villa:'Villa', house:'Casa', penthouse:'Ático', townhouse:'Adosado', office:'Oficina' }[l.type] || l.type
    const statusBadge = l.status === 'rent'
      ? `<span class="badge badge-rent">Alquiler</span>`
      : l.type === 'villa' ? `<span class="badge badge-villa">Villa</span>`
      : `<span class="badge badge-sale">Venta</span>`

    return `
    <tr data-slug="${l.slug}">
      <td><img class="pt-thumb" src="${l.image || ''}" alt="" onerror="this.style.display='none'" /></td>
      <td>
        <div class="pt-title">${l.title}</div>
        <div class="pt-loc">${l.neighbourhood || ''}</div>
      </td>
      <td class="pt-price">${l.price || '—'}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="row-toggle" title="${l.published ? 'Ocultar' : 'Publicar'}" onclick="quickToggle('${l.slug}','published')">
          <span class="rt-dot ${l.published ? 'on' : 'off'}"></span>
        </button>
      </td>
      <td>
        <button class="row-toggle" title="${l.sold ? 'Marcar disponible' : 'Marcar vendida'}" onclick="quickToggle('${l.slug}','sold')">
          <span class="rt-dot ${l.sold ? 'on' : 'off'}"></span>
        </button>
      </td>
      <td>
        <div class="row-actions">
          <button class="act-btn act-edit" title="Editar" onclick="showForm('${l.slug}')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="act-btn act-del" title="Eliminar" onclick="confirmDelete('${l.slug}')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`
  }).join('')
}

function quickToggle(slug, field) {
  const l = _listings.find(x => x.slug === slug)
  if (!l) return
  l[field] = !l[field]
  renderTable()
  updateSummary()
  cacheListings()
  toast(`${field === 'published' ? (l[field] ? 'Publicada' : 'Ocultada') : (l[field] ? 'Marcada vendida' : 'Marcada disponible')}`, 'success')
}

// ── FORM ──────────────────────────────────────
function showForm(slug) {
  try { _showForm(slug) } catch(e) { console.error('[showForm error]', e); alert('Error al abrir formulario: ' + e.message) }
}
function _showForm(slug) {
  _editSlug = slug
  const isNew = slug === null
  const l = isNew ? {} : (_listings.find(x => x.slug === slug) || {})

  document.getElementById('form-title').textContent = isNew ? 'Nueva propiedad' : l.title || 'Editar propiedad'
  document.getElementById('btn-delete').style.display = isNew ? 'none' : ''

  // Reset tabs
  document.querySelectorAll('.ftab').forEach((t, i) => t.classList.toggle('active', i === 0))
  document.querySelectorAll('.tab-panel').forEach((p, i) => {
    p.classList.remove('hidden')
    p.classList.toggle('active', i === 0)
  })

  // Basic
  document.getElementById('f-original-slug').value = l.slug || ''
  document.getElementById('f-title').value         = l.title || ''
  document.getElementById('f-slug').value          = l.slug || ''
  document.getElementById('f-ref').value           = l.ref || ''

  // Price: parse "€830,000" or "€7,700/mes" back into num + postfix
  const _priceStr = l.price || ''
  const _pricePostfixMatch = _priceStr.match(/(\/\S+)$/)
  document.getElementById('f-price-num').value     = _priceStr.replace(/^€/, '').replace(/(\/\S+)$/, '').trim()
  document.getElementById('f-price-postfix').value = _pricePostfixMatch ? _pricePostfixMatch[1] : ''

  // Neighbourhood: try exact match, fallback keeps value
  const _nbEl = document.getElementById('f-neighbourhood')
  _nbEl.value = l.neighbourhood || ''
  if (!_nbEl.value && l.neighbourhood) {
    const _opt = document.createElement('option')
    _opt.value = l.neighbourhood; _opt.textContent = l.neighbourhood
    _nbEl.appendChild(_opt); _nbEl.value = l.neighbourhood
  }

  const _storedAddrs = JSON.parse(localStorage.getItem('an_addresses') || '{}')
  document.getElementById('f-address').value       = l.address || _storedAddrs[l.slug] || ''
  document.getElementById('f-zip').value           = l.zip || ''
  document.getElementById('f-type').value          = l.type || 'apartment'

  const _statusRadio = document.querySelector(`input[name="f-status"][value="${l.status || 'sale'}"]`)
  if (_statusRadio) _statusRadio.checked = true

  document.getElementById('f-badge-type').value    = l.badge_type || ''
  document.getElementById('f-beds').value          = String(l.beds ?? 2)
  document.getElementById('f-baths').value         = String(l.baths ?? 1)
  document.getElementById('f-size').value          = l.size || ''
  document.getElementById('f-land').value          = l.land || ''
  document.getElementById('f-garage').value        = l.garage || ''
  document.getElementById('f-floor').value         = l.floor || ''
  document.getElementById('f-year').value          = l.year || ''
  document.getElementById('f-year-renovated').value = l.year_renovated || ''
  document.getElementById('f-condition').value     = l.condition || ''
  document.getElementById('f-energy').value        = l.energy || ''
  document.getElementById('f-published').checked   = l.published !== false
  document.getElementById('f-sold').checked        = l.sold === true

  // Init Google Maps autocomplete on address field (once)
  initAddressAutocomplete()

  // Gallery — ALL images including main (first card = main)
  const galleryEl = document.getElementById('gallery-list')
  galleryEl.innerHTML = ''
  ;(l.images || (l.image ? [{ src: l.image, alt: l.title }] : [])).forEach(img => addGalleryCard(img))
  refreshGalleryBadges()

  // Description
  const descEl = document.getElementById('desc-list')
  descEl.innerHTML = ''
  ;(Array.isArray(l.description) ? l.description : l.description ? [l.description] : []).forEach(p => addDescRow(p))

  // Details
  const detailsEl = document.getElementById('details-list')
  detailsEl.innerHTML = ''
  ;(l.details || []).forEach(d => addDetailRow(d))

  // Features: check matching checkboxes, put extras in custom textarea
  document.querySelectorAll('#tab-feats input[type=checkbox]').forEach(cb => cb.checked = false)
  document.getElementById('f-feats-custom').value = ''
  if (l.features) {
    const allItems = Object.values(l.features).flat()
    const checkboxValues = new Set([...document.querySelectorAll('#tab-feats input[type=checkbox]')].map(cb => cb.value))
    const unmatched = []
    allItems.forEach(item => {
      const cb = document.querySelector(`#tab-feats input[type=checkbox][value="${CSS.escape(item)}"]`)
      if (cb) cb.checked = true
      else if (!checkboxValues.has(item)) unmatched.push(item)
    })
    if (unmatched.length) document.getElementById('f-feats-custom').value = unmatched.join('\n')
  }

  // Nearby
  const nearbyEl = document.getElementById('nearby-list')
  nearbyEl.innerHTML = ''
  ;(l.nearby || []).forEach(n => addNearbyRow(n))

  // Existing translations
  document.getElementById('f-translations').value = l.translations ? JSON.stringify(l.translations) : ''

  switchView('form')
} // end _showForm

function showPropsList() {
  switchView('props')
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view === 'props'))
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'hidden'))
  document.getElementById('view-' + name)?.classList.add('active')
}

// ── SAVE ──────────────────────────────────────
function saveProperty() {
  const slug = document.getElementById('f-slug').value.trim()
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  if (!slug) { toast('El slug es obligatorio', 'error'); return }

  const original = document.getElementById('f-original-slug').value

  // Check slug conflict
  if (slug !== original && _listings.find(l => l.slug === slug)) {
    toast('Ya existe una propiedad con ese slug', 'error'); return
  }

  // Build description
  const descRows = document.querySelectorAll('#desc-list .desc-textarea')
  const description = [...descRows].map(t => t.value.trim()).filter(Boolean)

  // Build gallery — all cards in order; first visible = main image
  const galCards = [...document.querySelectorAll('#gallery-list .gal-card')]
  const images = galCards
    .map(card => {
      const src = (card.dataset.src || '').trim()
      if (!src) return null
      const alt = card.querySelector('.gal-card-alt')?.value.trim() || document.getElementById('f-title').value
      const hidden = card.dataset.hidden === 'true'
      return { src, alt, ...(hidden ? { hidden: true } : {}) }
    })
    .filter(Boolean)
  const firstVisible = images.find(img => !img.hidden)
  const mainImage = firstVisible?.src || images[0]?.src || ''
  document.getElementById('f-image').value = mainImage

  // Build details
  const detailRows = document.querySelectorAll('#details-list .detail-row')
  const details = [...detailRows].map(r => ({
    key: r.querySelector('.det-key').value.trim(),
    val: r.querySelector('.det-val').value.trim()
  })).filter(d => d.key)

  // Build features from checkboxes grouped by category
  const FEAT_CATS = {
    'Interior':       ['High Ceilings','Vaulted Ceiling(s)','Volta Catalana','Ceilings with moldings','Open Floorplan','Natural Light','Period Features','French Doors','Sliding Doors','Walk-In Closet(s)','Walk-in wardrobe(s)','Library','Playroom','Utility room','Storage','Split Bedroom'],
    'Flooring':       ['Solid Wooden Floor','Wooden Flooring','Marble Flooring','Ceramic Tile Flooring','Mosaic tile flooring'],
    'Kitchen':        ['Equipped Kitchen','Open kitchen','Oven','Convection Oven','Refrigerator','Dishwasher','Microwave','Freezer','Wine Refrigerator','Range Hood','Exhaust Fan','Wet Bar','Solid Surface Counters','Stone Counters','Solid Wood Cabinets'],
    'Climate':        ['Air conditioning','Heating','Electric Water Heater','Gas Water Heater','Tankless Water Heater','Thermostat','Central Vaccum','Washer','Dryer','Water Filtration System','Water Purifier','Water Softener'],
    'Outdoor':        ['Balcony','Terrace','Communal terrace','Garden','Outdoor Kitchen','Outdoor Shower','Swimming Pool','Sauna','Chill out area','Barbaque','Fence','Tennis Court(s)','Parking'],
    'Building':       ['Elevator','Concierge Service','Modernist building','Alarm','Double Glazing','Exterior','Sidewalk'],
    'Views':          ['City Views','Sea Views','Transport Nearby','Renovated']
  }
  const checkedValues = new Set([...document.querySelectorAll('#tab-feats input[type=checkbox]:checked')].map(cb => cb.value))
  const features = {}
  Object.entries(FEAT_CATS).forEach(([cat, items]) => {
    const matched = items.filter(i => checkedValues.has(i))
    if (matched.length) features[cat] = matched
  })
  const customRaw = document.getElementById('f-feats-custom').value.trim()
  if (customRaw) {
    features['Additional'] = customRaw.split('\n').map(s => s.trim()).filter(Boolean)
  }

  // Build nearby
  const nearbyRows = document.querySelectorAll('#nearby-list .nearby-row')
  const nearby = [...nearbyRows].map(r => ({
    name: r.querySelector('.nb-name').value.trim(),
    dist: r.querySelector('.nb-dist').value.trim()
  })).filter(n => n.name)

  // Price
  const _priceNum = document.getElementById('f-price-num').value.trim()
  const _pricePost = document.getElementById('f-price-postfix').value
  const price = _priceNum ? `€${_priceNum}${_pricePost}` : ''

  // Status from radio
  const _statusChecked = document.querySelector('input[name="f-status"]:checked')
  const status = _statusChecked ? _statusChecked.value : 'sale'

  // Badge type auto from type
  const BADGE_MAP = { apartment:'Apartment', penthouse:'Penthouse', villa:'Villa', house:'House', townhouse:'Townhouse', studio:'Studio', office:'Office', land:'Land' }
  const type = document.getElementById('f-type').value
  const badge_type = BADGE_MAP[type] || type.charAt(0).toUpperCase() + type.slice(1)

  const listing = {
    slug,
    title:         document.getElementById('f-title').value.trim(),
    price,
    ref:           document.getElementById('f-ref').value.trim(),
    neighbourhood: document.getElementById('f-neighbourhood').value.trim(),
    address:       document.getElementById('f-address').value.trim() || undefined,
    zip:           document.getElementById('f-zip').value.trim() || undefined,
    type,
    status,
    badge_type,
    beds:          parseInt(document.getElementById('f-beds').value) || 0,
    baths:         parseInt(document.getElementById('f-baths').value) || 0,
    size:          document.getElementById('f-size').value.trim(),
    land:          document.getElementById('f-land').value.trim() || undefined,
    garage:        document.getElementById('f-garage').value || undefined,
    floor:         document.getElementById('f-floor').value || undefined,
    year:          document.getElementById('f-year').value ? parseInt(document.getElementById('f-year').value) : undefined,
    year_renovated:document.getElementById('f-year-renovated').value ? parseInt(document.getElementById('f-year-renovated').value) : undefined,
    condition:     document.getElementById('f-condition').value || undefined,
    energy:        document.getElementById('f-energy').value || undefined,
    image:        mainImage || undefined,
    images:       images.length ? images : undefined,
    description:  description.length ? description : undefined,
    details:      details.length ? details : undefined,
    features:     Object.keys(features).length ? features : undefined,
    nearby:       nearby.length ? nearby : undefined,
    published:    document.getElementById('f-published').checked,
    sold:         document.getElementById('f-sold').checked || undefined,
    translations: (() => { try { const v = document.getElementById('f-translations').value; return v ? JSON.parse(v) : undefined } catch { return undefined } })(),
  }

  // Remove undefined keys
  Object.keys(listing).forEach(k => listing[k] === undefined && delete listing[k])

  if (original) {
    const idx = _listings.findIndex(l => l.slug === original)
    if (idx !== -1) _listings[idx] = listing
    else _listings.push(listing)
  } else {
    _listings.push(listing)
  }

  // Save address separately so it survives page reloads (read directly from field, not from listing object)
  try {
    const rawAddr = document.getElementById('f-address').value.trim()
    const addrs = JSON.parse(localStorage.getItem('an_addresses') || '{}')
    if (rawAddr) addrs[slug] = rawAddr
    else delete addrs[slug]
    localStorage.setItem('an_addresses', JSON.stringify(addrs))
  } catch {}

  cacheListings()
  toast('Propiedad guardada. Exporta el JSON para publicar.', 'success')
  showPropsList()
  renderTable()
  updateSummary()
}

// ── DELETE ────────────────────────────────────
let _deleteSlug = null

function confirmDelete(slug) {
  _deleteSlug = typeof slug === 'string' ? slug : _editSlug
  const l = _listings.find(x => x.slug === _deleteSlug)
  if (!l) return
  document.getElementById('confirm-msg').textContent = `¿Eliminar "${l.title}"? Esta acción no se puede deshacer.`
  document.getElementById('confirm-overlay').classList.remove('hidden')
  document.getElementById('confirm-ok').onclick = () => {
    _listings = _listings.filter(x => x.slug !== _deleteSlug)
    document.getElementById('confirm-overlay').classList.add('hidden')
    cacheListings()
    toast('Propiedad eliminada', 'success')
    showPropsList()
    renderTable()
    updateSummary()
  }
}

// ── GALLERY CARDS ─────────────────────────────
let _dragSrc = null

function galEyeIcon(isHidden) {
  return isHidden
    ? `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
}

function addGalleryCard(img = {}) {
  const src    = typeof img === 'string' ? img : (img.src || '')
  const alt    = typeof img === 'string' ? '' : (img.alt || '')
  const hidden = typeof img === 'string' ? false : (img.hidden === true)

  const card = document.createElement('div')
  card.className = 'gal-card' + (hidden ? ' is-hidden' : '')
  card.draggable = true
  card.dataset.src    = src
  card.dataset.hidden = hidden ? 'true' : 'false'

  const errSvg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='82'><rect width='110' height='82' fill='%23222'/><text x='55' y='46' font-size='10' fill='%23555' text-anchor='middle'>No img</text></svg>`

  card.innerHTML = `
    <div class="gal-card-img">
      ${src
        ? `<img src="${src}" alt="${alt}" onerror="this.src='${errSvg}'" />`
        : `<div class="gal-card-url-wrap"><input class="gal-card-url-input" type="text" placeholder="Pega URL…" /></div>`
      }
      <div class="gal-card-overlay">
        <button type="button" class="gal-cb gal-cb-hide" title="Ocultar">${galEyeIcon(hidden)}</button>
        <button type="button" class="gal-cb gal-cb-del" title="Eliminar">×</button>
      </div>
    </div>
    <input class="gal-card-alt" type="text" placeholder="Alt…" value="${alt}" />`

  // URL input → set src and swap to img
  const urlInput = card.querySelector('.gal-card-url-input')
  if (urlInput) {
    urlInput.addEventListener('blur', () => {
      const v = urlInput.value.trim()
      if (!v) return
      card.dataset.src = v
      card.querySelector('.gal-card-img').innerHTML = `
        <img src="${v}" alt="" onerror="this.src='${errSvg}'" />
        <div class="gal-card-overlay">
          <button type="button" class="gal-cb gal-cb-hide" title="Ocultar">${galEyeIcon(false)}</button>
          <button type="button" class="gal-cb gal-cb-del" title="Eliminar">×</button>
        </div>`
      bindGalCardBtns(card)
    })
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); urlInput.blur() } })
  }

  bindGalCardBtns(card)

  // Alt sync
  card.querySelector('.gal-card-alt').addEventListener('input', e => { card.dataset.alt = e.target.value })

  // Drag
  card.addEventListener('dragstart', e => {
    _dragSrc = card
    card.classList.add('is-dragging')
    e.dataTransfer.effectAllowed = 'move'
  })
  card.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (card !== _dragSrc) card.classList.add('drag-over')
    return false
  })
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'))
  card.addEventListener('drop', e => {
    e.stopPropagation()
    e.preventDefault()
    if (_dragSrc && _dragSrc !== card) {
      const list = document.getElementById('gallery-list')
      const cards = [...list.querySelectorAll('.gal-card')]
      const si = cards.indexOf(_dragSrc)
      const ti = cards.indexOf(card)
      list.insertBefore(_dragSrc, si < ti ? card.nextSibling : card)
    }
    card.classList.remove('drag-over')
  })
  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging')
    document.querySelectorAll('.gal-card').forEach(c => c.classList.remove('drag-over'))
    _dragSrc = null
    refreshGalleryBadges()
  })

  document.getElementById('gallery-list').appendChild(card)
  refreshGalleryBadges()
  if (urlInput) urlInput.focus()
}

function refreshGalleryBadges() {
  const cards = [...document.querySelectorAll('#gallery-list .gal-card')]
  cards.forEach((c, i) => {
    let badge = c.querySelector('.gal-badge-main')
    if (i === 0) {
      if (!badge) {
        badge = document.createElement('span')
        badge.className = 'gal-badge-main'
        badge.textContent = '★'
        c.querySelector('.gal-card-img').appendChild(badge)
      }
    } else {
      if (badge) badge.remove()
    }
  })
}

function bindGalCardBtns(card) {
  const btnDel = card.querySelector('.gal-cb-del')
  const btnHide = card.querySelector('.gal-cb-hide')
  if (btnDel) btnDel.onclick = e => { e.stopPropagation(); card.remove(); refreshGalleryBadges() }
  if (btnHide) btnHide.onclick = e => {
    e.stopPropagation()
    const isHidden = card.dataset.hidden === 'true'
    const next = !isHidden
    card.dataset.hidden = next ? 'true' : 'false'
    card.classList.toggle('is-hidden', next)
    btnHide.innerHTML = galEyeIcon(next)
    refreshGalleryBadges()
  }
}

function addDescRow(text = '') {
  const div = document.createElement('div')
  div.className = 'dyn-row'
  div.innerHTML = `
    <textarea class="desc-textarea" rows="3" placeholder="Párrafo de descripción…" style="flex:1">${text}</textarea>
    <button type="button" class="dyn-row-del" title="Eliminar">×</button>`
  div.querySelector('.dyn-row-del').onclick = () => div.remove()
  document.getElementById('desc-list').appendChild(div)
}

function addDetailRow(d = {}) {
  const div = document.createElement('div')
  div.className = 'dyn-row detail-row'
  div.innerHTML = `
    <input class="det-key" type="text" placeholder="Campo (ej: Superficie)" value="${d.key || ''}" style="flex:1" />
    <input class="det-val" type="text" placeholder="Valor (ej: 94 m²)" value="${d.val || ''}" style="flex:1" />
    <button type="button" class="dyn-row-del" title="Eliminar">×</button>`
  div.querySelector('.dyn-row-del').onclick = () => div.remove()
  document.getElementById('details-list').appendChild(div)
}

function addFeatCat(catName = '', items = []) {
  const div = document.createElement('div')
  div.className = 'feat-cat-row'
  div.innerHTML = `
    <div class="feat-cat-hd">
      <input class="feat-cat-name" type="text" placeholder="Nombre de categoría (ej: Interior)" value="${catName}" />
      <button type="button" class="dyn-row-del" title="Eliminar categoría">×</button>
    </div>
    <div class="feat-items"></div>
    <div class="feat-add-row">
      <input class="feat-new-item" type="text" placeholder="Nueva característica…" />
      <button type="button" class="btn-sm feat-add-btn">Añadir</button>
    </div>`

  div.querySelector('.dyn-row-del').onclick = () => div.remove()

  const addBtn  = div.querySelector('.feat-add-btn')
  const newItem = div.querySelector('.feat-new-item')
  const pillsEl = div.querySelector('.feat-items')

  const addPill = (text) => {
    if (!text.trim()) return
    const pill = document.createElement('span')
    pill.className = 'feat-pill'
    pill.innerHTML = `<span class="feat-pill-text">${text.trim()}</span><button type="button" class="feat-pill-del" title="Eliminar">×</button>`
    pill.querySelector('.feat-pill-del').onclick = () => pill.remove()
    pillsEl.appendChild(pill)
  }

  addBtn.onclick = () => { addPill(newItem.value); newItem.value = '' }
  newItem.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPill(newItem.value); newItem.value = '' } })

  items.forEach(addPill)
  document.getElementById('feats-list').appendChild(div)
}

function addNearbyRow(n = {}) {
  const div = document.createElement('div')
  div.className = 'dyn-row nearby-row'
  div.innerHTML = `
    <input class="nb-name" type="text" placeholder="Lugar (ej: Passeig de Gràcia)" value="${n.name || ''}" style="flex:2" />
    <input class="nb-dist" type="text" placeholder="Distancia (ej: 5 min walk)" value="${n.dist || ''}" style="flex:1" />
    <button type="button" class="dyn-row-del" title="Eliminar">×</button>`
  div.querySelector('.dyn-row-del').onclick = () => div.remove()
  document.getElementById('nearby-list').appendChild(div)
}

// (previewMainImage removed — gallery cards show thumbnails directly)

// ── SLUG AUTO-GEN ─────────────────────────────
let _titleChanged = false
function autoSlug() {
  const slugEl = document.getElementById('f-slug')
  if (slugEl.value && _titleChanged) return
  const title = document.getElementById('f-title').value
  slugEl.value = title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
  _titleChanged = false
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-slug')?.addEventListener('input', () => { _titleChanged = true })
})

// ── EXPORT JSON ───────────────────────────────
function exportJSON() {
  const jsonStr = JSON.stringify({ listings: _listings }, null, 2)

  // Download data/listings.json
  dlFile(jsonStr, 'listings.json', 'application/json')

  // Download data-listings.js (same data, wrapped in IIFE)
  const jsContent = `/* Shared listings data — auto-generated by admin panel */\n;(function () {\n  const el = document.getElementById('listings-data')\n  if (el) return\n  const s = document.createElement('script')\n  s.id   = 'listings-data'\n  s.type = 'application/json'\n  s.textContent = JSON.stringify(${jsonStr})\n  document.head.appendChild(s)\n})()\n`
  dlFile(jsContent, 'data-listings.js', 'text/javascript')

  toast('Descargados listings.json y data-listings.js — súbelos a Netlify para publicar.', 'success')
}

function dlFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function cacheListings() {
  localStorage.setItem('an_listings_cache', JSON.stringify({ listings: _listings }))
}

// ── GOOGLE MAPS AUTOCOMPLETE ───────────────────
let _mapsACInited = false
function initAddressAutocomplete() {
  if (_mapsACInited) return
  if (!window.google?.maps?.places) {
    window.addEventListener('load', initAddressAutocomplete, { once: true })
    return
  }
  const input = document.getElementById('f-address')
  if (!input) return
  const ac = new google.maps.places.Autocomplete(input, {
    types: ['address'],
    componentRestrictions: { country: 'es' }
  })
  ac.addListener('place_changed', () => {
    const place = ac.getPlace()
    const comps = place.address_components || []
    const zip = comps.find(c => c.types.includes('postal_code'))?.long_name || ''
    if (zip) document.getElementById('f-zip').value = zip
  })
  _mapsACInited = true
}

// ── WATERMARK TOOL ────────────────────────────
function initWatermarkTool() {
  const fileInput = document.getElementById('wm-file')
  const dropArea  = document.getElementById('wm-drop')
  const sizeSlider    = document.getElementById('wm-size')
  const opacitySlider = document.getElementById('wm-opacity')

  sizeSlider.addEventListener('input', () => {
    document.getElementById('wm-size-val').textContent = sizeSlider.value + '%'
    reprocessAll()
  })

  opacitySlider.addEventListener('input', () => {
    document.getElementById('wm-opacity-val').textContent = opacitySlider.value + '%'
    reprocessAll()
  })

  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      _wmPosition = btn.dataset.pos
      reprocessAll()
    })
  })

  fileInput.addEventListener('change', () => handleWmFiles(fileInput.files))

  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.borderColor = 'var(--gold)' })
  dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = '' })
  dropArea.addEventListener('drop', e => {
    e.preventDefault()
    dropArea.style.borderColor = ''
    handleWmFiles(e.dataTransfer.files)
  })

  document.getElementById('wm-download-all').addEventListener('click', downloadAll)
}

async function handleWmFiles(files) {
  if (!files.length) return
  _wmProcessed = []
  document.getElementById('wm-placeholder').classList.add('hidden')
  document.getElementById('wm-results').classList.remove('hidden')
  document.getElementById('wm-results').innerHTML = ''

  const logoDataUrl = await getLogoDataUrl()

  for (const file of files) {
    const result = await processWatermark(file, logoDataUrl)
    _wmProcessed.push({ name: file.name, dataUrl: result })
    renderWmResult({ name: file.name, dataUrl: result })
  }

  document.getElementById('wm-download-all').style.display = _wmProcessed.length > 1 ? '' : 'none'
}

async function reprocessAll() {
  if (!_wmProcessed.length) return
  // Re-process from cache is complex; simpler: ask user to re-select files
  // For now just show a hint
}

function getLogoDataUrl() {
  return new Promise(resolve => {
    // Draw "AN" text logo on a transparent canvas
    const c  = document.createElement('canvas')
    c.width  = 320
    c.height = 80
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)

    // Background pill
    ctx.fillStyle = 'rgba(9,31,56,0.72)'
    ctx.beginPath()
    ctx.roundRect(0, 0, c.width, c.height, 12)
    ctx.fill()

    // "AN" text
    ctx.fillStyle = '#c9a96e'
    ctx.font = 'bold 42px Georgia, serif'
    ctx.letterSpacing = '8px'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('AN', 20, 40)

    // separator
    ctx.fillStyle = 'rgba(201,169,110,0.5)'
    ctx.fillRect(88, 16, 1, 48)

    // "Real Estate"
    ctx.fillStyle = 'rgba(232,220,200,0.9)'
    ctx.font = '500 16px "Jost", Arial, sans-serif'
    ctx.letterSpacing = '3px'
    ctx.fillText('REAL ESTATE', 100, 40)

    resolve(c.toDataURL('image/png'))
  })
}

function processWatermark(file, logoDataUrl) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width  = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        const logo = new Image()
        logo.onload = () => {
          const sizeRatio = parseInt(document.getElementById('wm-size').value) / 100
          const opacity   = parseInt(document.getElementById('wm-opacity').value) / 100
          const logoW = canvas.width * sizeRatio
          const logoH = logo.height * (logoW / logo.width)
          const margin = canvas.width * 0.025
          const pos = _wmPosition

          let x = margin
          let y = canvas.height - logoH - margin

          if (pos.includes('right'))  x = canvas.width - logoW - margin
          if (pos.includes('center') && !pos.includes('mid')) x = (canvas.width - logoW) / 2
          if (pos.includes('top'))    y = margin
          if (pos.includes('mid'))    y = (canvas.height - logoH) / 2
          if (pos === 'center')       { x = (canvas.width - logoW) / 2; y = (canvas.height - logoH) / 2 }

          ctx.globalAlpha = opacity
          ctx.drawImage(logo, x, y, logoW, logoH)
          ctx.globalAlpha = 1

          resolve(canvas.toDataURL('image/jpeg', 0.92))
        }
        logo.src = logoDataUrl
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function renderWmResult({ name, dataUrl }) {
  const item = document.createElement('div')
  item.className = 'wm-result-item'
  const shortName = name.length > 22 ? name.substring(0, 20) + '…' : name
  item.innerHTML = `
    <img src="${dataUrl}" alt="${name}" />
    <div class="wm-result-foot">
      <span class="wm-result-name">${shortName}</span>
      <a class="wm-dl-btn" href="${dataUrl}" download="${name.replace(/\.[^.]+$/, '')}_AN.jpg">↓ Descargar</a>
    </div>`
  document.getElementById('wm-results').appendChild(item)
}

function downloadAll() {
  _wmProcessed.forEach(({ name, dataUrl }) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = name.replace(/\.[^.]+$/, '') + '_AN.jpg'
    a.click()
  })
}

// ── CLOUDINARY UPLOAD ─────────────────────────
async function uploadFile(file, progressId, fillId, statusId) {
  if (progressId) document.getElementById(progressId).classList.remove('hidden')

  return new Promise(resolve => {
    const xhr  = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', CLD_PRESET)
    form.append('folder', 'an-realestate')

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && fillId) setProgress(fillId, Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (progressId) setTimeout(() => document.getElementById(progressId)?.classList.add('hidden'), 800)
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText)
        resolve(res.secure_url)
      } else {
        toast('Error al subir imagen: ' + xhr.status, 'error')
        resolve(null)
      }
    }

    xhr.onerror = () => {
      if (progressId) document.getElementById(progressId)?.classList.add('hidden')
      toast('Error de red al subir imagen', 'error')
      resolve(null)
    }

    xhr.open('POST', CLD_UPLOAD_URL)
    xhr.send(form)
  })
}

function setProgress(fillId, pct) {
  const el = document.getElementById(fillId)
  if (el) el.style.width = pct + '%'
}

// ── MEDIA LIBRARY ──────────────────────────────
function loadMediaLibrary() {
  try {
    const saved = localStorage.getItem(MEDIA_KEY)
    _mediaItems = saved ? JSON.parse(saved) : []
  } catch { _mediaItems = [] }
  renderMediaGrid()
}

function saveToMediaLibrary(url, name) {
  if (_mediaItems.find(m => m.url === url)) return
  _mediaItems.unshift({ url, name: name || url.split('/').pop(), date: Date.now() })
  localStorage.setItem(MEDIA_KEY, JSON.stringify(_mediaItems))
  renderMediaGrid()
  document.getElementById('media-summary').textContent = `${_mediaItems.length} imagen${_mediaItems.length !== 1 ? 'es' : ''} subidas`
}

function renderMediaGrid() {
  const grid  = document.getElementById('media-grid')
  const empty = document.getElementById('media-empty')
  document.getElementById('media-summary').textContent = `${_mediaItems.length} imagen${_mediaItems.length !== 1 ? 'es' : ''} subidas`

  if (!_mediaItems.length) { empty.style.display = ''; return }
  empty.style.display = 'none'

  // Keep empty element, rebuild rest
  const items = grid.querySelectorAll('.media-item')
  items.forEach(i => i.remove())

  _mediaItems.forEach((item, idx) => {
    const div = document.createElement('div')
    div.className = 'media-item'
    const shortName = item.name.length > 20 ? item.name.slice(0, 18) + '…' : item.name
    div.innerHTML = `
      <img src="${item.url}" alt="${item.name}" />
      <div class="media-item-foot">
        <span class="media-item-name">${shortName}</span>
        <button class="media-item-copy" title="Copiar URL">Copiar</button>
        <button class="media-item-del" title="Eliminar de biblioteca">×</button>
      </div>`
    div.querySelector('.media-item-copy').onclick = () => {
      navigator.clipboard.writeText(item.url).then(() => toast('URL copiada', 'success'))
    }
    div.querySelector('img').onclick = () => {
      navigator.clipboard.writeText(item.url).then(() => toast('URL copiada al portapapeles', 'success'))
    }
    div.querySelector('.media-item-del').onclick = () => {
      _mediaItems.splice(idx, 1)
      localStorage.setItem(MEDIA_KEY, JSON.stringify(_mediaItems))
      renderMediaGrid()
    }
    grid.appendChild(div)
  })
}

// ── TRANSLATIONS ──────────────────────────────
const TRANSLATE_LANGS = ['es', 'en', 'ca', 'fr', 'de', 'it', 'ru']
const LANG_NAMES = { es:'Español', en:'English', ca:'Català', fr:'Français', de:'Deutsch', it:'Italiano', ru:'Русский' }

async function gtranslate(text, targetLang, sourceLang = 'auto') {
  if (!text || !text.trim()) return text
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    return data[0].map(x => x[0]).join('')
  } catch { return text }
}

async function translateListing() {
  const title = document.getElementById('f-title').value.trim()
  const descRows = [...document.querySelectorAll('#desc-list .desc-textarea')]
  const description = descRows.map(t => t.value.trim()).filter(Boolean)

  if (!title && !description.length) {
    toast('Rellena el título y la descripción antes de traducir', 'error'); return
  }

  const sourceLang = document.getElementById('f-source-lang')?.value || 'auto'
  const btn = document.getElementById('btn-translate')
  btn.disabled = true

  // Collect features from checkboxes grouped by category
  const FEAT_CATS_TR = {
    'Interior':    ['High Ceilings','Vaulted Ceiling(s)','Volta Catalana','Ceilings with moldings','Open Floorplan','Natural Light','Period Features','French Doors','Sliding Doors','Walk-In Closet(s)','Walk-in wardrobe(s)','Library','Playroom','Utility room','Storage','Split Bedroom'],
    'Flooring':    ['Solid Wooden Floor','Wooden Flooring','Marble Flooring','Ceramic Tile Flooring','Mosaic tile flooring'],
    'Kitchen':     ['Equipped Kitchen','Open kitchen','Oven','Convection Oven','Refrigerator','Dishwasher','Microwave','Freezer','Wine Refrigerator','Range Hood','Exhaust Fan','Wet Bar','Solid Surface Counters','Stone Counters','Solid Wood Cabinets'],
    'Climate':     ['Air conditioning','Heating','Electric Water Heater','Gas Water Heater','Tankless Water Heater','Thermostat','Central Vaccum','Washer','Dryer','Water Filtration System','Water Purifier','Water Softener'],
    'Outdoor':     ['Balcony','Terrace','Communal terrace','Garden','Outdoor Kitchen','Outdoor Shower','Swimming Pool','Sauna','Chill out area','Barbaque','Fence','Tennis Court(s)','Parking'],
    'Building':    ['Elevator','Concierge Service','Modernist building','Alarm','Double Glazing','Exterior','Sidewalk'],
    'Views':       ['City Views','Sea Views','Transport Nearby','Renovated']
  }
  const checkedVals = new Set([...document.querySelectorAll('#tab-feats input[type=checkbox]:checked')].map(cb => cb.value))
  const currentFeatures = {}
  Object.entries(FEAT_CATS_TR).forEach(([cat, items]) => {
    const matched = items.filter(i => checkedVals.has(i))
    if (matched.length) currentFeatures[cat] = matched
  })
  const customRaw = document.getElementById('f-feats-custom').value.trim()
  if (customRaw) currentFeatures['Additional'] = customRaw.split('\n').map(s => s.trim()).filter(Boolean)

  const translations = {}

  for (const lang of TRANSLATE_LANGS) {
    if (lang === sourceLang) continue
    btn.textContent = `⏳ ${lang.toUpperCase()}…`
    translations[lang] = {}

    if (title) translations[lang].title = await gtranslate(title, lang, sourceLang)

    if (description.length) {
      const translated = []
      for (const para of description) translated.push(await gtranslate(para, lang, sourceLang))
      translations[lang].description = translated
    }

    if (Object.keys(currentFeatures).length) {
      const features = {}
      for (const [cat, items] of Object.entries(currentFeatures)) {
        const translatedCat = await gtranslate(cat, lang, sourceLang)
        const translatedItems = []
        for (const item of items) translatedItems.push(await gtranslate(item, lang, sourceLang))
        features[translatedCat] = translatedItems
      }
      translations[lang].features = features
    }

    // Translate details rows
    const detailRows = document.querySelectorAll('#details-list .detail-row')
    if (detailRows.length) {
      const details = []
      for (const r of detailRows) {
        const key = r.querySelector('.det-key').value.trim()
        const val = r.querySelector('.det-val').value.trim()
        if (!key) continue
        details.push({
          key: await gtranslate(key, lang, sourceLang),
          val: await gtranslate(val, lang, sourceLang)
        })
      }
      if (details.length) translations[lang].details = details
    }

    // Translate nearby (dist phrases only, names are proper nouns)
    const nearbyRows = document.querySelectorAll('#nearby-list .nearby-row')
    if (nearbyRows.length) {
      const nearby = []
      for (const r of nearbyRows) {
        const name = r.querySelector('.nb-name').value.trim()
        const dist = r.querySelector('.nb-dist').value.trim()
        if (!name) continue
        nearby.push({
          name,
          dist: await gtranslate(dist, lang, sourceLang)
        })
      }
      if (nearby.length) translations[lang].nearby = nearby
    }
  }

  // If writing in a specific language, store the source content too
  if (sourceLang !== 'auto') {
    const srcDetails = [...document.querySelectorAll('#details-list .detail-row')]
      .map(r => ({ key: r.querySelector('.det-key').value.trim(), val: r.querySelector('.det-val').value.trim() }))
      .filter(d => d.key)
    const srcNearby = [...document.querySelectorAll('#nearby-list .nearby-row')]
      .map(r => ({ name: r.querySelector('.nb-name').value.trim(), dist: r.querySelector('.nb-dist').value.trim() }))
      .filter(n => n.name)
    translations[sourceLang] = {
      title, description,
      ...(Object.keys(currentFeatures).length ? { features: currentFeatures } : {}),
      ...(srcDetails.length ? { details: srcDetails } : {}),
      ...(srcNearby.length ? { nearby: srcNearby } : {})
    }
  }

  document.getElementById('f-translations').value = JSON.stringify(translations)
  btn.disabled = false
  btn.textContent = '🌐 Traducir'
  toast(`¡Traducido a ${TRANSLATE_LANGS.length} idiomas! Guarda para conservar.`, 'success')
}

// ── TOAST ─────────────────────────────────────
let _toastTimer
function toast(msg, type = '') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.className = `toast ${type}`
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.className = 'toast hidden', 3200)
}

// ── HOJAS DE VISITA ───────────────────────────
let _visitsInited = false
function buildAgentPDF(v) {
  if (!window.jspdf) { alert('Cargando jsPDF, intenta de nuevo en un momento.'); return }

  // Resolve address: record → an_addresses store → _listings
  const addrs = JSON.parse(localStorage.getItem('an_addresses') || '{}')
  const address = v.propAddress
    || (v.propSlug && addrs[v.propSlug])
    || (() => { const l = _listings.find(l => (v.propSlug && l.slug === v.propSlug) || (v.propRef && v.propRef !== '—' && l.ref === v.propRef) || l.title === v.propTitle); return l?.address || '' })()

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210, M = 18, TW = W - 2 * M
  let y = 0

  doc.setFillColor(22, 22, 14)
  doc.rect(0, 0, W, 38, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 169, 110)
  doc.text('AN HIGH END REAL ESTATE', M, 11)
  doc.setTextColor(155, 145, 125)
  doc.text('Agente autónomo · AICAT 13069 · DNI 46242509C · anrealestate.es', M, 16)
  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(240, 235, 224)
  doc.text('HOJA DE VISITA', W / 2, 26, { align: 'center' })
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(155, 145, 125)
  doc.text('COPIA DEL AGENTE — Documento de registro oficial de intermediación inmobiliaria', W / 2, 32, { align: 'center' })
  y = 46

  function section(title) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(200, 169, 110)
    doc.text(title, M, y)
    doc.setDrawColor(200, 169, 110); doc.setLineWidth(0.25)
    doc.line(M, y + 1.5, W - M, y + 1.5)
    y += 7
  }

  function kv(key, val) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(130, 120, 100)
    doc.text(key, M, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(28, 26, 18)
    const lines = doc.splitTextToSize(String(val || '—'), TW - 44)
    doc.text(lines, M + 44, y)
    y += lines.length * 4.8
  }

  section('INMUEBLE')
  kv('Referencia:', v.propRef)
  kv('Denominación:', v.propTitle)
  kv('Zona:', v.propZone)
  if (address) kv('Dirección exacta:', address)
  kv('Fecha de visita:', v.visitDate || '—')
  y += 4

  section('AGENTE INMOBILIARIO')
  kv('Nombre:', 'D. Álvaro Navarro Mosca')
  kv('AICAT núm.:', '13069')
  kv('DNI:', '46242509C')
  kv('Actividad:', 'Agente inmobiliario autónomo · AN High End Real Estate')
  kv('Email:', 'alvaro@anrealestate.es')
  y += 4

  section('VISITANTE')
  kv('Nombre completo:', v.name)
  kv('Documento:', (v.docType || '') + ' ' + (v.docNum || ''))
  kv('Teléfono:', v.phone)
  kv('Email:', v.email || '—')
  kv('Fecha / hora firma:', (v.timestamp || '—') + ' (firma electrónica)')
  kv('IP de firma:', v.ip || '—')
  y += 4

  section('DECLARACIONES DEL VISITANTE')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(28, 26, 18)
  const clauses = [
    '1.  El/la firmante declara haber visitado el inmueble referenciado en la presente hoja en presencia del agente inmobiliario autónomo D. Álvaro Navarro Mosca (AICAT 13069, DNI 46242509C), actuando en nombre propio bajo la marca comercial AN High End Real Estate.',
    '2.  El/la firmante se compromete expresamente a no realizar ninguna operación sobre el inmueble descrito —compraventa, arrendamiento u otra modalidad— sin la intervención del agente D. Álvaro Navarro Mosca (AICAT 13069) durante 24 meses desde la fecha de visita. Cualquier operación realizada al margen del agente en dicho período dará lugar al pago de los honorarios de intermediación correspondientes.',
    '3.  El/la firmante declara que los datos aportados son verídicos y corresponden a su identidad real, siendo responsable de cualquier falsedad en los mismos.',
    '4.  Consiente el tratamiento de sus datos personales por D. Álvaro Navarro Mosca (DNI 46242509C), agente inmobiliario autónomo, conforme al RGPD (UE) 2016/679 y la LOPDGDD 3/2018, con finalidad de gestionar la relación inmobiliaria. Derechos en: alvaro@anrealestate.es.'
  ]
  clauses.forEach(clause => {
    const lines = doc.splitTextToSize(clause, TW)
    doc.text(lines, M, y)
    y += lines.length * 4.2 + 2.5
  })
  y += 3

  section('FIRMA DEL VISITANTE')

  if (v.signature) {
    doc.setDrawColor(210, 205, 195); doc.setLineWidth(0.25)
    doc.rect(M, y, 85, 30)
    doc.addImage(v.signature, 'PNG', M + 1, y + 1, 83, 28)

    const tx = M + 92
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(28, 26, 18)
    doc.text(v.name, tx, y + 8)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130, 120, 100)
    doc.text((v.docType || '') + ': ' + (v.docNum || ''), tx, y + 14)
    doc.text('Tel: ' + (v.phone || '—'), tx, y + 20)
    doc.text(v.timestamp || '—', tx, y + 26)
    doc.text('IP: ' + (v.ip || '—'), tx, y + 32)
    y += 38
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(130, 120, 100)
    doc.text('Firma electrónica registrada en el documento original firmado por el visitante.', M, y)
    y += 5
    kv('Firmante:', v.name)
    kv('Documento:', (v.docType || '') + ' ' + (v.docNum || ''))
    kv('Teléfono:', v.phone || '—')
    kv('Timestamp:', v.timestamp || '—')
    kv('IP:', v.ip || '—')
    y += 4
  }

  if (v.docHash) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(130, 120, 100)
    doc.text('INTEGRIDAD SHA-256:', M, y)
    y += 4
    doc.setFont('courier', 'normal'); doc.setFontSize(5.5); doc.setTextColor(70, 65, 55)
    doc.text(v.docHash, M, y)
    y += 6
  }

  doc.setDrawColor(210, 205, 195); doc.setLineWidth(0.2)
  doc.line(M, y, W - M, y)
  y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(155, 145, 125)
  doc.text('Firma electrónica simple con plena validez legal conforme a la Ley 6/2020 y el Reglamento eIDAS (UE) nº 910/2014.', W / 2, y, { align: 'center' })
  y += 4
  doc.text('Álvaro Navarro Mosca · Agente inmobiliario autónomo · AICAT 13069 · Barcelona · anrealestate.es', W / 2, y, { align: 'center' })

  if (v.dniPhoto) {
    doc.addPage()
    doc.setFillColor(22, 22, 14)
    doc.rect(0, 0, W, 22, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 169, 110)
    doc.text('DOCUMENTO DE IDENTIDAD — COPIA DEL AGENTE (CONFIDENCIAL)', M, 10)
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(155, 145, 125)
    doc.text((v.name || '') + ' · ' + (v.docType || '') + ' ' + (v.docNum || '') + ' · Capturado: ' + (v.timestamp || '—'), M, 16)

    const imgW = 160
    const imgX = (W - imgW) / 2
    const imgY = 32
    doc.addImage(v.dniPhoto, 'JPEG', imgX, imgY, imgW, imgW * 0.63)

    const noteY = imgY + imgW * 0.63 + 10
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(130, 120, 100)
    doc.text('Fotografía del documento presentado por el visitante para verificación de identidad.', W / 2, noteY, { align: 'center' })
    doc.text('Uso exclusivo de D. Álvaro Navarro Mosca · Agente inmobiliario autónomo · AICAT 13069 · alvaro@anrealestate.es', W / 2, noteY + 5, { align: 'center' })
  }

  const filename = 'HojaVisita_AGENTE_' + (v.propRef || '').replace(/[^A-Z0-9]/gi, '') + '_' + (v.name || '').replace(/\s+/g, '_') + '.pdf'
  doc.save(filename)
}

function renderVisitLog() {
  const logBody = document.getElementById('vs-log-body')
  if (!logBody) return
  const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]')

  if (!visits.length) {
    logBody.innerHTML = '<p class="vl-empty">No hay visitas registradas todavía. Los registros aparecen aquí automáticamente cuando se firma una hoja de visita en este dispositivo.</p>'
    return
  }

  const sorted = [...visits].sort((a, b) => {
    let va, vb
    if (_visitSort === 'name')  { va = (a.name  || '').toLowerCase(); vb = (b.name  || '').toLowerCase() }
    else if (_visitSort === 'phone') { va = a.phone || ''; vb = b.phone || '' }
    else if (_visitSort === 'email') { va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase() }
    else { va = a.savedAt || ''; vb = b.savedAt || '' }
    return va < vb ? _visitSortDir : va > vb ? -_visitSortDir : 0
  })

  // Group by propRef
  const groups = {}
  sorted.forEach(v => {
    const key = v.propRef || '—'
    if (!groups[key]) {
      const addrs = JSON.parse(localStorage.getItem('an_addresses') || '{}')
      const address = v.propAddress
        || (v.propSlug && addrs[v.propSlug])
        || _listings.find(l => (v.propSlug && l.slug === v.propSlug) || (v.propRef && v.propRef !== '—' && l.ref === v.propRef) || l.title === v.propTitle)?.address
        || ''
      groups[key] = { title: v.propTitle || '', zone: v.propZone || '', address, records: [] }
    }
    groups[key].records.push(v)
  })

  logBody.innerHTML = Object.entries(groups).map(([ref, g]) => `
    <div class="vl-group">
      <div class="vl-group-hd">
        <span class="vl-group-ref">${ref}</span>
        <span class="vl-group-name">${g.title}</span>
        <span class="vl-group-zone">${g.zone}</span>
        ${g.address ? `<span class="vl-group-address">${g.address}</span>` : ''}
        <span class="vl-group-count">${g.records.length} visita${g.records.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="vl-table">
          <thead><tr>
            <th>Visita</th><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Email</th><th></th>
          </tr></thead>
          <tbody>
            ${g.records.map(v => `<tr>
              <td class="vl-date">${v.visitDate || v.timestamp || '—'}</td>
              <td class="vl-name">${v.name || '—'}</td>
              <td class="vl-doc">${v.docType || ''} ${v.docNum || ''}</td>
              <td class="vl-phone">${v.phone || '—'}</td>
              <td class="vl-email">${v.email || '—'}</td>
              <td class="vl-actions">
                <button class="vl-pdf" data-id="${v.id}" title="Descargar PDF (copia agente con dirección)">PDF</button>
                <button class="vl-del" data-id="${v.id}" title="Eliminar">✕</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('')

  logBody.querySelectorAll('.vl-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]')
      const record = all.find(v => v.id === btn.dataset.id)
      if (record) buildAgentPDF(record)
    })
  })

  logBody.querySelectorAll('.vl-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]')
      const v = all.find(x => x.id === btn.dataset.id)
      const label = v ? `${v.name || '—'} · ${v.visitDate || v.timestamp || '—'}` : btn.dataset.id
      document.getElementById('confirm-msg').textContent = `¿Eliminar el comprobante de "${label}"? Esta acción es permanente y no se puede deshacer.`
      document.getElementById('confirm-overlay').classList.remove('hidden')
      document.getElementById('confirm-ok').onclick = () => {
        localStorage.setItem(VISITS_KEY, JSON.stringify(all.filter(x => x.id !== btn.dataset.id)))
        document.getElementById('confirm-overlay').classList.add('hidden')
        toast('Comprobante eliminado', 'success')
        renderVisitLog()
      }
    })
  })
}

function initVisits() {
  const BASE = window.location.origin

  function getVisitDate() {
    const v = (document.getElementById('vs-visit-date') || {}).value || ''
    return v
  }

  function visitUrl(ref, title, zone, slug, address) {
    const date = getVisitDate()
    return BASE + '/visit.html?ref=' + encodeURIComponent(ref) +
      '&title=' + encodeURIComponent(title) +
      '&zone='  + encodeURIComponent(zone) +
      (slug    ? '&slug='    + encodeURIComponent(slug)    : '') +
      (address ? '&address=' + encodeURIComponent(address) : '') +
      (date    ? '&date='    + encodeURIComponent(date)    : '')
  }

  function copyUrl(url, btn) {
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.innerHTML
      btn.textContent = '✓ Copiado'
      btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied') }, 2000)
    }).catch(() => {
      const t = document.createElement('input')
      t.value = url; document.body.appendChild(t); t.select()
      document.execCommand('copy'); document.body.removeChild(t)
    })
  }

  function waLink(ref, url) {
    const txt = 'Hola, le envío el enlace para firmar la hoja de visita del inmueble ' + ref + ': ' + url
    return 'https://wa.me/?text=' + encodeURIComponent(txt)
  }

  function showResult(ref, title, zone, slug, address) {
    const dateRow = document.getElementById('vs-date-row')
    if (dateRow) dateRow.style.display = 'block'

    const rebuild = () => {
      const url = visitUrl(ref, title, zone, slug, address)
      document.getElementById('vs-url-input').value = url
      document.getElementById('vs-btn-wa').href = waLink(ref, url)
      document.getElementById('vs-btn-copy').onclick = () => copyUrl(url, document.getElementById('vs-btn-copy'))
    }
    rebuild()

    const dateInput = document.getElementById('vs-visit-date')
    if (dateInput) dateInput.oninput = rebuild

    const infoEl  = document.getElementById('vs-result-info')
    const viewBtn = document.getElementById('vs-btn-view')
    infoEl.innerHTML = `<span class="visit-ref">${ref}</span><span class="visit-name">${title}</span><span class="visit-zone">${zone}</span>` +
      (address ? `<span class="visit-address">${address}</span>` : '')

    if (slug) {
      viewBtn.href = BASE + '/property.html?slug=' + encodeURIComponent(slug)
      viewBtn.style.display = 'inline-flex'
    } else {
      viewBtn.style.display = 'none'
    }

    document.getElementById('vs-result-card').style.display = 'block'
  }

  function hideResult() {
    const dateRow = document.getElementById('vs-date-row')
    if (dateRow) dateRow.style.display = 'none'
    document.getElementById('vs-result-card').style.display = 'none'
  }

  // Sort buttons (wire once, re-render every time)
  document.querySelectorAll('.vls-btn').forEach(btn => {
    btn.onclick = () => {
      const s = btn.dataset.sort
      if (_visitSort === s) { _visitSortDir *= -1 }
      else { _visitSort = s; _visitSortDir = s === 'date' ? -1 : 1 }
      document.querySelectorAll('.vls-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === _visitSort)
        b.textContent = b.dataset.sort === _visitSort
          ? b.dataset.sort.charAt(0).toUpperCase() + b.dataset.sort.slice(1) + (_visitSortDir === 1 ? ' ↑' : ' ↓')
          : b.dataset.sort.charAt(0).toUpperCase() + b.dataset.sort.slice(1)
      })
      renderVisitLog()
    }
  })

  renderVisitLog()

  // Manual import from email link
  const importBtn = document.getElementById('vl-import-btn')
  const importMsg = document.getElementById('vl-import-msg')
  if (importBtn) {
    importBtn.onclick = () => {
      const raw = document.getElementById('vl-import-url').value.trim()
      if (!raw) return
      try {
        const url = new URL(raw)
        const encoded = url.searchParams.get('visit')
        if (!encoded) throw new Error('No se encontró el parámetro visit en la URL')
        const record = JSON.parse(decodeURIComponent(escape(atob(encoded))))
        record.id = Date.now() + '-' + Math.random().toString(36).slice(2, 7)
        const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]')
        const isDup = visits.some(v => v.timestamp === record.timestamp && v.docNum === record.docNum)
        if (isDup) {
          importMsg.textContent = 'Esta visita ya está registrada.'
          importMsg.style.color = 'var(--muted)'
        } else {
          visits.unshift(record)
          localStorage.setItem(VISITS_KEY, JSON.stringify(visits))
          document.getElementById('vl-import-url').value = ''
          importMsg.textContent = '✓ Visita importada correctamente.'
          importMsg.style.color = 'var(--gold)'
          renderVisitLog()
        }
      } catch (e) {
        importMsg.textContent = 'Error: ' + e.message
        importMsg.style.color = '#e07070'
      }
    }
  }

  // Populate select (only once)
  if (!_visitsInited) {
    _visitsInited = true
    const sel = document.getElementById('vs-prop-select')

    // Insert listing options before the last option (custom)
    const customOpt = sel.querySelector('[value="__custom"]')
    _listings.forEach(l => {
      const opt = document.createElement('option')
      opt.value = l.slug
      opt.textContent = l.ref + ' — ' + l.title + (l.address ? ' · ' + l.address : '')
      opt.dataset.ref     = l.ref
      opt.dataset.title   = l.title
      opt.dataset.zone    = l.neighbourhood
      opt.dataset.address = l.address || ''
      sel.insertBefore(opt, customOpt)
    })

    // On select change
    sel.addEventListener('change', () => {
      const val  = sel.value
      const customFields = document.getElementById('vs-custom-fields')
      const resultCard   = document.getElementById('vs-result-card')

      if (!val) {
        customFields.style.display = 'none'
        hideResult()
        return
      }

      if (val === '__custom') {
        customFields.style.display = 'block'
        hideResult()
        // Generate on input
        const generate = () => {
          const ref   = document.getElementById('vs-c-ref').value.trim()
          const title = document.getElementById('vs-c-title').value.trim()
          const zone  = document.getElementById('vs-c-zone').value.trim() || 'Barcelona, España'
          if (ref && title) showResult(ref, title, zone, '')
        }
        document.getElementById('vs-c-ref').oninput   = generate
        document.getElementById('vs-c-title').oninput = generate
        document.getElementById('vs-c-zone').oninput  = generate
        return
      }

      // Existing listing
      customFields.style.display = 'none'
      const opt = sel.querySelector(`option[value="${val}"]`)
      showResult(opt.dataset.ref, opt.dataset.title, opt.dataset.zone, val, opt.dataset.address)
    })
  }
}
