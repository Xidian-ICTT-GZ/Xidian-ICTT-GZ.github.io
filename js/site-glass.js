(() => {
  const header = document.querySelector('.site-glass-header');
  const nav = header.querySelector('.nav');
  const menu = header.querySelector('.menu-trigger');
  const current = nav.querySelector('[aria-current="page"]');
  const links = [...nav.querySelectorAll('a')];
  const photo = document.querySelector('.home-glass-photo');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerMotion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const mobileMenu = matchMedia('(max-width: 991px)');
  let navTarget = current;

  if (photo) {
    const image = photo.querySelector('img');
    photo.style.setProperty('--home-photo-source', `url("${image.currentSrc || image.src}")`);
  }

  function moveNavLens(link) {
    navTarget = link;
    if (!link || link.closest('.contact-nav')) {
      nav.classList.remove('has-glass-lens');
      return;
    }
    const navBounds = nav.getBoundingClientRect();
    const linkBounds = link.getBoundingClientRect();
    nav.style.setProperty('--site-nav-x', `${linkBounds.left - navBounds.left - 10}px`);
    nav.style.setProperty('--site-nav-width', `${linkBounds.width + 20}px`);
    nav.classList.add('has-glass-lens');
  }

  for (const link of links) {
    link.addEventListener('pointerenter', event => {
      if (pointerMotion.matches && event.pointerType === 'mouse') moveNavLens(link);
    });
    link.addEventListener('focus', () => moveNavLens(link));
  }
  nav.addEventListener('pointerleave', () => {
    moveNavLens(links.includes(document.activeElement) ? document.activeElement : current);
  });
  nav.addEventListener('focusout', () => {
    if (!nav.contains(document.activeElement)) requestAnimationFrame(() => {
      if (!nav.contains(document.activeElement)) moveNavLens(current);
    });
  });
  new ResizeObserver(() => moveNavLens(navTarget)).observe(nav);
  moveNavLens(current);

  function setMenuOpen(open) {
    nav.classList.toggle('is-open', open);
    menu.classList.toggle('active', open);
    menu.setAttribute('aria-expanded', String(open));
  }

  menu.addEventListener('click', () => setMenuOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target) && nav.classList.contains('is-open')) setMenuOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !nav.classList.contains('is-open')) return;
    setMenuOpen(false);
    menu.focus();
  });
  mobileMenu.addEventListener('change', () => setMenuOpen(false));

  let scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0;
    const position = window.scrollY;
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const progress = distance > 0 ? Math.min(1, Math.max(0, position / distance)) : 0;
    header.classList.toggle('is-scrolled', position > 24);
    header.style.setProperty('--site-read-progress', String(progress));
  }

  function scheduleScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }

  addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  addEventListener('resize', scheduleScrollUpdate);
  new ResizeObserver(scheduleScrollUpdate).observe(document.body);
  updateScroll();

  if (!reducedMotion.matches) {
    const headingObserver = new IntersectionObserver((entries, observer) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.classList.add('site-heading-enter');
        observer.unobserve(target);
      }
    }, { threshold: .15 });
    for (const item of document.querySelectorAll('.section-heading > :is(h6,h4,.line-dec), .heading > h3, .student-gallery-header > h2')) {
      headingObserver.observe(item);
    }
  }

  const glassSurfaces = '.home-glass-photo, .site-glass-button, .portfolio-item .thumb, #blog .blog-post .thumb';
  let litSurface;
  let lightFrame = 0;
  let pointerX, pointerY;

  function clearLight() {
    cancelAnimationFrame(lightFrame);
    lightFrame = 0;
    if (!litSurface) return;
    litSurface.classList.remove('site-glass-lit');
    litSurface.style.removeProperty('--site-light-x');
    litSurface.style.removeProperty('--site-light-y');
    litSurface = null;
  }

  document.addEventListener('pointermove', event => {
    if (!pointerMotion.matches || event.pointerType !== 'mouse') return;
    const surface = event.target.closest(glassSurfaces);
    if (surface !== litSurface) clearLight();
    if (!surface) return;
    litSurface = surface;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (lightFrame) return;

    lightFrame = requestAnimationFrame(() => {
      lightFrame = 0;
      const bounds = litSurface.getBoundingClientRect();
      litSurface.style.setProperty('--site-light-x', `${100 * (pointerX - bounds.left) / bounds.width}%`);
      litSurface.style.setProperty('--site-light-y', `${100 * (pointerY - bounds.top) / bounds.height}%`);
      litSurface.classList.add('site-glass-lit');
    });
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', clearLight);
  pointerMotion.addEventListener('change', clearLight);
})();
