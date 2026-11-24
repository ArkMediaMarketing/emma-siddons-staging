const carousel = document.querySelector<HTMLElement>('[data-home-new-reviews]');

if (carousel) {
  const cards = [...carousel.querySelectorAll<HTMLElement>('.nh-review')];
  const controls = carousel.querySelector<HTMLElement>('[data-review-controls]');
  const previous = carousel.querySelector<HTMLButtonElement>('[data-review-previous]');
  const next = carousel.querySelector<HTMLButtonElement>('[data-review-next]');
  const pause = carousel.querySelector<HTMLButtonElement>('[data-review-pause]');
  const status = carousel.querySelector<HTMLElement>('[data-review-status]');
  const mobile = window.matchMedia('(max-width:600px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let first = 0;
  let paused = reducedMotion.matches;
  let hovered = false;
  let focused = false;
  let visible = true;
  const count = () => mobile.matches ? 1 : 2;

  function updatePause() {
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Play review rotation' : 'Pause review rotation');
    pause.setAttribute('aria-pressed', String(paused));
  }

  function show(automatic = false) {
    const selected = Array.from({ length: count() }, (_, i) => (first + i) % cards.length);
    // Keep DOM order consistent with the displayed pair, including the wrap-around pair.
    selected.forEach(index => carousel.insertBefore(cards[index], controls));
    cards.forEach((card, index) => {
      card.hidden = !selected.includes(index);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `Review ${index + 1} of ${cards.length}`);
    });
    const numbers = selected.map(index => index + 1);
    const range = numbers.length === 1 ? `${numbers[0]}` : numbers[1] > numbers[0]
      ? numbers.join('–') : numbers.join(' & ');
    status.setAttribute('aria-live', automatic ? 'off' : 'polite');
    status.textContent = `${range} of ${cards.length}`;
  }

  function move(direction: number, automatic = false) {
    first = (first + direction * count() + cards.length) % cards.length;
    show(automatic);
  }

  controls.hidden = false;
  carousel.setAttribute('aria-roledescription', 'carousel');
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  pause.addEventListener('click', () => {
    paused = !paused;
    if (!paused) focused = false; // Explicit Play resumes even while the button retains focus.
    updatePause();
  });
  carousel.addEventListener('mouseenter', () => { hovered = true; });
  carousel.addEventListener('mouseleave', () => { hovered = false; });
  carousel.addEventListener('focusin', () => { focused = true; });
  carousel.addEventListener('focusout', event => {
    focused = event.relatedTarget instanceof Node && carousel.contains(event.relatedTarget);
  });
  mobile.addEventListener('change', () => show(true));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { paused = true; updatePause(); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: 0.1 }).observe(carousel);
  }
  updatePause();
  show(true);
  const timer = window.setInterval(() => {
    if (!paused && !hovered && !focused && visible && !document.hidden) move(1, true);
  }, 7000);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
