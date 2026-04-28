/* ================================
   Build image list from gallery
   ================================ */
const heroEl = document.querySelector('.pg-hero')
const cellEls = document.querySelectorAll('.pg-cell')

const images = [
  {
    src: heroEl?.dataset.src || document.getElementById('pg-hero-img')?.src,
    alt: document.getElementById('pg-hero-img')?.alt || 'Property photo'
  },
  ...Array.from(cellEls).map(cell => ({
    src: cell.dataset.src,
    alt: cell.querySelector('img')?.alt || 'Property photo'
  }))
].filter(img => img.src)

/* ================================
   Lightbox
   ================================ */
const lbOverlay = document.getElementById('lb-overlay')
const lbImg     = document.getElementById('lb-img')
const lbCounter = document.getElementById('lb-counter')
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
  lbShow(index)
  lbOverlay.classList.add('is-open')
  document.body.style.overflow = 'hidden'
}

function lbClose() {
  lbOverlay.classList.remove('is-open')
  document.body.style.overflow = ''
}

/* ================================
   Open triggers — hero + cells
   ================================ */
if (heroEl) {
  heroEl.addEventListener('click', () => lbOpen(0))
  heroEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') lbOpen(0) })
}

cellEls.forEach((cell, i) => {
  cell.addEventListener('click', () => lbOpen(i + 1))
})

/* ================================
   Controls
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
   Touch swipe
   ================================ */
let touchStartX = 0
lbOverlay?.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].clientX
}, { passive: true })

lbOverlay?.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) < 50) return
  dx < 0 ? lbShow(current + 1) : lbShow(current - 1)
})

/* ================================
   Enquiry form
   ================================ */
document.getElementById('prop-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const btn  = e.target.querySelector('button[type="submit"]')
  const orig = btn.textContent
  btn.textContent = 'Request Sent ✓'
  btn.style.background   = 'var(--gold)'
  btn.style.borderColor  = 'var(--gold)'
  btn.style.color        = 'var(--bg)'
  setTimeout(() => {
    btn.textContent       = orig
    btn.style.background  = ''
    btn.style.borderColor = ''
    btn.style.color       = ''
    e.target.reset()
  }, 3000)
})

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
