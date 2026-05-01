/* ================================
   Form field helpers
   ================================ */
function showFieldError(input, msg) {
  clearFieldError(input)
  input.style.borderColor = 'var(--gold)'
  const err = document.createElement('p')
  err.className = 'field-error'
  err.textContent = msg
  input.parentNode.appendChild(err)
}
function clearFieldError(input) {
  input.style.borderColor = ''
  const prev = input.parentNode.querySelector('.field-error')
  if (prev) prev.remove()
}

/* ================================
   Toast notification
   ================================ */
function showToast(msg) {
  let t = document.getElementById('an-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'an-toast'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('is-visible')
  clearTimeout(t._tid)
  t._tid = setTimeout(() => t.classList.remove('is-visible'), 4000)
}

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

const backdrop = document.createElement('div')
backdrop.id = 'drawer-backdrop'
document.body.appendChild(backdrop)

function closeDrawer() {
  drawer.classList.remove('open')
  hamburger.classList.remove('open')
  hamburger.setAttribute('aria-expanded', 'false')
  drawer.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
  backdrop.classList.remove('open')
}

hamburger?.addEventListener('click', () => {
  const open = drawer.classList.toggle('open')
  hamburger.classList.toggle('open', open)
  hamburger.setAttribute('aria-expanded', open)
  drawer.setAttribute('aria-hidden', !open)
  document.body.style.overflow = open ? 'hidden' : ''
  backdrop.classList.toggle('open', open)
})

backdrop.addEventListener('click', closeDrawer)

document.querySelectorAll('.drawer-link, .drawer-phone, .drawer-close').forEach(el => {
  el.addEventListener('click', closeDrawer)
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer()
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
  bannerTimer = setInterval(() => showBannerSlide(bannerCur + 1), 6500)
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
const contactForm = document.getElementById('contact-form')

if (contactForm) {
  const nameInput  = contactForm.querySelector('[name="name"]')
  const emailInput = contactForm.querySelector('[name="email"]')

  const getLangT = () => {
    const lang = (typeof getLang === 'function') ? getLang() : 'en'
    return k => window.I18N?.[lang]?.[k] || window.I18N?.en?.[k] || k
  }

  emailInput?.addEventListener('blur', () => {
    const val = emailInput.value.trim()
    if (!val) { clearFieldError(emailInput); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      showFieldError(emailInput, getLangT()('form.err.email'))
    } else {
      clearFieldError(emailInput)
    }
  })

  emailInput?.addEventListener('input', () => clearFieldError(emailInput))
  nameInput?.addEventListener('input',  () => clearFieldError(nameInput))
}

contactForm?.addEventListener('submit', async e => {
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

  btn.textContent = t('form.sending')
  btn.disabled    = true

  try {
    const res = await fetch('https://formsubmit.co/ajax/alvaro@anrealestate.es', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        interest: form.querySelector('[name="interest"]').value,
        message:  form.querySelector('[name="message"]').value.trim(),
        _subject:  'Nuevo contacto web — AN Real Estate',
        _captcha:  'false',
        _template: 'table',
      }),
    })
    if (!res.ok) throw new Error(`Contact form failed: ${res.status}`)
    btn.textContent       = t('form.sent')
    btn.style.background  = 'var(--gold)'
    btn.style.borderColor = 'var(--gold)'
    btn.style.color       = 'var(--bg)'
    form.reset()
    showToast(t('form.toast_contact'))
    setTimeout(() => {
      btn.textContent       = t('contact.submit')
      btn.style.background  = ''
      btn.style.borderColor = ''
      btn.style.color       = ''
      btn.disabled          = false
    }, 4000)
  } catch {
    btn.textContent = t('form.error')
    btn.disabled    = false
    const submitWrap = form.querySelector('.join-submit')
    if (submitWrap && !submitWrap.querySelector('.form-error-alt')) {
      const alt = document.createElement('p')
      alt.className = 'form-error-alt'
      alt.innerHTML = t('form.error.alt')
        .replace('{wa}',    'https://wa.me/34628020434')
        .replace('{email}', 'mailto:alvaro@anrealestate.es')
      submitWrap.appendChild(alt)
    }
    setTimeout(() => { btn.textContent = t('contact.submit') }, 4000)
  }
})
