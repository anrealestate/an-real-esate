/* =============================================
   AN Real Estate — Admin Panel
   ============================================= */

const ADMIN_PWD_HASH    = 'fc0888c7f9285ae5f3b0bd21a9cef65c181586fde32c2c9a72631d978515d301'
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MS         = 30 * 60 * 1000
let _loginAttempts = parseInt(sessionStorage.getItem('an_login_attempts') || '0')
let _lockoutUntil  = parseInt(sessionStorage.getItem('an_lockout_until')  || '0')

// Si la web está en Hostinger u otro hosting sin serverless,
// pon aquí la URL completa del endpoint en Vercel:
// const IMPROVE_API = 'https://tu-proyecto.vercel.app/api/improve'
const IMPROVE_API = '/api/improve'
const DATA_URL          = '/data/listings.json'
const SESSION_KEY       = 'an_admin_auth'
const CLD_CLOUD         = 'dbume3eak'
const CLD_PRESET        = 'f3eiclx5'
const CLD_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`
const MEDIA_KEY         = 'an_media_library'
const VISITS_KEY        = 'an_visits'

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

// ── STAGE SYSTEM ──────────────────────────────
const STAGES      = ['draft', 'active', 'reserved', 'sold', 'withdrawn']
const STAGE_LABEL = { draft:'Borrador', active:'Activa', reserved:'Reservada', sold:'Vendida', withdrawn:'Retirada' }
const STAGE_CLASS = { draft:'stage-draft', active:'stage-active', reserved:'stage-reserved', sold:'stage-sold', withdrawn:'stage-withdrawn' }
const PUBLIC_STAGES = ['active', 'reserved', 'sold']

let _listings    = []
let _editSlug    = null
let _filter      = 'all'
let _formDirty   = false
let _wmPosition  = localStorage.getItem('an_wm_pos') || 'bottom-left'
let _wmAutoApply     = localStorage.getItem('an_wm_auto') === '1'
let _wmSampleDataUrl = localStorage.getItem('an_wm_sample') || null
let _previewGen      = 0
let _cachedSampleImg = null
let _cachedLogoImg   = null
let _mediaItems  = []
let _wmProcessed = []
let _visitSort   = 'date'
let _visitSortDir = -1
let _wmAbort     = false
let _undoFn      = null
let _undoTimer   = null

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
    showApp()
  }

  document.getElementById('login-form').addEventListener('submit', handleLogin)
  document.getElementById('logout-btn').addEventListener('click', logout)
  document.getElementById('export-btn').addEventListener('click', exportJSON)
  document.getElementById('publish-btn').addEventListener('click', publishToWeb)
  document.getElementById('btn-new-prop').addEventListener('click', () => showForm(null))
  document.getElementById('btn-add-new')?.addEventListener('click', () => showForm(null))
  document.getElementById('btn-back').addEventListener('click', showPropsList)
  document.getElementById('btn-save').addEventListener('click', saveProperty)
  document.getElementById('btn-pdf').addEventListener('click', openPropertyPdf)
  document.getElementById('btn-delete').addEventListener('click', confirmDelete)

  // Agent settings
  const agentModal = document.getElementById('agent-modal')
  document.getElementById('agent-settings-btn').addEventListener('click', () => {
    document.getElementById('ag-name').value    = localStorage.getItem('an_agent_name')    || ''
    document.getElementById('ag-phone').value   = localStorage.getItem('an_agent_phone')   || ''
    document.getElementById('ag-email').value   = localStorage.getItem('an_agent_email')   || ''
    document.getElementById('ag-license').value = localStorage.getItem('an_agent_license') || ''
    agentModal.classList.remove('hidden')
  })
  document.getElementById('agent-modal-close').addEventListener('click', () => agentModal.classList.add('hidden'))
  agentModal.addEventListener('click', e => { if (e.target === agentModal) agentModal.classList.add('hidden') })
  document.getElementById('ag-save-btn').addEventListener('click', () => {
    localStorage.setItem('an_agent_name',    document.getElementById('ag-name').value.trim())
    localStorage.setItem('an_agent_phone',   document.getElementById('ag-phone').value.trim())
    localStorage.setItem('an_agent_email',   document.getElementById('ag-email').value.trim())
    localStorage.setItem('an_agent_license', document.getElementById('ag-license').value.trim())
    agentModal.classList.add('hidden')
    toast('Datos guardados', 'success')
  })
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
  document.querySelectorAll('.ftab').forEach((tab, _, tabs) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active', 'hidden'))
      tab.classList.add('active')
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active')
      if (tab.dataset.tab === 'nearby') openMapPickerTab()
      const allTabs = [...tabs]
      const idx = allTabs.indexOf(tab)
      const prog = document.getElementById('form-tab-progress')
      if (prog) { prog.style.width = ((idx + 1) / allTabs.length * 100) + '%' }
    })
  })

  // Mark form dirty on any input/change inside the form view
  document.getElementById('view-form').addEventListener('input',  () => { _formDirty = true })
  document.getElementById('view-form').addEventListener('change', () => { _formDirty = true })

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (document.getElementById('view-form')?.classList.contains('active')) {
        e.preventDefault(); saveProperty()
      }
    }
    if (e.key === 'Escape') {
      if (document.getElementById('view-form')?.classList.contains('active') && !document.querySelector('.modal:not(.hidden)')) {
        showPropsList()
      }
    }
  })

  // Offline detection
  window.addEventListener('offline', () => toast('Sin conexión a internet', 'error'))
  window.addEventListener('online',  () => toast('Conexión restaurada', 'success'))

  // Swipe between form tabs on mobile
  let _swipeX = 0
  const viewForm = document.getElementById('view-form')
  viewForm.addEventListener('touchstart', e => { _swipeX = e.touches[0].clientX }, { passive: true })
  viewForm.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swipeX
    if (Math.abs(dx) < 70) return
    const tabs = [...document.querySelectorAll('.ftab')]
    const activeIdx = tabs.findIndex(t => t.classList.contains('active'))
    const nextIdx = dx < 0 ? Math.min(activeIdx + 1, tabs.length - 1) : Math.max(activeIdx - 1, 0)
    if (nextIdx !== activeIdx) tabs[nextIdx].click()
  }, { passive: true })

  // FAB publish button
  document.getElementById('fab-publish')?.addEventListener('click', publishToWeb)

  // Dynamic list add buttons
  document.getElementById('add-gallery-url').addEventListener('click', () => addGalleryCard())
  document.getElementById('reverse-gallery').addEventListener('click', () => {
    const list = document.getElementById('gallery-list')
    const cards = [...list.querySelectorAll('.gal-card')]
    cards.reverse().forEach(c => list.appendChild(c))
    refreshGalleryBadges()
    toast('Orden de fotos invertido', 'success')
  })
  document.getElementById('apply-logo-gallery').addEventListener('click', applyLogoToGallery)

  // PDF hero upload
  document.getElementById('pdf-hero-file').addEventListener('change', async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    document.getElementById('pdf-hero-progress').classList.remove('hidden')
    document.getElementById('pdf-hero-status').textContent = 'Comprimiendo…'
    const compressed = await compressImage(file)
    document.getElementById('pdf-hero-status').textContent = 'Subiendo…'
    const url = await uploadFile(compressed, null, 'pdf-hero-fill', 'pdf-hero-status')
    document.getElementById('pdf-hero-progress').classList.add('hidden')
    if (url) { setPdfHero(url); _formDirty = true }
  })
  document.getElementById('pdf-hero-remove').addEventListener('click', () => {
    setPdfHero('')
    _formDirty = true
  })
  document.getElementById('add-para').addEventListener('click', () => addDescRow())
  document.getElementById('add-detail').addEventListener('click', () => addDetailRow())
  document.getElementById('add-feat-cat')?.addEventListener('click', () => addFeatCat())
  document.getElementById('add-nearby').addEventListener('click', () => addNearbyRow())

  // Gallery thumbnail size slider
  const galSlider = document.getElementById('gal-size-slider')
  galSlider.addEventListener('input', () => {
    document.getElementById('gallery-list').style.setProperty('--gal-w', galSlider.value + 'px')
  })

  // Gallery image lightbox
  const previewOverlay = document.getElementById('img-preview-overlay')
  const previewImg     = document.getElementById('img-preview-img')
  let _previewSrcs = [], _previewIdx = 0

  function openPreview(srcs, idx) {
    _previewSrcs = srcs; _previewIdx = idx
    previewImg.src = srcs[idx]
    previewOverlay.classList.remove('hidden')
    document.getElementById('img-preview-prev').style.visibility = srcs.length > 1 ? '' : 'hidden'
    document.getElementById('img-preview-next').style.visibility = srcs.length > 1 ? '' : 'hidden'
  }
  function closePreview() { previewOverlay.classList.add('hidden'); previewImg.src = '' }

  document.getElementById('img-preview-close').addEventListener('click', closePreview)
  previewOverlay.addEventListener('click', e => { if (e.target === previewOverlay) closePreview() })
  document.getElementById('img-preview-prev').addEventListener('click', e => {
    e.stopPropagation()
    _previewIdx = (_previewIdx - 1 + _previewSrcs.length) % _previewSrcs.length
    previewImg.src = _previewSrcs[_previewIdx]
  })
  document.getElementById('img-preview-next').addEventListener('click', e => {
    e.stopPropagation()
    _previewIdx = (_previewIdx + 1) % _previewSrcs.length
    previewImg.src = _previewSrcs[_previewIdx]
  })
  document.addEventListener('keydown', e => {
    if (previewOverlay.classList.contains('hidden')) return
    if (e.key === 'Escape') closePreview()
    if (e.key === 'ArrowLeft')  document.getElementById('img-preview-prev').click()
    if (e.key === 'ArrowRight') document.getElementById('img-preview-next').click()
  })

  // Delegate click on gallery images to open lightbox (ignore overlay buttons)
  document.getElementById('gallery-list').addEventListener('click', e => {
    if (e.target.closest('.gal-card-overlay')) return
    const img = e.target.closest('.gal-card-img')?.querySelector('img')
    if (!img || !img.src) return
    const allSrcs = [...document.querySelectorAll('#gallery-list .gal-card-img img')]
      .filter(i => i.src && !i.src.startsWith('data:image/svg'))
      .map(i => i.src)
    const idx = allSrcs.indexOf(img.src)
    openPreview(allSrcs, idx >= 0 ? idx : 0)
  })

  // (imagen principal managed via gallery grid — no separate preview button)

  // Slug auto-gen from title
  document.getElementById('f-title').addEventListener('input', autoSlug)

  // Location cascade
  initLocationCascade()
  document.getElementById('f-province').addEventListener('change', e => {
    populateCitySelect(e.target.value)
    populateZoneDatalist('')
    document.getElementById('f-zone').value = ''
  })
  document.getElementById('f-city').addEventListener('change', e => {
    populateZoneDatalist(e.target.value)
    document.getElementById('f-zone').value = ''
  })

  // Watermark tool
  initWatermarkTool()

  // (upload-main-file removed — use gallery upload instead)

  // Upload: gallery (multiple)
  document.getElementById('upload-gallery-files').addEventListener('change', async e => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return

    let applyWm = false
    if (_wmAutoApply) {
      applyWm = await showConfirmAsync(
        `¿Aplicar logo AN a ${files.length === 1 ? 'esta foto' : `estas ${files.length} fotos`} antes de subirlas?`,
        { okText: 'Sí, aplicar', okClass: 'btn-gold' }
      )
    }

    let logoDataUrl = null
    if (applyWm) logoDataUrl = await getLogoDataUrl()

    const total = files.length
    let successCount = 0
    try {
      for (let i = 0; i < files.length; i++) {
        document.getElementById('upload-gallery-status').textContent = `${applyWm ? 'Procesando' : 'Subiendo'} ${i+1} de ${total}…`
        let fileToUpload = files[i]
        if (applyWm) fileToUpload = dataUrlToFile(await processWatermark(files[i], logoDataUrl), files[i].name)
        const url = await uploadFile(fileToUpload, 'upload-gallery-progress', 'upload-gallery-fill', 'upload-gallery-status')
        if (url) { successCount++; addGalleryCard({ src: url, alt: files[i].name.replace(/\.[^.]+$/, '') }); saveToMediaLibrary(url, files[i].name) }
      }
    } catch (err) {
      console.error('[gallery upload error]', err)
      toast('Error al procesar imagen: ' + err.message, 'error')
    } finally {
      document.getElementById('upload-gallery-progress').classList.add('hidden')
    }
    if (successCount > 0) toast(`${successCount} imagen${successCount>1?'es':''} subida${successCount>1?'s':''}${applyWm ? ' con logo' : ''}`, 'success')
    else if (successCount === 0 && total > 0) toast('No se pudo subir ninguna imagen', 'error')
  })

  // Upload: media repository
  document.getElementById('media-upload-input').addEventListener('change', async e => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    const total = files.length
    let successCount = 0
    document.getElementById('media-progress').classList.remove('hidden')
    try {
      for (let i = 0; i < files.length; i++) {
        document.getElementById('media-progress-status').textContent = `Subiendo ${i+1} de ${total}…`
        setProgress('media-progress-fill', Math.round((i/total)*100))
        const url = await uploadFile(files[i], null, null, null)
        if (url) { successCount++; saveToMediaLibrary(url, files[i].name) }
      }
    } catch (err) {
      console.error('[media upload error]', err)
      toast('Error al procesar imagen: ' + err.message, 'error')
    } finally {
      setProgress('media-progress-fill', 100)
      document.getElementById('media-progress-status').textContent = `${successCount} imagen${successCount>1?'es':''} subida${successCount>1?'s':''}`
      setTimeout(() => document.getElementById('media-progress').classList.add('hidden'), 2000)
      renderMediaGrid()
    }
    if (successCount > 0) toast(`${successCount} imagen${successCount>1?'es':''} subida${successCount>1?'s':''}`, 'success')
    else if (successCount === 0 && total > 0) toast('No se pudo subir ninguna imagen', 'error')
  })

  // Confirm dialog
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.add('hidden')
  })

})

// Admin UI language — event delegation so it fires regardless of when element is ready
document.addEventListener('change', e => {
  if (e.target.id === 'f-source-lang') {
    const lang = e.target.value === 'auto' ? 'es' : e.target.value
    applyAdminLang(lang)
  }
})

// ── AUTH ──────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault()
  const errEl = document.getElementById('login-error')
  const now = Date.now()
  if (now < _lockoutUntil) {
    const mins = Math.ceil((_lockoutUntil - now) / 60000)
    errEl.textContent = `Demasiados intentos. Espera ${mins} min.`
    errEl.classList.remove('hidden')
    return
  }
  const val = document.getElementById('pwd-input').value
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val))
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  if (hash === ADMIN_PWD_HASH) {
    _loginAttempts = 0
    sessionStorage.removeItem('an_login_attempts')
    sessionStorage.removeItem('an_lockout_until')
    sessionStorage.setItem(SESSION_KEY, 'ok')
    errEl.classList.add('hidden')
    showApp()
  } else {
    _loginAttempts++
    sessionStorage.setItem('an_login_attempts', _loginAttempts)
    if (_loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      _lockoutUntil = Date.now() + LOCKOUT_MS
      sessionStorage.setItem('an_lockout_until', _lockoutUntil)
      errEl.textContent = 'Cuenta bloqueada 30 minutos por exceso de intentos.'
    } else {
      errEl.textContent = `Contraseña incorrecta. Intentos restantes: ${MAX_LOGIN_ATTEMPTS - _loginAttempts}`
    }
    errEl.classList.remove('hidden')
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
  const initLang = document.getElementById('f-source-lang')?.value || 'es'
  applyAdminLang(initLang === 'auto' ? 'es' : initLang)
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
  // Read inline bootstrap data (may be stale — only updated on publish)
  let inlineListings = []
  const el = document.getElementById('listings-data')
  if (el) {
    try { inlineListings = JSON.parse(el.textContent).listings || [] } catch {}
  }

  // Read localStorage cache (always written on every admin save/change — always fresh)
  let cachedListings = []
  try {
    cachedListings = JSON.parse(localStorage.getItem('an_listings_cache') || '{}').listings || []
  } catch {}

  if (cachedListings.length) {
    // Cache is the source of truth — it reflects every change the user has ever made
    _listings = cachedListings
    // Append any inline-only slugs (e.g. first load after clearing storage on a fresh device)
    inlineListings.forEach(il => {
      if (!_listings.find(l => l.slug === il.slug)) _listings.push(il)
    })
  } else {
    // No cache (fresh install / cleared storage) — fall back to inline data
    _listings = inlineListings
  }

  // Migrate old data model (published/sold/status/type) → new (stage/type/propertyType)
  _listings.forEach(l => {
    if (!l.stage) {
      l.stage = l.sold ? 'sold' : (l.published ? 'active' : 'draft')
      l.propertyType = l.type || 'apartment'
      l.type = l.status || 'sale'
      delete l.published
      delete l.sold
      delete l.status
    }
    // Migrate neighbourhood string → province/city/zone (if not yet split)
    if (!l.province && l.neighbourhood && window.LOCATIONS_ES) {
      const parts = l.neighbourhood.split(',').map(s => s.trim())
      const maybeCity = parts[parts.length - 1]
      const maybeZone = parts.length > 1 ? parts.slice(0, -1).join(', ') : ''
      for (const [prov, cities] of Object.entries(LOCATIONS_ES.cities)) {
        if (cities.includes(maybeCity)) { l.province = prov; l.city = maybeCity; l.zone = maybeZone; break }
      }
      if (!l.province && maybeCity) { l.city = maybeCity; l.zone = maybeZone }
    }
  })

  if (_listings.length) cacheListings()
  renderTable()
  updateSummary()
}

function updateSummary() {
  const total    = _listings.length
  const active   = _listings.filter(l => l.stage === 'active').length
  const reserved = _listings.filter(l => l.stage === 'reserved').length
  const sold     = _listings.filter(l => l.stage === 'sold').length
  document.getElementById('props-summary').textContent =
    `${total} propiedades · ${active} activas · ${reserved} reservadas · ${sold} vendidas`
}

// ── TABLE ─────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('prop-tbody')
  let filtered = [..._listings]

  if (_filter === 'sale')      filtered = filtered.filter(l => l.type === 'sale' && l.stage !== 'sold' && l.stage !== 'withdrawn')
  if (_filter === 'rent')      filtered = filtered.filter(l => l.type === 'rent' && l.stage !== 'sold' && l.stage !== 'withdrawn')
  if (_filter === 'sold')      filtered = filtered.filter(l => l.stage === 'sold')
  if (_filter === 'reserved')  filtered = filtered.filter(l => l.stage === 'reserved')
  if (_filter === 'draft')     filtered = filtered.filter(l => l.stage === 'draft')
  if (_filter === 'withdrawn') filtered = filtered.filter(l => l.stage === 'withdrawn')

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);font-size:.82rem;">Sin resultados</td></tr>`
    return
  }

  // Sort by order field before rendering
  const sorted = [...filtered].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  tbody.innerHTML = sorted.map((l, idx) => {
    const typeBadge = l.type === 'rent'
      ? `<span class="badge badge-rent">Alquiler</span>`
      : l.propertyType === 'villa' ? `<span class="badge badge-villa">Villa</span>`
      : `<span class="badge badge-sale">Venta</span>`

    const stage = l.stage || 'draft'
    const isFirst = idx === 0
    const isLast  = idx === sorted.length - 1

    return `
    <tr data-slug="${l.slug}">
      <td>
        <div class="order-ctrl">
          <span class="order-num">${l.order ?? '—'}</span>
          <div class="order-btns">
            <button class="order-btn${isFirst ? ' disabled' : ''}" title="Subir" onclick="moveListingUp('${l.slug}')" ${isFirst ? 'disabled' : ''}>▲</button>
            <button class="order-btn${isLast  ? ' disabled' : ''}" title="Bajar" onclick="moveListingDown('${l.slug}')" ${isLast  ? 'disabled' : ''}>▼</button>
          </div>
        </div>
      </td>
      <td><img class="pt-thumb" src="${l.image || ''}" alt="" onerror="this.style.display='none'" /></td>
      <td>
        <div class="pt-title">${escHtml(l.title)}</div>
        <div class="pt-loc">${escHtml(l.neighbourhood || '')}</div>
      </td>
      <td class="pt-price">${escHtml(l.price || '—')}</td>
      <td>${typeBadge}</td>
      <td>
        <div class="stage-dropdown-wrap" id="stage-wrap-${l.slug}">
          <span class="state-badge ${STAGE_CLASS[stage]}" style="cursor:pointer" onclick="toggleStageDropdown('${l.slug}')">${STAGE_LABEL[stage]}</span>
          <div class="stage-dropdown hidden" id="stage-dd-${l.slug}">
            ${STAGES.map(s => `<button class="stage-dropdown-item${s === stage ? ' is-current' : ''}" onclick="setStage('${l.slug}','${s}')">${STAGE_LABEL[s]}</button>`).join('')}
          </div>
        </div>
      </td>
      <td>
        <div class="row-actions">
          <button class="act-btn act-edit" title="Editar" onclick="showForm('${l.slug}')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="act-btn act-clone" title="Duplicar" onclick="cloneProperty('${l.slug}')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="act-btn act-del" title="Eliminar" onclick="confirmDelete('${l.slug}')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`
  }).join('')
}

function moveListingUp(slug) {
  const sorted = [..._listings].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  const idx = sorted.findIndex(l => l.slug === slug)
  if (idx <= 0) return
  const a = sorted[idx - 1], b = sorted[idx]
  const tmp = a.order ?? idx
  a.order = b.order ?? idx + 1
  b.order = tmp
  cacheListings()
  renderTable()
  toast('Orden actualizado', 'success')
}

function moveListingDown(slug) {
  const sorted = [..._listings].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  const idx = sorted.findIndex(l => l.slug === slug)
  if (idx < 0 || idx >= sorted.length - 1) return
  const a = sorted[idx], b = sorted[idx + 1]
  const tmp = a.order ?? idx + 1
  a.order = b.order ?? idx + 2
  b.order = tmp
  cacheListings()
  renderTable()
  toast('Orden actualizado', 'success')
}

function setStage(slug, stage) {
  const l = _listings.find(x => x.slug === slug)
  if (!l) return
  l.stage = stage
  if (PUBLIC_STAGES.includes(stage) && l.ref) lockRef(l.ref)
  document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden'))
  renderTable()
  updateSummary()
  cacheListings()
  toast(`Estado: ${STAGE_LABEL[stage]}`, 'success')
}

function toggleStageDropdown(slug) {
  const dd = document.getElementById('stage-dd-' + slug)
  if (!dd) return
  const wasHidden = dd.classList.contains('hidden')
  document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden'))
  if (wasHidden) {
    dd.classList.remove('hidden')
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!e.target.closest('.stage-dropdown-wrap')) {
          document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden'))
          document.removeEventListener('click', handler)
        }
      })
    }, 0)
  }
}

// ── REFERENCIA AUTO ───────────────────────────
const REF_KEY = 'an_ref_published'

function generateRef() {
  const year = new Date().getFullYear()
  const prefix = `AN${year}`
  const allNums = _listings
    .map(l => l.ref || '')
    .concat(JSON.parse(localStorage.getItem(REF_KEY) || '[]'))
    .filter(r => r.startsWith(prefix))
    .map(r => parseInt(r.slice(prefix.length), 10))
    .filter(n => !isNaN(n))
  const next = allNums.length > 0 ? Math.max(...allNums) + 1 : 1
  return prefix + String(next).padStart(2, '0')
}


function lockRef(ref) {
  const locked = JSON.parse(localStorage.getItem(REF_KEY) || '[]')
  if (!locked.includes(ref)) {
    locked.push(ref)
    localStorage.setItem(REF_KEY, JSON.stringify(locked))
  }
}

function getCurrentStage() {
  const active = document.querySelector('.pipeline-btn.is-active')
  return active ? active.dataset.stage : 'draft'
}

function updatePipelineBar(stage) {
  document.querySelectorAll('.pipeline-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.stage === stage)
  })
}

function setPipelineStage(stage) {
  updatePipelineBar(stage)
  if (PUBLIC_STAGES.includes(stage)) {
    const l = _editSlug ? _listings.find(x => x.slug === _editSlug) : null
    if (l?.ref) lockRef(l.ref)
  }
}

// Llama resetRefCounter() desde la consola del navegador para reiniciar el contador (solo para pruebas)
window.resetRefCounter = function () {
  localStorage.removeItem(REF_KEY)
  toast('Contador de referencias reiniciado', 'success')
}

// ── FORM ──────────────────────────────────────

function showForm(slug) {
  try { _showForm(slug) } catch(e) { console.error('[showForm error]', e); alert('Error al abrir formulario: ' + e.message) }
}
function _showForm(slug) {
  _formDirty = false
  _editSlug = slug
  const isNew = slug === null
  const l = isNew ? {} : (_listings.find(x => x.slug === slug) || {})

  document.getElementById('form-title').textContent = isNew ? 'Nueva propiedad' : l.title || 'Editar propiedad'
  document.getElementById('btn-delete').style.display = isNew ? 'none' : ''

  // Reset tabs + progress bar
  document.querySelectorAll('.ftab').forEach((t, i) => t.classList.toggle('active', i === 0))
  document.querySelectorAll('.tab-panel').forEach((p, i) => {
    p.classList.remove('hidden')
    p.classList.toggle('active', i === 0)
  })
  const _prog = document.getElementById('form-tab-progress')
  if (_prog) _prog.style.width = '16.67%'

  // Basic
  document.getElementById('f-original-slug').value = l.slug || ''
  document.getElementById('f-title').value         = l.title || ''
  document.getElementById('f-slug').value          = l.slug || ''
  document.getElementById('f-ref').value           = isNew ? generateRef() : (l.ref || '')

  // Price: parse "€830,000" or "€7,700/mes" back into num + postfix
  const _priceStr = l.price || ''
  const _pricePostfixMatch = _priceStr.match(/(\/\S+)$/)
  document.getElementById('f-price-num').value     = _priceStr.replace(/^€/, '').replace(/(\/\S+)$/, '').trim()
  document.getElementById('f-price-postfix').value = _pricePostfixMatch ? _pricePostfixMatch[1] : ''

  // Location cascade — populate province/city/zone from stored fields or migrate from old neighbourhood string
  {
    let province = l.province || ''
    let city     = l.city || ''
    let zone     = l.zone || ''
    if (!province && l.neighbourhood) {
      // Migrate "Zone, City" → zone + city (best-effort)
      const parts = l.neighbourhood.split(',').map(s => s.trim())
      const maybeCity = parts[parts.length - 1]
      const maybeZone = parts.length > 1 ? parts.slice(0, -1).join(', ') : ''
      if (window.LOCATIONS_ES) {
        for (const [prov, cities] of Object.entries(LOCATIONS_ES.cities)) {
          if (cities.includes(maybeCity)) { province = prov; city = maybeCity; zone = maybeZone; break }
        }
        if (!city) { city = maybeCity; zone = maybeZone }
      }
    }
    document.getElementById('f-province').value = province
    populateCitySelect(province)
    document.getElementById('f-city').value = city
    populateZoneDatalist(city)
    document.getElementById('f-zone').value = zone
  }

  const _storedAddrs = JSON.parse(localStorage.getItem('an_addresses') || '{}')
  document.getElementById('f-address').value       = l.address || _storedAddrs[l.slug] || ''
  document.getElementById('f-lat').value           = l.lat != null ? l.lat : ''
  document.getElementById('f-lng').value           = l.lng != null ? l.lng : ''
  initMapPicker(l.lat, l.lng, l.address || _storedAddrs[l.slug] || '')
  document.getElementById('f-door-floor').value    = l.doorFloor || ''
  document.getElementById('f-door-num').value      = l.doorNum || ''
  document.getElementById('f-zip').value           = l.zip || ''
  document.getElementById('f-property-type').value = l.propertyType || 'apartment'

  const _typeRadio = document.querySelector(`input[name="f-type"][value="${l.type || 'sale'}"]`)
  if (_typeRadio) _typeRadio.checked = true

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
  updatePipelineBar(l.stage || 'draft')

  // Init Google Maps autocomplete on address field (once)
  initAddressAutocomplete()

  // Gallery — ALL images including main (first card = main)
  const galleryEl = document.getElementById('gallery-list')
  galleryEl.innerHTML = ''
  ;(l.images || (l.image ? [{ src: l.image, alt: l.title }] : [])).forEach(img => addGalleryCard(img))
  refreshGalleryBadges()

  // PDF hero
  setPdfHero(l.pdf_hero || '')

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

  // Apply admin UI language matching the current source-lang selector
  const currentLang = document.getElementById('f-source-lang')?.value || 'es'
  applyAdminLang(currentLang === 'auto' ? 'es' : currentLang)

  switchView('form')
} // end _showForm

/* ── LOCATION CASCADE ─────────────────────────── */
function initLocationCascade() {
  const sel = document.getElementById('f-province')
  if (!sel || !window.LOCATIONS_ES) return
  LOCATIONS_ES.provinces.forEach(p => {
    const opt = document.createElement('option')
    opt.value = opt.textContent = p
    sel.appendChild(opt)
  })
}

function populateCitySelect(province) {
  const sel = document.getElementById('f-city')
  if (!sel) return
  sel.innerHTML = '<option value="">— Selecciona ciudad —</option>'
  sel.disabled = !province
  if (!province || !window.LOCATIONS_ES) return
  const cities = LOCATIONS_ES.cities[province] || []
  cities.forEach(c => {
    const opt = document.createElement('option')
    opt.value = opt.textContent = c
    sel.appendChild(opt)
  })
}

function populateZoneDatalist(city) {
  const dl = document.getElementById('zone-list')
  if (!dl) return
  dl.innerHTML = ''
  if (!city || !window.LOCATIONS_ES) return
  const zones = LOCATIONS_ES.zones[city] || []
  zones.forEach(z => {
    const opt = document.createElement('option')
    opt.value = z
    dl.appendChild(opt)
  })
}

function showPropsList() {
  switchView('props')
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view === 'props'))
}

function switchView(name) {
  if (name !== 'form' && _formDirty) {
    if (!confirm('Tienes cambios sin guardar en la propiedad. ¿Salir sin guardar?')) return
  }
  _formDirty = false
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'hidden'))
  document.getElementById('view-' + name)?.classList.add('active')
}

// ── SAVE ──────────────────────────────────────
function setPdfHero(url) {
  const preview = document.getElementById('pdf-hero-preview')
  const img     = document.getElementById('pdf-hero-img')
  const text    = document.getElementById('pdf-hero-upload-text')
  if (url) {
    img.src = url
    preview.classList.remove('hidden')
    text.textContent = 'Cambiar foto'
  } else {
    img.src = ''
    preview.classList.add('hidden')
    text.textContent = '+ Subir foto'
  }
}

function openPropertyPdf() {
  const slug = document.getElementById('f-slug').value.trim()
  if (!slug) { toast('Guarda la propiedad primero para generar el PDF', 'error'); return }
  window.open('../property-print.html?slug=' + encodeURIComponent(slug), '_blank')
}

async function saveProperty() {
  const slug = document.getElementById('f-slug').value.trim()
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  if (!slug) { toast('El slug es obligatorio', 'error'); return }

  const title = document.getElementById('f-title').value.trim()
  if (!title) { toast('El título es obligatorio', 'error'); document.querySelector('.ftab[data-tab="basic"]')?.click(); return }

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

  const pdfHeroEl = document.getElementById('pdf-hero-img')
  const pdfHero = (pdfHeroEl.src && !pdfHeroEl.src.endsWith('/admin/index.html')) ? pdfHeroEl.src : ''

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

  // Type from radio (sale/rent)
  const _typeChecked = document.querySelector('input[name="f-type"]:checked')
  const type = _typeChecked ? _typeChecked.value : 'sale'

  // Badge type auto from propertyType
  const BADGE_MAP = { apartment:'Apartment', penthouse:'Penthouse', villa:'Villa', house:'House', townhouse:'Townhouse', studio:'Studio', office:'Office', land:'Land' }
  const propertyType = document.getElementById('f-property-type').value
  const badge_type = BADGE_MAP[propertyType] || propertyType.charAt(0).toUpperCase() + propertyType.slice(1)

  const listing = {
    slug,
    title:         document.getElementById('f-title').value.trim(),
    price,
    ref:           document.getElementById('f-ref').value.trim(),
    province:      document.getElementById('f-province').value.trim() || undefined,
    city:          document.getElementById('f-city').value.trim() || undefined,
    zone:          document.getElementById('f-zone').value.trim() || undefined,
    neighbourhood: (() => {
      const z = document.getElementById('f-zone').value.trim()
      const c = document.getElementById('f-city').value.trim()
      if (z && c) return `${z}, ${c}`
      return c || z || ''
    })(),
    address:       document.getElementById('f-address').value.trim() || undefined,
    lat:           document.getElementById('f-lat').value  ? parseFloat(document.getElementById('f-lat').value)  : undefined,
    lng:           document.getElementById('f-lng').value  ? parseFloat(document.getElementById('f-lng').value)  : undefined,
    doorFloor:     document.getElementById('f-door-floor').value.trim() || undefined,
    doorNum:       document.getElementById('f-door-num').value.trim() || undefined,
    zip:           document.getElementById('f-zip').value.trim() || undefined,
    type,
    propertyType,
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
    pdf_hero:     pdfHero || undefined,
    description:  description.length ? description : undefined,
    details:      details.length ? details : undefined,
    features:     Object.keys(features).length ? features : undefined,
    nearby:       nearby.length ? nearby : undefined,
    stage:        getCurrentStage(),
    translations: (() => { try { const v = document.getElementById('f-translations').value; return v ? JSON.parse(v) : undefined } catch { return undefined } })(),
    order:        (() => {
      if (original) {
        const existing = _listings.find(l => l.slug === original)
        return existing?.order ?? (_listings.length + 1)
      }
      const maxOrder = _listings.reduce((m, l) => Math.max(m, l.order ?? 0), 0)
      return maxOrder + 1
    })(),
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

  if (PUBLIC_STAGES.includes(listing.stage) && listing.ref) lockRef(listing.ref)

  _formDirty = false
  cacheListings()
  toast('Propiedad guardada. Exporta el JSON para publicar.', 'success')
  showPropsList()
  renderTable()
  updateSummary()
}

// ── DELETE ────────────────────────────────────
function confirmDelete(slug) {
  const deleteSlug = typeof slug === 'string' ? slug : _editSlug
  const l = _listings.find(x => x.slug === deleteSlug)
  if (!l) return
  const backup = JSON.parse(JSON.stringify(l))
  _listings = _listings.filter(x => x.slug !== deleteSlug)
  cacheListings()
  if (_editSlug === deleteSlug) showPropsList()
  renderTable()
  updateSummary()
  toastUndo(`"${l.title.length > 28 ? l.title.substring(0, 26) + '…' : l.title}" eliminada`, () => {
    _listings.push(backup)
    cacheListings()
    renderTable()
    updateSummary()
    toast('Eliminación deshecha', 'success')
  })
}

// ── CLONE ─────────────────────────────────────
function cloneProperty(slug) {
  const original = _listings.find(l => l.slug === slug)
  if (!original) return
  const clone = JSON.parse(JSON.stringify(original))
  const maxOrder = _listings.reduce((m, l) => Math.max(m, l.order ?? 0), 0)
  clone.stage = 'draft'
  clone.order = maxOrder + 1
  let base = slug + '-copy', i = 2
  clone.slug = base
  while (_listings.find(l => l.slug === clone.slug)) clone.slug = base + '-' + i++
  clone.title = original.title + ' (copia)'
  _listings.push(clone)
  cacheListings()
  renderTable()
  updateSummary()
  toast('Propiedad duplicada como borrador', 'success')
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

function uiStr(key) {
  const raw = document.getElementById('f-source-lang')?.value || 'es'
  const lang = raw === 'auto' ? 'es' : raw
  return (ADMIN_UI[lang] || ADMIN_UI.es)[key] || ''
}

function addDescRow(text = '') {
  const div = document.createElement('div')
  div.className = 'dyn-row'
  div.innerHTML = `
    <div class="desc-wrap">
      <textarea class="desc-textarea" rows="3" data-i18n-ph="ph.desc_para" placeholder="${uiStr('ph.desc_para')}">${text}</textarea>
      <button type="button" class="btn-improve" data-i18n="btn.improve">${uiStr('btn.improve')}</button>
    </div>
    <button type="button" class="dyn-row-del" title="Eliminar">×</button>`
  div.querySelector('.dyn-row-del').onclick = () => div.remove()
  div.querySelector('.btn-improve').onclick = () => improveDesc(div)
  document.getElementById('desc-list').appendChild(div)
}

async function improveDesc(rowDiv) {
  const ta = rowDiv.querySelector('.desc-textarea')
  const btn = rowDiv.querySelector('.btn-improve')
  const text = ta.value.trim()
  if (!text) { toast('Escribe texto antes de mejorar', 'error'); return }

  const origLabel = btn.textContent
  btn.disabled = true
  btn.textContent = '⏳…'

  try {
    const lang    = document.getElementById('f-source-lang')?.value || 'auto'
    const address = document.getElementById('f-address')?.value || ''
    const price   = document.getElementById('f-price-num')?.value || ''

    const res  = await fetch(IMPROVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, address, price }),
    })
    const data = await res.json()
    if (data.error) { toast(data.error, 'error'); return }
    showImproveModal(data, ta)
  } catch {
    toast('Error de conexión', 'error')
  } finally {
    btn.disabled = false
    btn.textContent = origLabel
  }
}

function showImproveModal(data, targetTextarea) {
  document.getElementById('improve-modal')?.remove()

  const copyBtn = (id, label) =>
    `<button type="button" class="btn-copy-section" onclick="navigator.clipboard.writeText(document.getElementById('${id}').textContent).then(()=>this.textContent='✓').catch(()=>{});setTimeout(()=>this.textContent='${label}',1500)">${label}</button>`

  const kw = Array.isArray(data.keywords) ? data.keywords.map(escHtml).join(' · ') : ''

  const modal = document.createElement('div')
  modal.id = 'improve-modal'
  modal.className = 'improve-modal-overlay'
  modal.innerHTML = `
    <div class="improve-modal">
      <div class="improve-modal-hd">
        <span>✨ Resultado IA</span>
        <button type="button" class="improve-modal-close" onclick="document.getElementById('improve-modal').remove()">×</button>
      </div>
      <div class="improve-modal-body">
        ${data.h1 ? `<div class="im-section">
          <div class="im-label">📝 H1 SUGERIDO ${copyBtn('im-h1','Copiar')}</div>
          <div class="im-content" id="im-h1">${escHtml(data.h1)}</div>
        </div>` : ''}
        ${data.titleTag ? `<div class="im-section">
          <div class="im-label">🔍 TITLE TAG ${copyBtn('im-tt','Copiar')}</div>
          <div class="im-content im-mono" id="im-tt">${escHtml(data.titleTag)}</div>
        </div>` : ''}
        ${data.metaDescription ? `<div class="im-section">
          <div class="im-label">📋 META DESCRIPTION ${copyBtn('im-md','Copiar')}</div>
          <div class="im-content im-mono" id="im-md">${escHtml(data.metaDescription)}</div>
        </div>` : ''}
        ${data.editorial ? `<div class="im-section">
          <div class="im-label">✍️ TEXTO EDITORIAL ${copyBtn('im-ed','Copiar')}</div>
          <div class="im-content im-editorial" id="im-ed">${escHtml(data.editorial).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</div>
          <button type="button" class="btn-use-text">← Usar en descripción</button>
        </div>` : ''}
        ${kw ? `<div class="im-section">
          <div class="im-label">🏷️ KEYWORDS ${copyBtn('im-kw','Copiar')}</div>
          <div class="im-content im-mono" id="im-kw">${kw}</div>
        </div>` : ''}
      </div>
    </div>`

  // Wire "Usar en descripción" properly
  document.body.appendChild(modal)
  const useBtn = modal.querySelector('.btn-use-text')
  if (useBtn) {
    useBtn.onclick = () => {
      targetTextarea.value = modal.querySelector('#im-ed').innerText
      modal.remove()
    }
  }
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
}

function addDetailRow(d = {}) {
  const div = document.createElement('div')
  div.className = 'dyn-row detail-row'
  div.innerHTML = `
    <input class="det-key" type="text" data-i18n-ph="ph.det_key" placeholder="${uiStr('ph.det_key')}" value="${escHtml(d.key || '')}" style="flex:1" />
    <input class="det-val" type="text" data-i18n-ph="ph.det_val" placeholder="${uiStr('ph.det_val')}" value="${escHtml(d.val || '')}" style="flex:1" />
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
    <input class="nb-name" type="text" data-i18n-ph="ph.nb_name" placeholder="${uiStr('ph.nb_name')}" value="${n.name || ''}" style="flex:2" />
    <input class="nb-dist" type="text" data-i18n-ph="ph.nb_dist" placeholder="${uiStr('ph.nb_dist')}" value="${n.dist || ''}" style="flex:1" />
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

// ── PUBLISH — direct GitHub API (works from file:// and live site) ──────────
const GH_OWNER  = 'anrealestate'
const GH_REPO   = 'an-real-esate'
const GH_BRANCH = 'main'
const GH_API    = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`

function ghHeaders(token) {
  return {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
  }
}

async function ghGet(token, path) {
  const r = await fetch(`${GH_API}/${path}`, { headers: ghHeaders(token) })
  if (!r.ok) throw new Error(`GitHub GET ${path}: ${r.status}`)
  return r.json()
}

async function ghPut(token, path, content, sha, message) {
  const r = await fetch(`${GH_API}/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
      branch: GH_BRANCH,
    }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.message || `GitHub PUT ${path}: ${r.status}`)
  }
  return r.json()
}

async function publishToWeb() {
  // Get or ask for GitHub token (stored locally, never leaves the browser)
  let token = localStorage.getItem('an_gh_token') || ''
  if (!token) {
    token = prompt('GitHub Personal Access Token (scope: repo):\n\nSólo se pide una vez — se guarda en este navegador.')?.trim() || ''
    if (!token) { toast('Publicación cancelada', ''); return }
    localStorage.setItem('an_gh_token', token)
  }

  const btn = document.getElementById('publish-btn')
  const orig = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/></circle></svg> Subiendo…'

  try {
    const listings = _listings
    const results  = []

    // 1 — data/listings.json
    const jsonContent = JSON.stringify({ listings }, null, 2)
    const jsonFile    = await ghGet(token, 'data/listings.json')
    await ghPut(token, 'data/listings.json', jsonContent, jsonFile.sha, `Publish listings (${listings.length} properties)`)
    results.push('data/listings.json')

    // 2 — inline data in index.html
    const indexFile    = await ghGet(token, 'index.html')
    const indexContent = decodeURIComponent(escape(atob(indexFile.content.replace(/\n/g, ''))))
    const inlineJson   = JSON.stringify({ listings })
    const updated = indexContent.replace(
      /(<script[^>]+id="listings-data"[^>]*>)([\s\S]*?)(<\/script>)/,
      `$1${inlineJson}$3`
    )
    if (updated !== indexContent) {
      await ghPut(token, 'index.html', updated, indexFile.sha, `Sync inline listings data (${listings.length} properties)`)
      results.push('index.html')
    }

    // 3 — data-listings.js
    const dlFile    = await ghGet(token, 'data-listings.js')
    const dlContent = `/* Shared listings data — auto-generated */\n;(function () {\n  const el = document.getElementById('listings-data')\n  if (el) return\n  const s = document.createElement('script')\n  s.id   = 'listings-data'\n  s.type = 'application/json'\n  s.textContent = JSON.stringify(${JSON.stringify({ listings })})\n  document.head.appendChild(s)\n})()\n`
    await ghPut(token, 'data-listings.js', dlContent, dlFile.sha, `Sync data-listings.js (${listings.length} properties)`)
    results.push('data-listings.js')

    // 4 — admin/index.html inline data (best-effort — failure does not block publish success)
    try {
      const adminFile    = await ghGet(token, 'admin/index.html')
      const adminContent = decodeURIComponent(escape(atob(adminFile.content.replace(/\n/g, ''))))
      const adminUpdated = adminContent.replace(
        /(<script[^>]+id="listings-data"[^>]*>)([\s\S]*?)(<\/script>)/,
        `$1${inlineJson}$3`
      )
      if (adminUpdated !== adminContent) {
        await ghPut(token, 'admin/index.html', adminUpdated, adminFile.sha, `Sync admin listings data (${listings.length} properties)`)
        results.push('admin/index.html')
      }
    } catch { /* non-critical — admin uses localStorage cache as primary source anyway */ }

    toast(`✓ Publicado — ${listings.length} propiedades. La web se actualizará en ~30 s.`, 'success')
  } catch (e) {
    if (e.message.includes('401') || e.message.includes('Bad credentials')) {
      localStorage.removeItem('an_gh_token')
      toast('Token inválido — eliminado. Intenta de nuevo para introducir uno nuevo.', 'error')
    } else {
      toast('Error al subir: ' + e.message, 'error')
    }
  } finally {
    btn.disabled = false
    btn.innerHTML = orig
  }
}

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

// ── MAP PICKER (Leaflet / OpenStreetMap — no API key needed) ──────────
let _mapPickerMap    = null
let _mapPickerMarker = null
let _mapPickerPending = null

function _buildMapAt(coord) {
  const mapEl = document.getElementById('admin-map-picker')
  if (!mapEl || !window.L) return
  mapEl.innerHTML = ''

  if (_mapPickerMap) { _mapPickerMap.remove(); _mapPickerMap = null }

  const map = L.map(mapEl, { zoomControl: true }).setView([coord.lat, coord.lng], 15)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)

  const icon = L.divIcon({
    html: '<div style="width:14px;height:14px;background:#c8a96e;border:2px solid #091F38;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7], className: '',
  })
  const marker = L.marker([coord.lat, coord.lng], { draggable: true, icon }).addTo(map)

  function updateCoords(latlng) {
    document.getElementById('f-lat').value = latlng.lat.toFixed(7)
    document.getElementById('f-lng').value = latlng.lng.toFixed(7)
    _formDirty = true
  }
  marker.on('dragend', () => updateCoords(marker.getLatLng()))
  map.on('click', e => { marker.setLatLng(e.latlng); updateCoords(e.latlng) })

  setTimeout(() => map.invalidateSize(), 80)
  _mapPickerMap    = map
  _mapPickerMarker = marker
}

function _geocodeAndBuild(addr, silent = true) {
  fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`, {
    headers: { 'Accept-Language': 'es', 'User-Agent': 'AN-RealEstate-Admin/1.0' }
  })
  .then(r => r.json())
  .then(results => {
    if (!results.length) {
      if (!silent) toast('No se encontraron coordenadas para esa dirección', 'error')
      return
    }
    const coord = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
    _buildMapAt(coord)
    document.getElementById('f-lat').value = coord.lat.toFixed(7)
    document.getElementById('f-lng').value = coord.lng.toFixed(7)
    if (!silent) toast('Mapa centrado en la dirección', 'success')
  })
  .catch(() => { if (!silent) toast('Error al obtener coordenadas', 'error') })
}

function initMapPicker(lat, lng, address) {
  _mapPickerPending = { lat, lng, address }
  _mapPickerMap = null
  _mapPickerMarker = null
}

function openMapPickerTab() {
  if (_mapPickerMap) { setTimeout(() => _mapPickerMap.invalidateSize(), 80); return }
  if (!_mapPickerPending) return
  const { lat, lng, address } = _mapPickerPending
  function tryRender() {
    if (!window.L) { setTimeout(tryRender, 200); return }
    if (lat && lng) {
      _buildMapAt({ lat: parseFloat(lat), lng: parseFloat(lng) })
    } else if (address) {
      _geocodeAndBuild(address)
    } else {
      _buildMapAt({ lat: 41.3874, lng: 2.1686 })
    }
  }
  tryRender()
}

// "↺ Desde dirección" button
document.addEventListener('click', e => {
  if (e.target.id !== 'btn-map-reset') return
  const addr = document.getElementById('f-address')?.value.trim()
  if (!addr) { toast('Escribe una dirección primero', 'error'); return }
  _geocodeAndBuild(addr, false)
})

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

    // Auto-update map picker from selected address
    if (place.geometry?.location) {
      const loc = place.geometry.location
      const lat = loc.lat(), lng = loc.lng()
      document.getElementById('f-lat').value = lat.toFixed(7)
      document.getElementById('f-lng').value = lng.toFixed(7)
      _mapPickerPending = { lat, lng, address: place.formatted_address }
      if (_mapPickerMap) {
        _mapPickerMap.setView([lat, lng], 15)
        _mapPickerMarker?.setLatLng([lat, lng])
      }
    }

    // Zip
    const zip = comps.find(c => c.types.includes('postal_code'))?.long_name || ''
    if (zip) document.getElementById('f-zip').value = zip

    // Province (administrative_area_level_2 in Spain)
    const provRaw = comps.find(c => c.types.includes('administrative_area_level_2'))?.long_name || ''
    // City (locality or administrative_area_level_3)
    const cityRaw = (
      comps.find(c => c.types.includes('locality'))?.long_name ||
      comps.find(c => c.types.includes('administrative_area_level_3'))?.long_name || ''
    )
    // Zone/neighbourhood
    const zoneRaw = (
      comps.find(c => c.types.includes('sublocality_level_1'))?.long_name ||
      comps.find(c => c.types.includes('sublocality'))?.long_name ||
      comps.find(c => c.types.includes('neighborhood'))?.long_name || ''
    )

    if (!window.LOCATIONS_ES || (!provRaw && !cityRaw)) return

    // Normalise string for loose matching (remove accents, lowercase)
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^provincia de /i, '').trim()

    // Match province
    const matchedProv = LOCATIONS_ES.provinces.find(p => norm(p) === norm(provRaw)) || ''
    if (matchedProv) {
      document.getElementById('f-province').value = matchedProv
      populateCitySelect(matchedProv)
    }

    // Match city within province (or across all if province not found)
    const cityList = matchedProv ? (LOCATIONS_ES.cities[matchedProv] || []) : Object.values(LOCATIONS_ES.cities).flat()
    const matchedCity = cityList.find(c => norm(c) === norm(cityRaw)) || cityRaw
    if (matchedCity) {
      document.getElementById('f-city').value = matchedCity
      populateZoneDatalist(matchedCity)
    }

    // Zone — use Google's suggestion, user can edit
    if (zoneRaw) document.getElementById('f-zone').value = zoneRaw
  })
  _mapsACInited = true
}

// ── WATERMARK TOOL ────────────────────────────
function initWatermarkTool() {
  const fileInput = document.getElementById('wm-file')
  const dropArea  = document.getElementById('wm-drop')
  const sizeSlider    = document.getElementById('wm-size')
  const opacitySlider = document.getElementById('wm-opacity')

  // Restore saved settings
  const savedSize    = localStorage.getItem('an_wm_size')
  const savedOpacity = localStorage.getItem('an_wm_opacity')
  if (savedSize)    { sizeSlider.value    = savedSize;    document.getElementById('wm-size-val').textContent    = savedSize    + '%' }
  if (savedOpacity) { opacitySlider.value = savedOpacity; document.getElementById('wm-opacity-val').textContent = savedOpacity + '%' }
  document.querySelectorAll('.pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === _wmPosition))

  sizeSlider.addEventListener('input', () => {
    document.getElementById('wm-size-val').textContent = sizeSlider.value + '%'
    localStorage.setItem('an_wm_size', sizeSlider.value)
    reprocessAll()
    _paintPreview()
  })

  opacitySlider.addEventListener('input', () => {
    document.getElementById('wm-opacity-val').textContent = opacitySlider.value + '%'
    localStorage.setItem('an_wm_opacity', opacitySlider.value)
    reprocessAll()
    _paintPreview()
  })

  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      _wmPosition = btn.dataset.pos
      localStorage.setItem('an_wm_pos', _wmPosition)
      reprocessAll()
      _paintPreview()
    })
  })

  const autoApplyEl = document.getElementById('wm-auto-apply')
  autoApplyEl.checked = _wmAutoApply
  autoApplyEl.addEventListener('change', () => {
    _wmAutoApply = autoApplyEl.checked
    localStorage.setItem('an_wm_auto', _wmAutoApply ? '1' : '0')
  })

  function setLogoPreview(dataUrl) {
    const preview = document.getElementById('wm-logo-preview')
    const label   = document.getElementById('wm-logo-upload-label')
    const text    = document.getElementById('wm-logo-upload-text')
    const remove  = document.getElementById('wm-logo-remove')
    if (dataUrl) {
      preview.src = dataUrl
      preview.classList.remove('hidden')
      label.classList.add('wm-logo-has')
      text.textContent = 'Cambiar logo'
      remove.classList.remove('hidden')
    } else {
      preview.src = ''
      preview.classList.add('hidden')
      label.classList.remove('wm-logo-has')
      text.textContent = 'Subir logo (PNG/SVG)'
      remove.classList.add('hidden')
    }
  }

  setLogoPreview(localStorage.getItem('an_wm_logo'))

  document.getElementById('wm-logo-file').addEventListener('change', e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      localStorage.setItem('an_wm_logo', ev.target.result)
      setLogoPreview(ev.target.result)
      toast('Logo guardado', 'success')
      renderLivePreview()
    }
    reader.readAsDataURL(file)
  })

  document.getElementById('wm-logo-remove').addEventListener('click', () => {
    localStorage.removeItem('an_wm_logo')
    setLogoPreview(null)
    toast('Logo eliminado — se usará el logo de texto AN', 'success')
    renderLivePreview()
  })

  // Sample image for live preview
  function setSampleBtnText(hasImage) {
    const t = document.getElementById('wm-sample-btn-text')
    if (t) t.textContent = hasImage ? 'Cambiar imagen' : 'Subir imagen de ejemplo'
  }
  setSampleBtnText(!!_wmSampleDataUrl)

  document.getElementById('wm-sample-file').addEventListener('change', e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      _wmSampleDataUrl = ev.target.result
      try { localStorage.setItem('an_wm_sample', _wmSampleDataUrl) } catch { /* quota */ }
      setSampleBtnText(true)
      renderLivePreview()
    }
    reader.readAsDataURL(file)
  })

  renderLivePreview()

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

// Synchronous paint — always reads current settings, no async race possible
function _paintPreview() {
  const canvas = document.getElementById('wm-preview-canvas')
  const empty  = document.getElementById('wm-live-empty')
  if (!canvas || !empty || !_cachedSampleImg || !_cachedLogoImg) return

  // Render at native resolution — CSS (width:100%) scales for display, output is pixel-perfect
  const w = _cachedSampleImg.naturalWidth  || _cachedSampleImg.width
  const h = _cachedSampleImg.naturalHeight || _cachedSampleImg.height

  canvas.width = 0
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(_cachedSampleImg, 0, 0, w, h)

  const sizeRatio = parseInt(document.getElementById('wm-size').value) / 100
  const opacity   = parseInt(document.getElementById('wm-opacity').value) / 100
  const logoW  = w * sizeRatio
  const logoH  = _cachedLogoImg.height * (logoW / _cachedLogoImg.width)
  const margin = w * 0.025
  const pos    = _wmPosition

  let x = margin, y = h - logoH - margin
  if (pos.includes('right'))                          x = w - logoW - margin
  if (pos.includes('center') && !pos.includes('mid')) x = (w - logoW) / 2
  if (pos.includes('top'))                            y = margin
  if (pos.includes('mid'))                            y = (h - logoH) / 2
  if (pos === 'center') { x = (w - logoW) / 2; y = (h - logoH) / 2 }

  ctx.globalAlpha = opacity
  ctx.drawImage(_cachedLogoImg, x, y, logoW, logoH)
  ctx.globalAlpha = 1

  canvas.classList.remove('hidden')
  empty.classList.add('hidden')
}

// Loads/reloads images then paints — call when logo or sample changes
async function renderLivePreview() {
  const gen    = ++_previewGen
  const canvas = document.getElementById('wm-preview-canvas')
  const empty  = document.getElementById('wm-live-empty')
  if (!canvas || !empty) return

  if (!_wmSampleDataUrl) {
    _cachedSampleImg = null
    canvas.classList.add('hidden')
    empty.classList.remove('hidden')
    return
  }

  const logoDataUrl = await getLogoDataUrl()
  if (gen !== _previewGen) return

  const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src })
  const [sampleImg, logoImg] = await Promise.all([loadImg(_wmSampleDataUrl), loadImg(logoDataUrl)])
  if (gen !== _previewGen) return

  _cachedSampleImg = sampleImg
  _cachedLogoImg   = logoImg
  _paintPreview()
}

function getLogoDataUrl() {
  const stored = localStorage.getItem('an_wm_logo')
  if (stored) return Promise.resolve(stored)
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

function processWatermarkFromUrl(url, logoDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth  || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const logo = new Image()
      logo.onload = () => {
        const sizeRatio = parseInt(document.getElementById('wm-size').value) / 100
        const opacity   = parseInt(document.getElementById('wm-opacity').value) / 100
        const logoW  = canvas.width * sizeRatio
        const logoH  = logo.height * (logoW / logo.width)
        const margin = canvas.width * 0.025
        const pos    = _wmPosition
        let x = margin, y = canvas.height - logoH - margin
        if (pos.includes('right'))                          x = canvas.width - logoW - margin
        if (pos.includes('center') && !pos.includes('mid')) x = (canvas.width - logoW) / 2
        if (pos.includes('top'))                            y = margin
        if (pos.includes('mid'))                            y = (canvas.height - logoH) / 2
        if (pos === 'center') { x = (canvas.width - logoW) / 2; y = (canvas.height - logoH) / 2 }
        ctx.globalAlpha = opacity
        ctx.drawImage(logo, x, y, logoW, logoH)
        ctx.globalAlpha = 1
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      }
      logo.onerror = () => reject(new Error('Logo load failed'))
      logo.src = logoDataUrl
    }
    img.onerror = () => reject(new Error('Image load failed'))
    // Cache-bust forces a fresh CORS fetch — avoids canvas taint from cached non-CORS response
    img.src = url + (url.includes('?') ? '&' : '?') + '_cors=1'
  })
}

async function applyLogoToGallery() {
  const cards = [...document.querySelectorAll('#gallery-list .gal-card')].filter(c => {
    const img = c.querySelector('img')
    return img && img.src && !img.src.startsWith('data:image/svg')
  })
  if (!cards.length) { toast('No hay fotos en la galería', 'error'); return }

  const confirmed = await showConfirmAsync(
    `¿Aplicar logo AN a las ${cards.length} foto${cards.length > 1 ? 's' : ''} de la galería?`,
    { okText: 'Sí, aplicar', okClass: 'btn-gold' }
  )
  if (!confirmed) return

  const logoDataUrl = await getLogoDataUrl()
  const progressWrap = document.getElementById('upload-gallery-progress')
  const statusEl     = document.getElementById('upload-gallery-status')
  const total = cards.length
  let successCount = 0

  _wmAbort = false
  const cancelBtn = document.getElementById('gallery-cancel-btn')
  if (cancelBtn) cancelBtn.classList.remove('hidden')
  progressWrap.classList.remove('hidden')
  try {
    for (let i = 0; i < cards.length; i++) {
      if (_wmAbort) { statusEl.textContent = 'Cancelado'; toast('Proceso cancelado', ''); break }
      const card = cards[i]
      const img  = card.querySelector('img')
      statusEl.textContent = `Procesando ${i + 1} de ${total}…`
      setProgress('upload-gallery-fill', Math.round((i / total) * 100))
      try {
        const watermarkedDataUrl = await processWatermarkFromUrl(img.src, logoDataUrl)
        const filename = (img.src.split('/').pop()?.split('?')[0] || `photo-${i + 1}`) + '.jpg'
        const file = dataUrlToFile(watermarkedDataUrl, filename)
        const newUrl = await uploadFile(file, null, 'upload-gallery-fill', null)
        if (newUrl) {
          img.src = newUrl
          card.dataset.src = newUrl
          successCount++
        }
      } catch (err) {
        console.warn('[apply-logo] skipped:', err.message)
      }
    }
  } finally {
    setProgress('upload-gallery-fill', 100)
    if (cancelBtn) cancelBtn.classList.add('hidden')
    setTimeout(() => progressWrap.classList.add('hidden'), 600)
  }

  if (successCount > 0) {
    await saveProperty()
    toast(`Logo aplicado a ${successCount} foto${successCount > 1 ? 's' : ''} — publica para ver los cambios en la web`, 'success')
  } else if (!_wmAbort) {
    toast('No se pudo aplicar el logo (¿CORS?)', 'error')
  }
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

function dataUrlToFile(dataUrl, name) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], name, { type: mime })
}

function showConfirmAsync(msg, { okText = 'Confirmar', okClass = 'btn-gold' } = {}) {
  return new Promise(resolve => {
    const okBtn = document.getElementById('confirm-ok')
    const prevText  = okBtn.textContent
    const prevClass = okBtn.className
    okBtn.textContent = okText
    okBtn.className   = okClass

    document.getElementById('confirm-msg').textContent = msg
    document.getElementById('confirm-overlay').classList.remove('hidden')

    function restore() {
      okBtn.textContent = prevText
      okBtn.className   = prevClass
      document.getElementById('confirm-overlay').classList.add('hidden')
    }

    document.getElementById('confirm-ok').addEventListener('click', () => {
      restore(); resolve(true)
    }, { once: true })
    document.getElementById('confirm-cancel').addEventListener('click', () => {
      restore(); resolve(false)
    }, { once: true })
  })
}

// ── IMAGE COMPRESSION ─────────────────────────
function compressImage(file, maxPx = 2400, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      if (w <= maxPx && h <= maxPx && file.size <= 9 * 1024 * 1024) {
        resolve(file)
        return
      }
      const scale = Math.min(1, maxPx / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.src = url
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
        let errMsg = xhr.status
        try { errMsg = JSON.parse(xhr.responseText)?.error?.message || xhr.status } catch {}
        console.error('[upload] Cloudinary error:', errMsg, xhr.responseText)
        toast('Error al subir imagen: ' + errMsg, 'error')
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

// ── ADMIN UI i18n ─────────────────────────────
const FEAT_LABELS = {
  es: {
    'High Ceilings':'Techos altos','Vaulted Ceiling(s)':'Techo(s) abovedado(s)','Volta Catalana':'Volta Catalana',
    'Ceilings with moldings':'Techos con molduras','Open Floorplan':'Distribución abierta','Natural Light':'Luz natural',
    'Period Features':'Elementos de época','French Doors':'Puertas francesas','Sliding Doors':'Puertas correderas',
    'Walk-In Closet(s)':'Vestidor(es)','Walk-in wardrobe(s)':'Armario empotrado','Library':'Biblioteca',
    'Playroom':'Sala de juegos','Utility room':'Cuarto de servicio','Storage':'Trastero','Split Bedroom':'Habitaciones separadas',
    'Solid Wooden Floor':'Tarima maciza','Wooden Flooring':'Suelo de madera','Marble Flooring':'Suelo de mármol',
    'Ceramic Tile Flooring':'Suelo cerámico','Mosaic tile flooring':'Suelo de mosaico',
    'Equipped Kitchen':'Cocina equipada','Open kitchen':'Cocina americana','Oven':'Horno','Convection Oven':'Horno de convección',
    'Refrigerator':'Frigorífico','Dishwasher':'Lavavajillas','Microwave':'Microondas','Freezer':'Congelador',
    'Wine Refrigerator':'Vinoteca','Range Hood':'Campana extractora','Exhaust Fan':'Extractor',
    'Wet Bar':'Barra / Bar','Solid Surface Counters':'Encimera compacta','Stone Counters':'Encimera de piedra',
    'Solid Wood Cabinets':'Muebles de madera maciza',
    'Air conditioning':'Aire acondicionado','Heating':'Calefacción','Electric Water Heater':'Calentador eléctrico',
    'Gas Water Heater':'Calentador de gas','Tankless Water Heater':'Calentador instantáneo','Thermostat':'Termostato',
    'Central Vaccum':'Aspiración centralizada','Washer':'Lavadora','Dryer':'Secadora',
    'Water Filtration System':'Filtro de agua','Water Purifier':'Purificador de agua','Water Softener':'Descalcificador',
    'Balcony':'Balcón','Terrace':'Terraza','Communal terrace':'Terraza comunitaria','Garden':'Jardín',
    'Outdoor Kitchen':'Cocina exterior','Outdoor Shower':'Ducha exterior','Swimming Pool':'Piscina','Sauna':'Sauna',
    'Chill out area':'Zona chill out','Barbaque':'Barbacoa','Fence':'Valla',
    'Tennis Court(s)':'Pista(s) de tenis','Parking':'Parking',
    'Elevator':'Ascensor','Concierge Service':'Conserjería','Modernist building':'Edificio modernista',
    'Alarm':'Alarma','Double Glazing':'Doble acristalamiento','Exterior':'Fachada exterior','Sidewalk':'Acera',
    'City Views':'Vistas a la ciudad','Sea Views':'Vistas al mar','Transport Nearby':'Transporte cercano','Renovated':'Reformado',
  },
  ca: {
    'High Ceilings':'Sostres alts','Vaulted Ceiling(s)':'Sostre(s) abovedats','Volta Catalana':'Volta Catalana',
    'Ceilings with moldings':'Sostres amb motllures','Open Floorplan':'Distribució oberta','Natural Light':'Llum natural',
    'Period Features':'Elements d\'època','French Doors':'Portes franceses','Sliding Doors':'Portes corredisses',
    'Walk-In Closet(s)':'Vestidor(s)','Walk-in wardrobe(s)':'Armari encastat','Library':'Biblioteca',
    'Playroom':'Sala de jocs','Utility room':'Quart de servei','Storage':'Traster','Split Bedroom':'Habitacions separades',
    'Solid Wooden Floor':'Tarima de fusta massissa','Wooden Flooring':'Parquet de fusta','Marble Flooring':'Sòl de marbre',
    'Ceramic Tile Flooring':'Sòl ceràmic','Mosaic tile flooring':'Sòl de mosaic',
    'Equipped Kitchen':'Cuina equipada','Open kitchen':'Cuina americana','Oven':'Forn','Convection Oven':'Forn de convecció',
    'Refrigerator':'Frigorífic','Dishwasher':'Rentaplats','Microwave':'Microones','Freezer':'Congelador',
    'Wine Refrigerator':'Celler vinícola','Range Hood':'Campana extractora','Exhaust Fan':'Extractor',
    'Wet Bar':'Bar','Solid Surface Counters':'Encimera compacta','Stone Counters':'Encimera de pedra',
    'Solid Wood Cabinets':'Mobles de fusta massissa',
    'Air conditioning':'Aire condicionat','Heating':'Calefacció','Electric Water Heater':'Escalfador elèctric',
    'Gas Water Heater':'Escalfador de gas','Tankless Water Heater':'Escalfador instantani','Thermostat':'Termòstat',
    'Central Vaccum':'Aspiració centralitzada','Washer':'Rentadora','Dryer':'Assecadora',
    'Water Filtration System':'Filtre d\'aigua','Water Purifier':'Purificador d\'aigua','Water Softener':'Descalcificador',
    'Balcony':'Balcó','Terrace':'Terrassa','Communal terrace':'Terrassa comunitària','Garden':'Jardí',
    'Outdoor Kitchen':'Cuina exterior','Outdoor Shower':'Dutxa exterior','Swimming Pool':'Piscina','Sauna':'Sauna',
    'Chill out area':'Zona chill out','Barbaque':'Barbacoa','Fence':'Tanca',
    'Tennis Court(s)':'Pista(es) de tennis','Parking':'Aparcament',
    'Elevator':'Ascensor','Concierge Service':'Consergeria','Modernist building':'Edifici modernista',
    'Alarm':'Alarma','Double Glazing':'Doble vidre','Exterior':'Façana exterior','Sidewalk':'Vorera',
    'City Views':'Vistes a la ciutat','Sea Views':'Vistes al mar','Transport Nearby':'Transport proper','Renovated':'Reformat',
  },
  fr: {
    'High Ceilings':'Hauts plafonds','Vaulted Ceiling(s)':'Plafond(s) voûté(s)','Volta Catalana':'Volta Catalana',
    'Ceilings with moldings':'Plafonds avec moulures','Open Floorplan':'Plan ouvert','Natural Light':'Lumière naturelle',
    'Period Features':'Éléments d\'époque','French Doors':'Portes-fenêtres','Sliding Doors':'Portes coulissantes',
    'Walk-In Closet(s)':'Dressing(s)','Walk-in wardrobe(s)':'Armoire encastrée','Library':'Bibliothèque',
    'Playroom':'Salle de jeux','Utility room':'Buanderie','Storage':'Débarras','Split Bedroom':'Chambres séparées',
    'Solid Wooden Floor':'Parquet massif','Wooden Flooring':'Parquet bois','Marble Flooring':'Sol en marbre',
    'Ceramic Tile Flooring':'Carrelage céramique','Mosaic tile flooring':'Sol en mosaïque',
    'Equipped Kitchen':'Cuisine équipée','Open kitchen':'Cuisine ouverte','Oven':'Four','Convection Oven':'Four à convection',
    'Refrigerator':'Réfrigérateur','Dishwasher':'Lave-vaisselle','Microwave':'Micro-ondes','Freezer':'Congélateur',
    'Wine Refrigerator':'Cave à vin','Range Hood':'Hotte aspirante','Exhaust Fan':'Extracteur',
    'Wet Bar':'Bar','Solid Surface Counters':'Plan de travail compact','Stone Counters':'Plan de travail en pierre',
    'Solid Wood Cabinets':'Armoires en bois massif',
    'Air conditioning':'Climatisation','Heating':'Chauffage','Electric Water Heater':'Chauffe-eau électrique',
    'Gas Water Heater':'Chauffe-eau à gaz','Tankless Water Heater':'Chauffe-eau instantané','Thermostat':'Thermostat',
    'Central Vaccum':'Aspiration centralisée','Washer':'Lave-linge','Dryer':'Sèche-linge',
    'Water Filtration System':'Système de filtration','Water Purifier':'Purificateur d\'eau','Water Softener':'Adoucisseur d\'eau',
    'Balcony':'Balcon','Terrace':'Terrasse','Communal terrace':'Terrasse commune','Garden':'Jardin',
    'Outdoor Kitchen':'Cuisine extérieure','Outdoor Shower':'Douche extérieure','Swimming Pool':'Piscine','Sauna':'Sauna',
    'Chill out area':'Espace détente','Barbaque':'Barbecue','Fence':'Clôture',
    'Tennis Court(s)':'Court(s) de tennis','Parking':'Parking',
    'Elevator':'Ascenseur','Concierge Service':'Service de conciergerie','Modernist building':'Immeuble moderniste',
    'Alarm':'Alarme','Double Glazing':'Double vitrage','Exterior':'Façade extérieure','Sidewalk':'Trottoir',
    'City Views':'Vue sur la ville','Sea Views':'Vue sur la mer','Transport Nearby':'Transports proches','Renovated':'Rénové',
  },
  de: {
    'High Ceilings':'Hohe Decken','Vaulted Ceiling(s)':'Gewölbedecke(n)','Volta Catalana':'Volta Catalana',
    'Ceilings with moldings':'Decken mit Stuckverzierungen','Open Floorplan':'Offener Grundriss','Natural Light':'Natürliches Licht',
    'Period Features':'Historische Elemente','French Doors':'Flügeltüren','Sliding Doors':'Schiebetüren',
    'Walk-In Closet(s)':'Begehbarer Kleiderschrank','Walk-in wardrobe(s)':'Einbauschrank','Library':'Bibliothek',
    'Playroom':'Spielzimmer','Utility room':'Hauswirtschaftsraum','Storage':'Abstellraum','Split Bedroom':'Getrennte Schlafzimmer',
    'Solid Wooden Floor':'Massivholzparkett','Wooden Flooring':'Holzboden','Marble Flooring':'Marmorboden',
    'Ceramic Tile Flooring':'Keramikfliesenboden','Mosaic tile flooring':'Mosaikfliesenboden',
    'Equipped Kitchen':'Einbauküche','Open kitchen':'Offene Küche','Oven':'Backofen','Convection Oven':'Umluftbackofen',
    'Refrigerator':'Kühlschrank','Dishwasher':'Geschirrspüler','Microwave':'Mikrowelle','Freezer':'Gefrierschrank',
    'Wine Refrigerator':'Weinkühlschrank','Range Hood':'Dunstabzugshaube','Exhaust Fan':'Ablüfter',
    'Wet Bar':'Bar','Solid Surface Counters':'Kompaktarbeitsplatte','Stone Counters':'Steinarbeitsplatte',
    'Solid Wood Cabinets':'Massivholzschränke',
    'Air conditioning':'Klimaanlage','Heating':'Heizung','Electric Water Heater':'Elektroboiler',
    'Gas Water Heater':'Gasboiler','Tankless Water Heater':'Durchlauferhitzer','Thermostat':'Thermostat',
    'Central Vaccum':'Zentralstaubsauger','Washer':'Waschmaschine','Dryer':'Wäschetrockner',
    'Water Filtration System':'Wasserfilteranlage','Water Purifier':'Wasserreiniger','Water Softener':'Wasserenthärter',
    'Balcony':'Balkon','Terrace':'Terrasse','Communal terrace':'Gemeinschaftsterrasse','Garden':'Garten',
    'Outdoor Kitchen':'Außenküche','Outdoor Shower':'Außendusche','Swimming Pool':'Pool','Sauna':'Sauna',
    'Chill out area':'Chill-out-Bereich','Barbaque':'Grillbereich','Fence':'Zaun',
    'Tennis Court(s)':'Tennisplatz/-plätze','Parking':'Parkplatz',
    'Elevator':'Aufzug','Concierge Service':'Concierge-Service','Modernist building':'Modernistisches Gebäude',
    'Alarm':'Alarmanlage','Double Glazing':'Doppelverglasung','Exterior':'Außenfassade','Sidewalk':'Gehweg',
    'City Views':'Stadtblick','Sea Views':'Meerblick','Transport Nearby':'Nahverkehr in der Nähe','Renovated':'Renoviert',
  },
  it: {
    'High Ceilings':'Soffitti alti','Vaulted Ceiling(s)':'Soffitto(i) a volta','Volta Catalana':'Volta Catalana',
    'Ceilings with moldings':'Soffitti con cornici','Open Floorplan':'Pianta aperta','Natural Light':'Luce naturale',
    'Period Features':'Elementi d\'epoca','French Doors':'Porte finestre','Sliding Doors':'Porte scorrevoli',
    'Walk-In Closet(s)':'Cabina armadio','Walk-in wardrobe(s)':'Armadio a muro','Library':'Biblioteca',
    'Playroom':'Sala giochi','Utility room':'Lavanderia','Storage':'Ripostiglio','Split Bedroom':'Camere separate',
    'Solid Wooden Floor':'Parquet in legno massello','Wooden Flooring':'Pavimento in legno','Marble Flooring':'Pavimento in marmo',
    'Ceramic Tile Flooring':'Pavimento in ceramica','Mosaic tile flooring':'Pavimento a mosaico',
    'Equipped Kitchen':'Cucina attrezzata','Open kitchen':'Cucina a vista','Oven':'Forno','Convection Oven':'Forno a convezione',
    'Refrigerator':'Frigorifero','Dishwasher':'Lavastoviglie','Microwave':'Microonde','Freezer':'Congelatore',
    'Wine Refrigerator':'Cantinetta vini','Range Hood':'Cappa aspirante','Exhaust Fan':'Estrattore',
    'Wet Bar':'Bar','Solid Surface Counters':'Piano lavoro compatto','Stone Counters':'Piano in pietra',
    'Solid Wood Cabinets':'Mobili in legno massello',
    'Air conditioning':'Aria condizionata','Heating':'Riscaldamento','Electric Water Heater':'Scaldabagno elettrico',
    'Gas Water Heater':'Scaldabagno a gas','Tankless Water Heater':'Scaldabagno istantaneo','Thermostat':'Termostato',
    'Central Vaccum':'Aspirapolvere centralizzato','Washer':'Lavatrice','Dryer':'Asciugatrice',
    'Water Filtration System':'Sistema di filtrazione','Water Purifier':'Purificatore d\'acqua','Water Softener':'Addolcitore',
    'Balcony':'Balcone','Terrace':'Terrazza','Communal terrace':'Terrazza condominiale','Garden':'Giardino',
    'Outdoor Kitchen':'Cucina esterna','Outdoor Shower':'Doccia esterna','Swimming Pool':'Piscina','Sauna':'Sauna',
    'Chill out area':'Area relax','Barbaque':'Barbecue','Fence':'Recinzione',
    'Tennis Court(s)':'Campo(i) da tennis','Parking':'Parcheggio',
    'Elevator':'Ascensore','Concierge Service':'Servizio di portineria','Modernist building':'Edificio modernista',
    'Alarm':'Allarme','Double Glazing':'Doppio vetro','Exterior':'Facciata esterna','Sidewalk':'Marciapiede',
    'City Views':'Vista sulla città','Sea Views':'Vista sul mare','Transport Nearby':'Trasporti vicini','Renovated':'Ristrutturato',
  },
  ru: {
    'High Ceilings':'Высокие потолки','Vaulted Ceiling(s)':'Сводчатый потолок','Volta Catalana':'Volta Catalana',
    'Ceilings with moldings':'Потолки с лепниной','Open Floorplan':'Открытая планировка','Natural Light':'Естественное освещение',
    'Period Features':'Исторические элементы','French Doors':'Французские окна','Sliding Doors':'Раздвижные двери',
    'Walk-In Closet(s)':'Гардеробная','Walk-in wardrobe(s)':'Встроенный шкаф','Library':'Библиотека',
    'Playroom':'Игровая комната','Utility room':'Подсобное помещение','Storage':'Кладовая','Split Bedroom':'Раздельные спальни',
    'Solid Wooden Floor':'Паркет из массива','Wooden Flooring':'Деревянный пол','Marble Flooring':'Мраморный пол',
    'Ceramic Tile Flooring':'Керамическая плитка','Mosaic tile flooring':'Мозаичный пол',
    'Equipped Kitchen':'Оборудованная кухня','Open kitchen':'Кухня-гостиная','Oven':'Духовой шкаф','Convection Oven':'Конвекционная духовка',
    'Refrigerator':'Холодильник','Dishwasher':'Посудомоечная машина','Microwave':'Микроволновая печь','Freezer':'Морозильник',
    'Wine Refrigerator':'Винный холодильник','Range Hood':'Вытяжка','Exhaust Fan':'Вентилятор',
    'Wet Bar':'Бар','Solid Surface Counters':'Столешница из искусственного камня','Stone Counters':'Каменная столешница',
    'Solid Wood Cabinets':'Шкафы из массива дерева',
    'Air conditioning':'Кондиционер','Heating':'Отопление','Electric Water Heater':'Электрический водонагреватель',
    'Gas Water Heater':'Газовый водонагреватель','Tankless Water Heater':'Проточный водонагреватель','Thermostat':'Термостат',
    'Central Vaccum':'Центральный пылесос','Washer':'Стиральная машина','Dryer':'Сушильная машина',
    'Water Filtration System':'Система фильтрации воды','Water Purifier':'Очиститель воды','Water Softener':'Умягчитель воды',
    'Balcony':'Балкон','Terrace':'Терраса','Communal terrace':'Общая терраса','Garden':'Сад',
    'Outdoor Kitchen':'Летняя кухня','Outdoor Shower':'Уличный душ','Swimming Pool':'Бассейн','Sauna':'Сауна',
    'Chill out area':'Зона отдыха','Barbaque':'Барбекю','Fence':'Забор',
    'Tennis Court(s)':'Теннисный корт(ы)','Parking':'Парковка',
    'Elevator':'Лифт','Concierge Service':'Консьерж-сервис','Modernist building':'Модернистское здание',
    'Alarm':'Сигнализация','Double Glazing':'Двойное остекление','Exterior':'Внешний фасад','Sidewalk':'Тротуар',
    'City Views':'Вид на город','Sea Views':'Вид на море','Transport Nearby':'Транспорт рядом','Renovated':'После ремонта',
  },
}

const ADMIN_UI = {
  es: {
    'tab.basic':'Básico','tab.images':'Imágenes','tab.desc':'Descripción','tab.details':'Detalles','tab.feats':'Características','tab.nearby':'Ubicación',
    'btn.back':'← Volver','btn.delete':'Eliminar','btn.save':'Guardar','lang.label':'Idioma de entrada:',
    'label.title':'Título','label.slug':'Slug (URL)','label.ref':'Referencia',
    'label.status':'Estado','label.status.sale':'En venta','label.status.rent':'En alquiler',
    'label.type':'Tipo de propiedad','label.price':'Precio','label.neighbourhood':'Barrio',
    'label.address':'Dirección exacta','label.address.hint':'(solo visible en admin y hoja de visita)',
    'label.zip':'Código postal','label.size':'Superficie construida (m²)','label.land':'Superficie terreno (m²)',
    'label.beds':'Habitaciones','label.baths':'Baños','label.garage':'Garaje','label.floor':'Planta',
    'label.year':'Año de construcción','label.year_ren':'Año de renovación',
    'label.condition':'Condición','label.energy':'Clase energética',
    'label.published':'Publicada en la web','label.sold':'Marcada como vendida / alquilada',
    'ph.title':'Ej: Elegant Penthouse with Sea Views','ph.slug':'ej: gracia-garden','ph.ref':'ej: AN-2026-001',
    'ph.address':'Busca la dirección…','ph.zip':'ej: 08012','ph.size':'ej: 94','ph.land':'ej: 450',
    'ph.year':'ej: 1920','ph.year_ren':'ej: 2022',
    'opt.select':'— Selecciona —','opt.optional':'(opcional)','opt.sale':'— venta —',
    'opt.month':'/mes','opt.week':'/semana','opt.night':'/noche',
    'opt.type.apartment':'Apartamento','opt.type.penthouse':'Ático','opt.type.villa':'Villa',
    'opt.type.house':'Casa','opt.type.townhouse':'Casa adosada','opt.type.studio':'Estudio',
    'opt.type.office':'Oficina / Comercial','opt.type.land':'Solar / Terreno',
    'opt.garage.no':'No','opt.garage.1':'1 plaza','opt.garage.2':'2 plazas','opt.garage.3':'3 plazas','opt.garage.4':'4 plazas','opt.garage.7':'7 plazas',
    'opt.floor.ground':'Planta baja','opt.floor.mezz':'Entresuelo','opt.floor.principal':'Principal',
    'opt.floor.upper':'Planta alta','opt.floor.penthouse':'Ático','opt.floor.3lev':'3 niveles','opt.floor.4lev':'4 niveles',
    'opt.cond.new':'Nueva construcción','opt.cond.renov':'En renovación','opt.cond.newly':'Recién renovado',
    'opt.cond.turnkey':'Reforma llave en mano','opt.cond.good':'Buen estado','opt.cond.torenovate':'A reformar',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Estudio / 0',
    'feat.interior':'Interior','feat.flooring':'Suelos','feat.kitchen':'Cocina','feat.climate':'Climatización',
    'feat.outdoor':'Exterior','feat.building':'Edificio','feat.views':'Vistas & Entorno',
    'feat.custom':'Características adicionales','feat.custom.hint':'(una por línea)',
    'btn.improve':'✨ Mejorar con IA',
    'list.photos':'Fotos — arrastra para ordenar','btn.upload':'+ Subir fotos',
    'hint.photos':'La primera foto es la imagen principal. Arrastra para reordenar.','uploading':'Subiendo…',
    'list.desc':'Párrafos de descripción','btn.add_para':'+ Párrafo',
    'list.details':'Tabla de detalles','btn.add_row':'+ Fila',
    'list.nearby':'Lugares cercanos','btn.add_place':'+ Lugar',
    'ph.desc_para':'Párrafo de descripción…','ph.det_key':'Campo (ej: Superficie)','ph.det_val':'Valor (ej: 94 m²)',
    'ph.nb_name':'Lugar (ej: Passeig de Gràcia)','ph.nb_dist':'Distancia (ej: 5 min a pie)',
    'saving':'⏳ Traduciendo…',
  },
  en: {
    'tab.basic':'Basic','tab.images':'Images','tab.desc':'Description','tab.details':'Details','tab.feats':'Features','tab.nearby':'Location',
    'btn.back':'← Back','btn.delete':'Delete','btn.save':'Save','lang.label':'Input language:',
    'label.title':'Title','label.slug':'Slug (URL)','label.ref':'Reference',
    'label.status':'Status','label.status.sale':'For Sale','label.status.rent':'For Rent',
    'label.type':'Property type','label.price':'Price','label.neighbourhood':'Neighbourhood',
    'label.address':'Exact address','label.address.hint':'(only visible in admin and visit sheet)',
    'label.zip':'Postal code','label.size':'Built area (m²)','label.land':'Land area (m²)',
    'label.beds':'Bedrooms','label.baths':'Bathrooms','label.garage':'Garage','label.floor':'Floor',
    'label.year':'Year built','label.year_ren':'Year renovated',
    'label.condition':'Condition','label.energy':'Energy class',
    'label.published':'Published on website','label.sold':'Marked as sold / rented',
    'ph.title':'E.g.: Elegant Penthouse with Sea Views','ph.slug':'e.g.: gracia-garden','ph.ref':'e.g.: AN-2026-001',
    'ph.address':'Search address…','ph.zip':'e.g.: 08012','ph.size':'e.g.: 94','ph.land':'e.g.: 450',
    'ph.year':'e.g.: 1920','ph.year_ren':'e.g.: 2022',
    'opt.select':'— Select —','opt.optional':'(optional)','opt.sale':'— sale —',
    'opt.month':'/month','opt.week':'/week','opt.night':'/night',
    'opt.type.apartment':'Apartment','opt.type.penthouse':'Penthouse','opt.type.villa':'Villa',
    'opt.type.house':'House','opt.type.townhouse':'Townhouse','opt.type.studio':'Studio',
    'opt.type.office':'Office / Commercial','opt.type.land':'Land / Plot',
    'opt.garage.no':'No','opt.garage.1':'1 space','opt.garage.2':'2 spaces','opt.garage.3':'3 spaces','opt.garage.4':'4 spaces','opt.garage.7':'7 spaces',
    'opt.floor.ground':'Ground floor','opt.floor.mezz':'Mezzanine','opt.floor.principal':'Principal',
    'opt.floor.upper':'Upper floor','opt.floor.penthouse':'Penthouse','opt.floor.3lev':'3 levels','opt.floor.4lev':'4 levels',
    'opt.cond.new':'New construction','opt.cond.renov':'Under renovation','opt.cond.newly':'Newly renovated',
    'opt.cond.turnkey':'Turn-key renovation','opt.cond.good':'Good condition','opt.cond.torenovate':'To renovate',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Studio / 0',
    'feat.interior':'Interior','feat.flooring':'Flooring','feat.kitchen':'Kitchen','feat.climate':'Climate',
    'feat.outdoor':'Outdoor','feat.building':'Building','feat.views':'Views & Surroundings',
    'feat.custom':'Additional features','feat.custom.hint':'(one per line)',
    'btn.improve':'✨ Improve with AI',
    'list.photos':'Photos — drag to reorder','btn.upload':'+ Upload photos',
    'hint.photos':'First photo is the main image (cover). Drag to reorder.','uploading':'Uploading…',
    'list.desc':'Description paragraphs','btn.add_para':'+ Paragraph',
    'list.details':'Details table','btn.add_row':'+ Row',
    'list.nearby':'Nearby places','btn.add_place':'+ Place',
    'ph.desc_para':'Description paragraph…','ph.det_key':'Field (e.g.: Area)','ph.det_val':'Value (e.g.: 94 m²)',
    'ph.nb_name':'Place (e.g.: Passeig de Gràcia)','ph.nb_dist':'Distance (e.g.: 5 min walk)',
    'saving':'⏳ Translating…',
  },
  ca: {
    'tab.basic':'Bàsic','tab.images':'Imatges','tab.desc':'Descripció','tab.details':'Detalls','tab.feats':'Característiques','tab.nearby':'Ubicació',
    'btn.back':'← Tornar','btn.delete':'Eliminar','btn.save':'Desar','lang.label':'Idioma d\'entrada:',
    'label.title':'Títol','label.slug':'Slug (URL)','label.ref':'Referència',
    'label.status':'Estat','label.status.sale':'En venda','label.status.rent':'En lloguer',
    'label.type':'Tipus de propietat','label.price':'Preu','label.neighbourhood':'Barri',
    'label.address':'Adreça exacta','label.address.hint':'(només visible a l\'admin i full de visita)',
    'label.zip':'Codi postal','label.size':'Superfície construïda (m²)','label.land':'Superfície terreny (m²)',
    'label.beds':'Habitacions','label.baths':'Banys','label.garage':'Garatge','label.floor':'Planta',
    'label.year':'Any de construcció','label.year_ren':'Any de renovació',
    'label.condition':'Condició','label.energy':'Classe energètica',
    'label.published':'Publicada al web','label.sold':'Marcada com a venuda / llogada',
    'ph.title':'Ex: Elegant Penthouse with Sea Views','ph.slug':'ex: gracia-garden','ph.ref':'ex: AN-2026-001',
    'ph.address':'Cerca l\'adreça…','ph.zip':'ex: 08012','ph.size':'ex: 94','ph.land':'ex: 450',
    'ph.year':'ex: 1920','ph.year_ren':'ex: 2022',
    'opt.select':'— Selecciona —','opt.optional':'(opcional)','opt.sale':'— venda —',
    'opt.month':'/mes','opt.week':'/setmana','opt.night':'/nit',
    'opt.type.apartment':'Apartament','opt.type.penthouse':'Àtic','opt.type.villa':'Villa',
    'opt.type.house':'Casa','opt.type.townhouse':'Casa adossada','opt.type.studio':'Estudi',
    'opt.type.office':'Oficina / Comercial','opt.type.land':'Solar / Terreny',
    'opt.garage.no':'No','opt.garage.1':'1 plaça','opt.garage.2':'2 places','opt.garage.3':'3 places','opt.garage.4':'4 places','opt.garage.7':'7 places',
    'opt.floor.ground':'Planta baixa','opt.floor.mezz':'Entresol','opt.floor.principal':'Principal',
    'opt.floor.upper':'Planta alta','opt.floor.penthouse':'Àtic','opt.floor.3lev':'3 nivells','opt.floor.4lev':'4 nivells',
    'opt.cond.new':'Nova construcció','opt.cond.renov':'En renovació','opt.cond.newly':'Recentment renovat',
    'opt.cond.turnkey':'Reforma llave en mà','opt.cond.good':'Bon estat','opt.cond.torenovate':'A reformar',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Estudi / 0',
    'feat.interior':'Interior','feat.flooring':'Sòls','feat.kitchen':'Cuina','feat.climate':'Climatització',
    'feat.outdoor':'Exterior','feat.building':'Edifici','feat.views':'Vistes & Entorn',
    'feat.custom':'Característiques addicionals','feat.custom.hint':'(una per línia)',
    'btn.improve':'✨ Millorar amb IA',
    'list.photos':'Fotos — arrossega per ordenar','btn.upload':'+ Pujar fotos',
    'hint.photos':'La primera foto és la imatge principal. Arrossega per reordenar.','uploading':'Pujant…',
    'list.desc':'Paràgrafs de descripció','btn.add_para':'+ Paràgraf',
    'list.details':'Taula de detalls','btn.add_row':'+ Fila',
    'list.nearby':'Llocs propers','btn.add_place':'+ Lloc',
    'ph.desc_para':'Paràgraf de descripció…','ph.det_key':'Camp (ex: Superfície)','ph.det_val':'Valor (ex: 94 m²)',
    'ph.nb_name':'Lloc (ex: Passeig de Gràcia)','ph.nb_dist':'Distància (ex: 5 min caminant)',
    'saving':'⏳ Traduint…',
  },
  fr: {
    'tab.basic':'Basique','tab.images':'Images','tab.desc':'Description','tab.details':'Détails','tab.feats':'Caractéristiques','tab.nearby':'Localisation',
    'btn.back':'← Retour','btn.delete':'Supprimer','btn.save':'Enregistrer','lang.label':'Langue de saisie :',
    'label.title':'Titre','label.slug':'Slug (URL)','label.ref':'Référence',
    'label.status':'Statut','label.status.sale':'À vendre','label.status.rent':'À louer',
    'label.type':'Type de bien','label.price':'Prix','label.neighbourhood':'Quartier',
    'label.address':'Adresse exacte','label.address.hint':'(visible uniquement dans l\'admin)',
    'label.zip':'Code postal','label.size':'Surface construite (m²)','label.land':'Surface terrain (m²)',
    'label.beds':'Chambres','label.baths':'Salles de bain','label.garage':'Garage','label.floor':'Étage',
    'label.year':'Année de construction','label.year_ren':'Année de rénovation',
    'label.condition':'Condition','label.energy':'Classe énergétique',
    'label.published':'Publié sur le site','label.sold':'Marqué comme vendu / loué',
    'ph.title':'Ex : Elegant Penthouse with Sea Views','ph.slug':'ex : gracia-garden','ph.ref':'ex : AN-2026-001',
    'ph.address':'Rechercher l\'adresse…','ph.zip':'ex : 08012','ph.size':'ex : 94','ph.land':'ex : 450',
    'ph.year':'ex : 1920','ph.year_ren':'ex : 2022',
    'opt.select':'— Sélectionner —','opt.optional':'(optionnel)','opt.sale':'— vente —',
    'opt.month':'/mois','opt.week':'/semaine','opt.night':'/nuit',
    'opt.type.apartment':'Appartement','opt.type.penthouse':'Penthouse','opt.type.villa':'Villa',
    'opt.type.house':'Maison','opt.type.townhouse':'Maison de ville','opt.type.studio':'Studio',
    'opt.type.office':'Bureau / Commercial','opt.type.land':'Terrain',
    'opt.garage.no':'Non','opt.garage.1':'1 place','opt.garage.2':'2 places','opt.garage.3':'3 places','opt.garage.4':'4 places','opt.garage.7':'7 places',
    'opt.floor.ground':'Rez-de-chaussée','opt.floor.mezz':'Mezzanine','opt.floor.principal':'Principal',
    'opt.floor.upper':'Étage supérieur','opt.floor.penthouse':'Penthouse','opt.floor.3lev':'3 niveaux','opt.floor.4lev':'4 niveaux',
    'opt.cond.new':'Construction neuve','opt.cond.renov':'En rénovation','opt.cond.newly':'Récemment rénové',
    'opt.cond.turnkey':'Rénovation clé en main','opt.cond.good':'Bon état','opt.cond.torenovate':'À rénover',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Studio / 0',
    'feat.interior':'Intérieur','feat.flooring':'Sols','feat.kitchen':'Cuisine','feat.climate':'Climatisation',
    'feat.outdoor':'Extérieur','feat.building':'Bâtiment','feat.views':'Vues & Environnement',
    'feat.custom':'Caractéristiques supplémentaires','feat.custom.hint':'(une par ligne)',
    'btn.improve':'✨ Améliorer avec IA',
    'list.photos':'Photos — glisser pour trier','btn.upload':'+ Téléverser photos',
    'hint.photos':'La première photo est l\'image principale. Glisser pour réorganiser.','uploading':'Téléversement…',
    'list.desc':'Paragraphes de description','btn.add_para':'+ Paragraphe',
    'list.details':'Tableau de détails','btn.add_row':'+ Ligne',
    'list.nearby':'Lieux proches','btn.add_place':'+ Lieu',
    'ph.desc_para':'Paragraphe de description…','ph.det_key':'Champ (ex : Surface)','ph.det_val':'Valeur (ex : 94 m²)',
    'ph.nb_name':'Lieu (ex : Passeig de Gràcia)','ph.nb_dist':'Distance (ex : 5 min à pied)',
    'saving':'⏳ Traduction…',
  },
  de: {
    'tab.basic':'Allgemein','tab.images':'Bilder','tab.desc':'Beschreibung','tab.details':'Details','tab.feats':'Ausstattung','tab.nearby':'Lage',
    'btn.back':'← Zurück','btn.delete':'Löschen','btn.save':'Speichern','lang.label':'Eingabesprache:',
    'label.title':'Titel','label.slug':'Slug (URL)','label.ref':'Referenz',
    'label.status':'Status','label.status.sale':'Zu verkaufen','label.status.rent':'Zu vermieten',
    'label.type':'Immobilientyp','label.price':'Preis','label.neighbourhood':'Stadtteil',
    'label.address':'Genaue Adresse','label.address.hint':'(nur im Admin und Besuchsblatt sichtbar)',
    'label.zip':'Postleitzahl','label.size':'Wohnfläche (m²)','label.land':'Grundstücksfläche (m²)',
    'label.beds':'Schlafzimmer','label.baths':'Badezimmer','label.garage':'Garage','label.floor':'Etage',
    'label.year':'Baujahr','label.year_ren':'Renovierungsjahr',
    'label.condition':'Zustand','label.energy':'Energieklasse',
    'label.published':'Auf der Website veröffentlicht','label.sold':'Als verkauft / vermietet markiert',
    'ph.title':'Bsp: Elegant Penthouse with Sea Views','ph.slug':'bsp: gracia-garden','ph.ref':'bsp: AN-2026-001',
    'ph.address':'Adresse suchen…','ph.zip':'bsp: 08012','ph.size':'bsp: 94','ph.land':'bsp: 450',
    'ph.year':'bsp: 1920','ph.year_ren':'bsp: 2022',
    'opt.select':'— Auswählen —','opt.optional':'(optional)','opt.sale':'— Verkauf —',
    'opt.month':'/Monat','opt.week':'/Woche','opt.night':'/Nacht',
    'opt.type.apartment':'Wohnung','opt.type.penthouse':'Penthouse','opt.type.villa':'Villa',
    'opt.type.house':'Haus','opt.type.townhouse':'Reihenhaus','opt.type.studio':'Studio',
    'opt.type.office':'Büro / Gewerbe','opt.type.land':'Grundstück',
    'opt.garage.no':'Nein','opt.garage.1':'1 Stellplatz','opt.garage.2':'2 Stellplätze','opt.garage.3':'3 Stellplätze','opt.garage.4':'4 Stellplätze','opt.garage.7':'7 Stellplätze',
    'opt.floor.ground':'Erdgeschoss','opt.floor.mezz':'Mezzanin','opt.floor.principal':'Hauptetage',
    'opt.floor.upper':'Obergeschoss','opt.floor.penthouse':'Penthouse','opt.floor.3lev':'3 Ebenen','opt.floor.4lev':'4 Ebenen',
    'opt.cond.new':'Neubau','opt.cond.renov':'In Renovierung','opt.cond.newly':'Frisch renoviert',
    'opt.cond.turnkey':'Schlüsselfertig renoviert','opt.cond.good':'Guter Zustand','opt.cond.torenovate':'Renovierungsbedürftig',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Studio / 0',
    'feat.interior':'Innenausstattung','feat.flooring':'Bodenbeläge','feat.kitchen':'Küche','feat.climate':'Klimatisierung',
    'feat.outdoor':'Außenbereich','feat.building':'Gebäude','feat.views':'Aussicht & Umgebung',
    'feat.custom':'Weitere Ausstattung','feat.custom.hint':'(eine pro Zeile)',
    'btn.improve':'✨ Mit KI verbessern',
    'list.photos':'Fotos — ziehen zum Sortieren','btn.upload':'+ Fotos hochladen',
    'hint.photos':'Das erste Foto ist das Hauptbild. Ziehen zum Neuordnen.','uploading':'Hochladen…',
    'list.desc':'Beschreibungsabsätze','btn.add_para':'+ Absatz',
    'list.details':'Detailtabelle','btn.add_row':'+ Zeile',
    'list.nearby':'Nahegelegene Orte','btn.add_place':'+ Ort',
    'ph.desc_para':'Beschreibungsabsatz…','ph.det_key':'Feld (z.B.: Fläche)','ph.det_val':'Wert (z.B.: 94 m²)',
    'ph.nb_name':'Ort (z.B.: Passeig de Gràcia)','ph.nb_dist':'Entfernung (z.B.: 5 min zu Fuß)',
    'saving':'⏳ Übersetze…',
  },
  it: {
    'tab.basic':'Base','tab.images':'Immagini','tab.desc':'Descrizione','tab.details':'Dettagli','tab.feats':'Caratteristiche','tab.nearby':'Posizione',
    'btn.back':'← Indietro','btn.delete':'Elimina','btn.save':'Salva','lang.label':'Lingua di inserimento:',
    'label.title':'Titolo','label.slug':'Slug (URL)','label.ref':'Riferimento',
    'label.status':'Stato','label.status.sale':'In vendita','label.status.rent':'In affitto',
    'label.type':'Tipo di immobile','label.price':'Prezzo','label.neighbourhood':'Quartiere',
    'label.address':'Indirizzo esatto','label.address.hint':'(visibile solo in admin e scheda visita)',
    'label.zip':'Codice postale','label.size':'Superficie costruita (m²)','label.land':'Superficie terreno (m²)',
    'label.beds':'Camere da letto','label.baths':'Bagni','label.garage':'Garage','label.floor':'Piano',
    'label.year':'Anno di costruzione','label.year_ren':'Anno di ristrutturazione',
    'label.condition':'Condizione','label.energy':'Classe energetica',
    'label.published':'Pubblicato sul sito','label.sold':'Segnato come venduto / affittato',
    'ph.title':'Es: Elegant Penthouse with Sea Views','ph.slug':'es: gracia-garden','ph.ref':'es: AN-2026-001',
    'ph.address':'Cerca indirizzo…','ph.zip':'es: 08012','ph.size':'es: 94','ph.land':'es: 450',
    'ph.year':'es: 1920','ph.year_ren':'es: 2022',
    'opt.select':'— Seleziona —','opt.optional':'(opzionale)','opt.sale':'— vendita —',
    'opt.month':'/mese','opt.week':'/settimana','opt.night':'/notte',
    'opt.type.apartment':'Appartamento','opt.type.penthouse':'Attico','opt.type.villa':'Villa',
    'opt.type.house':'Casa','opt.type.townhouse':'Casa a schiera','opt.type.studio':'Monolocale',
    'opt.type.office':'Ufficio / Commerciale','opt.type.land':'Terreno',
    'opt.garage.no':'No','opt.garage.1':'1 posto','opt.garage.2':'2 posti','opt.garage.3':'3 posti','opt.garage.4':'4 posti','opt.garage.7':'7 posti',
    'opt.floor.ground':'Piano terra','opt.floor.mezz':'Mezzanino','opt.floor.principal':'Piano principale',
    'opt.floor.upper':'Piano superiore','opt.floor.penthouse':'Attico','opt.floor.3lev':'3 livelli','opt.floor.4lev':'4 livelli',
    'opt.cond.new':'Nuova costruzione','opt.cond.renov':'In ristrutturazione','opt.cond.newly':'Recentemente ristrutturato',
    'opt.cond.turnkey':'Ristrutturazione chiavi in mano','opt.cond.good':'Buone condizioni','opt.cond.torenovate':'Da ristrutturare',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Monolocale / 0',
    'feat.interior':'Interni','feat.flooring':'Pavimentazione','feat.kitchen':'Cucina','feat.climate':'Climatizzazione',
    'feat.outdoor':'Esterno','feat.building':'Edificio','feat.views':'Viste & Ambiente',
    'feat.custom':'Caratteristiche aggiuntive','feat.custom.hint':'(una per riga)',
    'btn.improve':'✨ Migliora con IA',
    'list.photos':'Foto — trascina per ordinare','btn.upload':'+ Carica foto',
    'hint.photos':'La prima foto è l\'immagine principale. Trascina per riordinare.','uploading':'Caricamento…',
    'list.desc':'Paragrafi di descrizione','btn.add_para':'+ Paragrafo',
    'list.details':'Tabella dettagli','btn.add_row':'+ Riga',
    'list.nearby':'Luoghi vicini','btn.add_place':'+ Luogo',
    'ph.desc_para':'Paragrafo di descrizione…','ph.det_key':'Campo (es.: Superficie)','ph.det_val':'Valore (es.: 94 m²)',
    'ph.nb_name':'Luogo (es.: Passeig de Gràcia)','ph.nb_dist':'Distanza (es.: 5 min a piedi)',
    'saving':'⏳ Traduzione…',
  },
  ru: {
    'tab.basic':'Основное','tab.images':'Фото','tab.desc':'Описание','tab.details':'Детали','tab.feats':'Характеристики','tab.nearby':'Расположение',
    'btn.back':'← Назад','btn.delete':'Удалить','btn.save':'Сохранить','lang.label':'Язык ввода:',
    'label.title':'Название','label.slug':'Slug (URL)','label.ref':'Референс',
    'label.status':'Статус','label.status.sale':'Продажа','label.status.rent':'Аренда',
    'label.type':'Тип недвижимости','label.price':'Цена','label.neighbourhood':'Район',
    'label.address':'Точный адрес','label.address.hint':'(видно только в админе и листе посещения)',
    'label.zip':'Почтовый индекс','label.size':'Площадь (м²)','label.land':'Площадь участка (м²)',
    'label.beds':'Спальни','label.baths':'Ванные','label.garage':'Гараж','label.floor':'Этаж',
    'label.year':'Год постройки','label.year_ren':'Год реновации',
    'label.condition':'Состояние','label.energy':'Энергокласс',
    'label.published':'Опубликовано на сайте','label.sold':'Отмечено как продано / сдано',
    'ph.title':'Напр: Elegant Penthouse with Sea Views','ph.slug':'напр: gracia-garden','ph.ref':'напр: AN-2026-001',
    'ph.address':'Поиск адреса…','ph.zip':'напр: 08012','ph.size':'напр: 94','ph.land':'напр: 450',
    'ph.year':'напр: 1920','ph.year_ren':'напр: 2022',
    'opt.select':'— Выбрать —','opt.optional':'(необязательно)','opt.sale':'— продажа —',
    'opt.month':'/мес','opt.week':'/нед','opt.night':'/ночь',
    'opt.type.apartment':'Квартира','opt.type.penthouse':'Пентхаус','opt.type.villa':'Вилла',
    'opt.type.house':'Дом','opt.type.townhouse':'Таунхаус','opt.type.studio':'Студия',
    'opt.type.office':'Офис / Коммерческая','opt.type.land':'Участок',
    'opt.garage.no':'Нет','opt.garage.1':'1 место','opt.garage.2':'2 места','opt.garage.3':'3 места','opt.garage.4':'4 места','opt.garage.7':'7 мест',
    'opt.floor.ground':'Первый этаж','opt.floor.mezz':'Антресоль','opt.floor.principal':'Основной этаж',
    'opt.floor.upper':'Верхний этаж','opt.floor.penthouse':'Пентхаус','opt.floor.3lev':'3 уровня','opt.floor.4lev':'4 уровня',
    'opt.cond.new':'Новостройка','opt.cond.renov':'В ремонте','opt.cond.newly':'Свежий ремонт',
    'opt.cond.turnkey':'Ремонт под ключ','opt.cond.good':'Хорошее состояние','opt.cond.torenovate':'Требует ремонта',
    'opt.energy.na':'— N/A —','opt.beds.studio':'Студия / 0',
    'feat.interior':'Интерьер','feat.flooring':'Полы','feat.kitchen':'Кухня','feat.climate':'Климат',
    'feat.outdoor':'Улица','feat.building':'Здание','feat.views':'Виды & Окружение',
    'feat.custom':'Доп. характеристики','feat.custom.hint':'(по одной на строку)',
    'btn.improve':'✨ Улучшить с ИИ',
    'list.photos':'Фото — перетащите для сортировки','btn.upload':'+ Загрузить фото',
    'hint.photos':'Первое фото — главное изображение. Перетащите для изменения порядка.','uploading':'Загрузка…',
    'list.desc':'Параграфы описания','btn.add_para':'+ Параграф',
    'list.details':'Таблица деталей','btn.add_row':'+ Строка',
    'list.nearby':'Близлежащие места','btn.add_place':'+ Место',
    'ph.desc_para':'Параграф описания…','ph.det_key':'Поле (напр.: Площадь)','ph.det_val':'Значение (напр.: 94 м²)',
    'ph.nb_name':'Место (напр.: Passeig de Gràcia)','ph.nb_dist':'Расстояние (напр.: 5 мин пешком)',
    'saving':'⏳ Перевод…',
  },
}

function applyAdminLang(lang) {
  const ui = ADMIN_UI[lang] || ADMIN_UI.es
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n
    if (!ui[key]) return
    // For elements that contain child nodes (like <label> with <em> or <svg>), update the non-empty text node
    if (el.children.length > 0) {
      const textNode = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim())
      if (textNode) textNode.textContent = ' ' + ui[key] + ' '
    } else {
      el.textContent = ui[key]
    }
  })
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh
    if (ui[key]) el.placeholder = ui[key]
  })

  // Translate individual feature checkbox labels
  const featMap = FEAT_LABELS[lang]
  document.querySelectorAll('#tab-feats .feat-checks label').forEach(label => {
    const cb = label.querySelector('input[type=checkbox]')
    if (!cb) return
    const textNode = [...label.childNodes].find(n => n.nodeType === 3 && n.textContent.trim())
    if (textNode) textNode.textContent = ' ' + (featMap?.[cb.value] || cb.value)
  })
}

// ── TRANSLATIONS ──────────────────────────────
const TRANSLATE_LANGS = ['es', 'en', 'ca', 'fr', 'de', 'it', 'ru']
const LANG_NAMES = { es:'Español', en:'English', ca:'Català', fr:'Français', de:'Deutsch', it:'Italiano', ru:'Русский' }

async function gtranslate(text, targetLang, sourceLang = 'auto') {
  if (!text || !text.trim()) return text
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(tid)
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
  el.innerHTML = ''
  el.textContent = msg
  el.className = `toast ${type}`
  clearTimeout(_toastTimer)
  clearTimeout(_undoTimer)
  _undoFn = null
  _toastTimer = setTimeout(() => el.className = 'toast hidden', 3200)
}

function toastUndo(msg, undoFn) {
  const el = document.getElementById('toast')
  el.innerHTML = `<span>${msg}</span><button class="toast-undo" onclick="window._execUndo()">Deshacer</button>`
  el.className = 'toast warning'
  _undoFn = undoFn
  clearTimeout(_toastTimer)
  clearTimeout(_undoTimer)
  _undoTimer = setTimeout(() => { el.className = 'toast hidden'; _undoFn = null }, 5000)
}
window._execUndo = () => { if (_undoFn) { _undoFn(); _undoFn = null; clearTimeout(_undoTimer); document.getElementById('toast').className = 'toast hidden' } }

// ── HOJAS DE VISITA ───────────────────────────
let _visitsInited = false
function buildAgentPDF(v) {
  if (!window.jspdf) { alert('Cargando jsPDF, intenta de nuevo en un momento.'); return }

  // Resolve address: record → an_addresses store → _listings
  const addrs = JSON.parse(localStorage.getItem('an_addresses') || '{}')
  const _resolvedListing = _listings.find(l => (v.propSlug && l.slug === v.propSlug) || (v.propRef && v.propRef !== '—' && l.ref === v.propRef) || l.title === v.propTitle)
  const address   = v.propAddress || (v.propSlug && addrs[v.propSlug]) || _resolvedListing?.address || ''
  const doorFloor = v.doorFloor || _resolvedListing?.doorFloor || ''
  const doorNum   = v.doorNum   || _resolvedListing?.doorNum   || ''
  const zip       = v.zip       || _resolvedListing?.zip       || ''

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
  if (address)   kv('Dirección exacta:', address)
  if (doorFloor) kv('Piso:', doorFloor)
  if (doorNum)   kv('Puerta:', doorNum)
  if (zip)       kv('Código postal:', zip)
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

  if (v.aiVerify) {
    const ai = v.aiVerify
    section('VERIFICACIÓN IA DEL DOCUMENTO')
    kv('Documento válido:', ai.isIdDocument ? 'Sí' : 'No')
    kv('Tipo detectado:',   ai.docType || '—')
    kv('Nombre en doc:',    ai.nameOnDoc || '—')
    kv('Nombre coincide:',  ai.nameMatch === true ? 'Sí' : ai.nameMatch === false ? 'No' : '—')
    kv('Confianza:',        ai.confidence || '—')
    kv('Mensaje IA:',       ai.message || '—')
    y += 2
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

async function syncRemoteVisits() {
  try {
    const r = await fetch('/api/get-visits')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (!data.configured) { toast('⚠ Almacenamiento remoto no configurado', 'error'); return }
    if (!data.visits?.length) { toast('Sync: 0 visitas en servidor', ''); return }
    const local = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]')
    const localKeys = new Set(local.map(v => v.timestamp + '|' + v.docNum))
    let added = 0
    for (const v of data.visits) {
      const key = v.timestamp + '|' + v.docNum
      if (!localKeys.has(key)) {
        v.id = v.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 7))
        local.unshift(v)
        localKeys.add(key)
        added++
      }
    }
    if (added > 0) {
      localStorage.setItem(VISITS_KEY, JSON.stringify(local))
      renderVisitLog()
      toast(`✓ ${added} visita(s) sincronizada(s) del servidor`, 'success')
    } else {
      toast(`Sync OK — ${data.visits.length} en servidor, todas ya locales`, '')
    }
  } catch (e) {
    toast('Error sync: ' + e.message, 'error')
  }
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
  syncRemoteVisits()
  const BASE = window.location.origin

  function getVisitDate() {
    const v = (document.getElementById('vs-visit-date') || {}).value || ''
    return v
  }

  function visitUrl(ref, title, zone, slug, address) {
    const date = getVisitDate()
    const l = _listings.find(l => l.slug === slug)
    return BASE + '/visit.html?ref=' + encodeURIComponent(ref) +
      '&title=' + encodeURIComponent(title) +
      '&zone='  + encodeURIComponent(zone) +
      (slug             ? '&slug='       + encodeURIComponent(slug)              : '') +
      (address          ? '&address='    + encodeURIComponent(address)           : '') +
      (l?.doorFloor     ? '&doorFloor='  + encodeURIComponent(l.doorFloor)       : '') +
      (l?.doorNum       ? '&doorNum='    + encodeURIComponent(l.doorNum)         : '') +
      (l?.zip           ? '&zip='        + encodeURIComponent(l.zip)             : '') +
      (date             ? '&date='       + encodeURIComponent(date)              : '')
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
