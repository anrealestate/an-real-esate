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
   10. Testimonials — word-by-word scroll scrub
   ================================ */
gsap.utils.toArray('.testi-big-quote').forEach(el => {
  // Split into word spans preserving punctuation
  const raw = el.textContent.trim()
  el.innerHTML = raw.split(/\s+/).map(w => `<span class="word">${w}</span>`).join(' ')

  const words = el.querySelectorAll('.word')
  gsap.set(words, { opacity: 0.12 })

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: el,
      start: 'top 88%',
      end: 'bottom 25%',
      scrub: 1.2,
    }
  })
  tl.to(words, { opacity: 1, ease: 'none', stagger: { each: 0.06 } })
})

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
