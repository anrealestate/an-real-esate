/* ================================
   Phone assembly — keeps number out of plain HTML
   ================================ */
document.querySelectorAll('.tel-js').forEach(el => {
  const parts = [el.dataset.a, el.dataset.b, el.dataset.c, el.dataset.d, el.dataset.e]
  const raw     = parts.join('')
  const display = parts.join(' ')
  el.href = 'tel:' + raw
  const textTarget = el.querySelector('.tel-text') || el.querySelector('.tel-arrow')
  if (el.querySelector('.tel-arrow')) {
    el.insertBefore(document.createTextNode(display + ' '), el.querySelector('.tel-arrow'))
  } else if (el.querySelector('.tel-text')) {
    el.querySelector('.tel-text').textContent = display
  } else {
    el.textContent = display
  }
})

/* ================================
   Header: transparent → solid on scroll
   ================================ */
const header = document.getElementById('site-header')
const hero   = document.getElementById('hero')

if (hero) {
  new IntersectionObserver(
    ([e]) => header.classList.toggle('scrolled', !e.isIntersecting),
    { threshold: 0.05 }
  ).observe(hero)
}

/* ================================
   Mobile drawer
   ================================ */
const hamburger = document.getElementById('hamburger')
const drawer    = document.getElementById('mobile-drawer')

hamburger?.addEventListener('click', () => {
  const open = drawer.classList.toggle('open')
  hamburger.classList.toggle('open', open)
  hamburger.setAttribute('aria-expanded', open)
  drawer.setAttribute('aria-hidden', !open)
  document.body.style.overflow = open ? 'hidden' : ''
})

document.querySelectorAll('.drawer-link, .drawer-phone').forEach(el => {
  el.addEventListener('click', () => {
    drawer.classList.remove('open')
    hamburger.classList.remove('open')
    hamburger.setAttribute('aria-expanded', 'false')
    drawer.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  })
})

/* ================================
   Banner slider
   ================================ */
const bannerSlides = document.querySelectorAll('.banner-slide')
const bannerDots   = document.querySelectorAll('.bn-dot')
let bannerCur = 0, bannerTimer

const showBannerSlide = idx => {
  bannerCur = (idx + bannerSlides.length) % bannerSlides.length
  bannerSlides.forEach((s, i) => s.classList.toggle('active', i === bannerCur))
  bannerDots.forEach((d, i)  => d.classList.toggle('active', i === bannerCur))
}

const resetBannerTimer = () => {
  clearInterval(bannerTimer)
  bannerTimer = setInterval(() => showBannerSlide(bannerCur + 1), 5500)
}

bannerDots.forEach(d => d.addEventListener('click', () => {
  showBannerSlide(+d.dataset.i)
  resetBannerTimer()
}))

if (bannerSlides.length > 1) resetBannerTimer()

/* Filter tabs are initialised by listings.js after dynamic cards render */


/* ================================
   Contact form
   ================================ */
document.getElementById('contact-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const btn = e.target.querySelector('button[type="submit"]')
  const orig = btn.textContent
  btn.textContent = 'Message Sent ✓'
  btn.style.background = 'var(--gold)'
  btn.style.borderColor = 'var(--gold)'
  btn.style.color = 'var(--bg)'
  setTimeout(() => {
    btn.textContent = orig
    btn.style.background = ''
    btn.style.borderColor = ''
    btn.style.color = ''
    e.target.reset()
  }, 3000)
})
