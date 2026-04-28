/* ================================
   animations.js
   GSAP ScrollTrigger — TREF-style
   ================================ */

gsap.registerPlugin(ScrollTrigger)

/* ================================
   1. Smooth anchor scroll
   ================================ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href')
    if (id === '#') return
    const target = document.querySelector(id)
    if (!target) return
    e.preventDefault()
    const top = target.getBoundingClientRect().top + window.scrollY - 72
    window.scrollTo({ top, behavior: 'smooth' })
  })
})

/* ================================
   2. Loader out
   ================================ */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader')
  if (!loader) return
  gsap.to(loader, {
    opacity: 0,
    duration: 0.7,
    delay: 0.9,
    ease: 'power2.inOut',
    onComplete: () => {
      loader.style.display = 'none'
      document.body.classList.remove('is-loader')
    },
  })
})

/* ================================
   3. Banner — immediate on load
   ================================ */
const bannerBlock = document.querySelector('.banner-block')
if (bannerBlock) {
  gsap.from('.banner-eyebrow', {
    y: 16, opacity: 0, duration: 0.7, delay: 1.3, ease: 'power2.out',
  })
  gsap.from('.banner-h1 .text-inner', {
    yPercent: 112, duration: 1.1, ease: 'power3.out', stagger: 0.13, delay: 1.5,
  })
  gsap.from('.banner-sub', {
    y: 22, opacity: 0, duration: 0.8, delay: 1.9, ease: 'power2.out',
  })
  gsap.from('.banner-block .button', {
    y: 16, opacity: 0, duration: 0.7, delay: 2.1, ease: 'power2.out',
  })
  gsap.from('.banner-dots', {
    y: 10, opacity: 0, duration: 0.6, delay: 2.2, ease: 'power2.out',
  })
}

/* ================================
   4. Scroll reveals — .reveal containers
   Animates .text-inner children + sibling subheading/text
   ================================ */
gsap.utils.toArray('.reveal').forEach(el => {
  const inners = el.querySelectorAll('.text-inner')
  if (inners.length) {
    gsap.from(inners, {
      yPercent: 112,
      duration: 1.05,
      ease: 'power3.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    })
  }

  const extras = el.querySelectorAll('.subheading, .at-sub, .at-text, .link-flash')
  if (extras.length) {
    gsap.from(extras, {
      y: 18, opacity: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1,
      delay: inners.length ? 0.35 : 0,
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    })
  }
})

/* ================================
   5. img-float parallax
   ================================ */
gsap.utils.toArray('.img-float').forEach(el => {
  const img = el.querySelector('img')
  if (!img) return
  gsap.to(img, {
    yPercent: -12,
    ease: 'none',
    scrollTrigger: {
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  })
})

/* ================================
   6. Line reveal
   ================================ */
gsap.utils.toArray('.line-reveal').forEach(el => {
  const dash = el.querySelector('.line-dash')
  if (!dash) return
  gsap.from(dash, {
    scaleX: 0,
    transformOrigin: 'left center',
    duration: 1.4,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 88%',
      toggleActions: 'play none none none',
    },
  })
})

/* ================================
   7. Properties grid
   ================================ */
const propGrid = document.querySelector('.props-grid')
if (propGrid) {
  gsap.from(gsap.utils.toArray('.prop-card', propGrid), {
    y: 40, opacity: 0, duration: 0.85, ease: 'power2.out', stagger: 0.07,
    scrollTrigger: { trigger: propGrid, start: 'top 85%' },
  })
}

/* ================================
   8. Services items
   ================================ */
gsap.utils.toArray('.svc-item').forEach(item => {
  const num  = item.querySelector('.svc-num')
  const name = item.querySelector('.svc-name')
  const desc = item.querySelector('.svc-desc')
  const tl = gsap.timeline({
    scrollTrigger: { trigger: item, start: 'top 88%', toggleActions: 'play none none none' },
  })
  if (num)  tl.from(num,  { x: -14, opacity: 0, duration: 0.5, ease: 'power2.out' }, 0)
  if (name) tl.from(name, { y: 16, opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.08)
  if (desc) tl.from(desc, { y: 12, opacity: 0, duration: 0.65, ease: 'power2.out' }, 0.22)
})

/* ================================
   9. About section
   ================================ */
const aboutGrid = document.querySelector('.about-grid')
if (aboutGrid) {
  gsap.from('.about-img-col', {
    x: -28, opacity: 0, duration: 1.1, ease: 'power2.out',
    scrollTrigger: { trigger: aboutGrid, start: 'top 82%' },
  })
  gsap.from(['.about-role', '.about-copy', '.about-creds li'], {
    y: 16, opacity: 0, duration: 0.75, ease: 'power2.out', stagger: 0.08,
    scrollTrigger: { trigger: '.about-text-col', start: 'top 85%' },
  })
}

/* ================================
   10. Testimonials — TREF line reveal + slider + auto-rotation
   ================================ */
const testiItems = Array.from(document.querySelectorAll('.testi-item'))
const testiDots  = Array.from(document.querySelectorAll('.testi-dot'))
let testiCurrent = Math.floor(Math.random() * testiItems.length)
let activeST     = null
let activeAnim   = null

// Split quote into rendered lines, return cover elements via callback
function buildLines(item, callback) {
  const quote = item.querySelector('.testi-big-quote')
  if (!quote) return

  if (!quote.dataset.raw) quote.dataset.raw = quote.textContent.trim()

  // Phase 1 — word spans for measuring
  quote.innerHTML = quote.dataset.raw
    .split(/\s+/)
    .map(w => `<span class="tw">${w}</span>`)
    .join(' ')

  // Phase 2 — measure after browser renders, group by offsetTop
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const words = Array.from(quote.querySelectorAll('.tw'))
    const lineMap = new Map()
    words.forEach(word => {
      const top = Math.round(word.offsetTop)
      if (!lineMap.has(top)) lineMap.set(top, [])
      lineMap.get(top).push(word.textContent)
    })

    // Phase 3 — rebuild with .testi-line + .testi-cover per line
    quote.innerHTML = ''
    const covers = []
    lineMap.forEach(lineWords => {
      const text = lineWords.join(' ')
      const line = document.createElement('span')
      line.className = 'testi-line'
      line.textContent = text
      const cover = document.createElement('span')
      cover.className = 'testi-cover'
      cover.textContent = text
      line.appendChild(cover)
      quote.appendChild(line)
      covers.push(cover)
    })

    gsap.set(covers, { width: 0 })
    callback(covers, quote)
  }))
}

// Mode 1 — scroll scrub (first slide on page load)
function buildScrollScrub(item) {
  if (activeST)   { activeST.kill();   activeST   = null }
  if (activeAnim) { activeAnim.kill(); activeAnim = null }

  buildLines(item, (covers, quote) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: quote,
        start: 'top 88%',
        end: 'bottom 25%',
        scrub: 1.2,
      }
    })
    covers.forEach((cover, i) => {
      tl.to(cover, { width: '100%', ease: 'none', duration: 1 }, i * (0.7 / covers.length))
    })
    activeST = tl.scrollTrigger
    ScrollTrigger.refresh()
  })
}

// Mode 2 — auto timed reveal (slide transitions)
function buildAutoReveal(item) {
  if (activeST)   { activeST.kill();   activeST   = null }
  if (activeAnim) { activeAnim.kill(); activeAnim = null }

  buildLines(item, covers => {
    const tl = gsap.timeline()
    covers.forEach((cover, i) => {
      tl.to(cover, { width: '100%', ease: 'power2.inOut', duration: 0.55 }, i * 0.2)
    })
    activeAnim = tl
  })
}

function showTesti(index, isFirst = false) {
  testiItems.forEach((item, i) => item.classList.toggle('is-active', i === index))
  testiDots.forEach((dot,  i) => dot.classList.toggle('is-active',  i === index))
  testiCurrent = index

  if (isFirst) {
    buildScrollScrub(testiItems[index])
  } else {
    setTimeout(() => buildAutoReveal(testiItems[index]), 320)
  }
}

// Boot with random slide — scroll scrub
showTesti(testiCurrent, true)

// Auto-rotation
let autoTimer   = null
let resumeTimer = null
const AUTO_MS   = 5000
const PAUSE_MS  = 8000

function startAuto() {
  stopAuto()
  autoTimer = setInterval(() => {
    showTesti((testiCurrent + 1) % testiItems.length, false)
  }, AUTO_MS)
}

function stopAuto() {
  clearInterval(autoTimer)
  autoTimer = null
}

function pauseThenResume() {
  stopAuto()
  clearTimeout(resumeTimer)
  resumeTimer = setTimeout(startAuto, PAUSE_MS)
}

// Only rotate when section is visible
const testiSection = document.querySelector('.testi-section')
if (testiSection) {
  new IntersectionObserver(([entry]) => {
    entry.isIntersecting ? startAuto() : stopAuto()
  }, { threshold: 0.2 }).observe(testiSection)
}

// Manual controls
document.getElementById('testi-prev')?.addEventListener('click', () => {
  showTesti((testiCurrent - 1 + testiItems.length) % testiItems.length, false)
  pauseThenResume()
})
document.getElementById('testi-next')?.addEventListener('click', () => {
  showTesti((testiCurrent + 1) % testiItems.length, false)
  pauseThenResume()
})
testiDots.forEach((dot, i) => dot.addEventListener('click', () => {
  showTesti(i, false)
  pauseThenResume()
}))

/* ================================
   11. Join section
   ================================ */
gsap.from('.join-body', {
  y: 28, opacity: 0, duration: 0.9, ease: 'power2.out',
  scrollTrigger: { trigger: '.join', start: 'top 82%' },
})

/* ================================
   12. Footer
   ================================ */
gsap.from('.footer .footer-top', {
  y: 20, opacity: 0, duration: 0.8, ease: 'power2.out',
  scrollTrigger: { trigger: '.footer', start: 'top 95%' },
})
