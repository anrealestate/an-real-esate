/* ================================
   Form field helpers
   ================================ */
function showFieldError(input, msg) {
  clearFieldError(input)
  input.style.borderColor = 'var(--gold)'
  input.setAttribute('aria-invalid', 'true')
  const err = document.createElement('p')
  err.className = 'field-error'
  err.setAttribute('role', 'alert')
  err.textContent = msg
  input.parentNode.appendChild(err)
}
function clearFieldError(input) {
  input.style.borderColor = ''
  input.removeAttribute('aria-invalid')
  const prev = input.parentNode.querySelector('.field-error')
  if (prev) prev.remove()
}

/* ================================
   Lightbox
   ================================ */
const lbOverlay = document.getElementById('lb-overlay')
const lbImg     = document.getElementById('lb-img')
const lbCounter = document.getElementById('lb-counter')
let   images    = []
let   current   = 0

function lbShow(index) {
  current = (index + images.length) % images.length
  const { src, alt } = images[current]
  lbImg.classList.add('is-loading')
  const tmp = new Image()
  tmp.onload = () => {
    lbImg.src = src
    lbImg.alt = alt
    lbImg.classList.remove('is-loading')
  }
  tmp.src = src
  lbCounter.textContent = `${current + 1} / ${images.length}`
}

function lbOpen(index) {
  if (!images.length) return
  lbShow(index)
  lbOverlay.classList.add('is-open')
  document.body.style.overflow = 'hidden'
}

function lbClose() {
  lbOverlay.classList.remove('is-open')
  document.body.style.overflow = ''
}

/* ================================
   Gallery init — deferred until loaders populate DOM
   Resolves race condition: property-loader.js / development-loader.js
   dispatch 'gallery:ready' (and set window._galleryReady) after DOM is ready.
   ================================ */
function initGallery() {
  const heroEl  = document.querySelector('.pg-hero')
  const cellEls = document.querySelectorAll('.pg-cell')

  /* hero img id differs between property.html (pg-hero-img) and development.html (dv-hero-img) */
  const heroImgEl = document.getElementById('pg-hero-img') || document.getElementById('dv-hero-img')

  images = [
    {
      src: heroEl?.dataset.src || heroImgEl?.src,
      alt: heroImgEl?.alt || 'Property photo'
    },
    ...Array.from(cellEls).map(cell => ({
      src: cell.dataset.src,
      alt: cell.querySelector('img')?.alt || 'Property photo'
    }))
  ].filter(img => img.src)

  /* Open triggers — hero + cells */
  if (heroEl) {
    heroEl.addEventListener('click', () => lbOpen(0))
    heroEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') lbOpen(0) })
  }

  cellEls.forEach((cell, i) => {
    cell.addEventListener('click', () => lbOpen(i + 1))
  })
}

/* Fire immediately if loader already ran, otherwise wait for the event */
if (window._galleryReady) {
  initGallery()
} else {
  document.addEventListener('gallery:ready', initGallery, { once: true })
}

/* ================================
   Lightbox controls
   ================================ */
document.getElementById('lb-close')?.addEventListener('click', lbClose)
document.getElementById('lb-prev')?.addEventListener('click', () => lbShow(current - 1))
document.getElementById('lb-next')?.addEventListener('click', () => lbShow(current + 1))

lbOverlay?.addEventListener('click', e => {
  if (e.target === lbOverlay) lbClose()
})

/* ================================
   Keyboard
   ================================ */
document.addEventListener('keydown', e => {
  if (!lbOverlay?.classList.contains('is-open')) return
  if (e.key === 'Escape')     lbClose()
  if (e.key === 'ArrowLeft')  lbShow(current - 1)
  if (e.key === 'ArrowRight') lbShow(current + 1)
})

/* ================================
   Swipe prev/next — touch / pen / desktop táctil (Pointer Events).
   No usar pointerType mouse: evita cambiar foto al arrastrar con ratón.
   ================================ */
const lbStage = document.querySelector('.lb-stage')
const SWIPE_MIN_PX = 80

function lbSwipeIgnoreTarget(t) {
  return !!(t && typeof t.closest === 'function' && t.closest('.lb-close, .lb-arrow'))
}

function lbApplySwipe(dx) {
  if (Math.abs(dx) < SWIPE_MIN_PX) return
  dx < 0 ? lbShow(current + 1) : lbShow(current - 1)
}

let lbSwipeStartX = null

function lbOnPointerDown(e) {
  if (!lbOverlay?.classList.contains('is-open')) return
  if (e.pointerType === 'mouse') return
  if (lbSwipeIgnoreTarget(e.target)) return
  lbSwipeStartX = e.clientX
  try {
    lbStage?.setPointerCapture(e.pointerId)
  } catch (_) {}
}

function lbOnPointerUp(e) {
  if (e.pointerType === 'mouse') return
  if (lbSwipeStartX == null) return
  const dx = e.clientX - lbSwipeStartX
  lbSwipeStartX = null
  try {
    lbStage?.releasePointerCapture(e.pointerId)
  } catch (_) {}
  if (lbSwipeIgnoreTarget(e.target)) return
  lbApplySwipe(dx)
}

lbStage?.addEventListener('pointerdown', lbOnPointerDown)
lbStage?.addEventListener('pointerup', lbOnPointerUp)
lbStage?.addEventListener('pointercancel', e => {
  lbSwipeStartX = null
  try {
    lbStage?.releasePointerCapture(e.pointerId)
  } catch (_) {}
})

/* Fallback Safari sin Pointer Events completo: touch solo en stage */
if (typeof window.PointerEvent === 'undefined') {
  let touchStartX = 0
  lbStage?.addEventListener('touchstart', e => {
    if (lbSwipeIgnoreTarget(e.target)) return
    touchStartX = e.changedTouches[0].clientX
  }, { passive: true })
  lbStage?.addEventListener('touchend', e => {
    if (lbSwipeIgnoreTarget(e.target)) return
    const dx = e.changedTouches[0].clientX - touchStartX
    lbApplySwipe(dx)
  }, { passive: true })
}

/* ================================
   Enquiry form
   ================================ */
document.getElementById('prop-form')?.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  const btn  = form.querySelector('button[type="submit"]')

  const nameInput  = form.querySelector('[name="name"]')
  const emailInput = form.querySelector('[name="email"]')
  const name  = nameInput.value.trim()
  const email = emailInput.value.trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const lang = (typeof getLang === 'function') ? getLang() : 'en'
  const t = k => window.I18N?.[lang]?.[k] || window.I18N?.en?.[k] || k

  let valid = true
  if (!name)    { showFieldError(nameInput,  t('form.err.name'));  valid = false } else clearFieldError(nameInput)
  if (!emailOk) { showFieldError(emailInput, t('form.err.email')); valid = false } else clearFieldError(emailInput)
  if (!valid) return

  btn.textContent   = t('form.requesting')
  btn.disabled      = true

  const property = form.querySelector('[name="property"]')?.value || ''

  try {
    const res = await fetch('https://formsubmit.co/ajax/alvaro@anrealestate.es', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone:    form.querySelector('[name="phone"]').value.trim(),
        message:  form.querySelector('[name="message"]').value.trim(),
        property,
        _subject: 'Solicitud de visita web — ' + property,
        _captcha: 'false',
        _template: 'table',
      }),
    })
    if (!res.ok) throw new Error()
    btn.textContent        = t('form.requested')
    btn.style.background   = 'var(--gold)'
    btn.style.borderColor  = 'var(--gold)'
    btn.style.color        = 'var(--bg)'
    form.reset()
    if (typeof showToast === 'function') showToast(t('form.toast_enquiry'))
    setTimeout(() => {
      btn.textContent        = t('form.request_submit')
      btn.style.background   = ''
      btn.style.borderColor  = ''
      btn.style.color        = ''
      btn.disabled           = false
    }, 4000)
  } catch {
    btn.textContent = t('form.error')
    btn.disabled    = false
    setTimeout(() => { btn.textContent = t('form.submit') }, 4000)
  }
})

/* ================================
   Similar properties
   ================================ */
;(() => {
  const section = document.getElementById('similar-section')
  const grid    = document.getElementById('similar-grid')
  if (!section || !grid) return

  const inline = document.getElementById('listings-data')
  if (!inline) return

  let all = []
  try { all = JSON.parse(inline.textContent).listings || [] } catch { return }

  const currentTitle = document.querySelector('[name="property"]')?.value || ''
  const others = all.filter(l => {
    const stage = l.stage || (l.published ? 'active' : 'draft')
    return ['active', 'reserved'].includes(stage) && !currentTitle.includes(l.title)
  }).slice(0, 3)

  if (!others.length) return

  const simLang = (typeof getLang === 'function') ? getLang() : 'en'
  const simT = k => window.I18N?.[simLang]?.[k] || window.I18N?.en?.[k] || k
  grid.innerHTML = others.map(l => {
    const isRent = l.type === 'rent' || l.status === 'rent'
    const tag = isRent ? simT('prop.for_rent') : simT('prop.for_sale')
    const tagClass = isRent ? 'rent' : 'sale'
    const propType = l.propertyType || l.type || ''
    const listType = isRent ? 'rent' : 'sale'
    return `
      <a href="property.html?slug=${l.slug || ''}" class="prop-card" data-type="${listType} ${propType}">
        <div class="prop-img-wrap">
          <img src="${l.image}" alt="${l.title}" class="prop-img" loading="lazy" />
          <span class="prop-tag ${tagClass}">${tag}</span>
        </div>
        <div class="prop-info">
          <div class="prop-meta">
            <span class="prop-loc">${l.neighbourhood}</span>
            <span class="prop-price">${l.price}</span>
          </div>
          <h3 class="prop-title">${l.title}</h3>
          <p class="prop-specs">${l.beds} bed &nbsp;·&nbsp; ${l.baths} bath &nbsp;·&nbsp; ${l.size != null && l.size !== '' ? l.size + (l.sizeUnit === 'sqft' ? ' sq ft' : ' m²') : '—'}</p>
        </div>
      </a>`
  }).join('')

  section.style.display = ''
})()

/* ================================
   Mobile sticky CTA
   ================================ */
const stickyCta = document.getElementById('prop-sticky-cta')
const enquireEl = document.getElementById('enquire')

if (stickyCta && enquireEl) {
  new IntersectionObserver(
    ([e]) => { stickyCta.style.display = e.isIntersecting ? 'none' : '' },
    { threshold: 0.1 }
  ).observe(enquireEl)
}
