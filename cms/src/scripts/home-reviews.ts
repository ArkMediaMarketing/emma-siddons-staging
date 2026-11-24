const carousel = document.querySelector<HTMLElement>('[data-home-new-reviews]');

if (carousel) {
  const cards = [...carousel.querySelectorAll<HTMLElement>('.nh-review')];
  const mobile = window.matchMedia('(max-width:600px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let first = 0;
  let hovered = false;
  let focused = false;
  let visible = true;
  const count = () => mobile.matches ? 1 : 2;

  function show() {
    // Reduced-motion visitors can read every review without automatic replacement.
    if (reducedMotion.matches) {
      cards.forEach(card => { card.hidden = false; carousel.appendChild(card); });
      return;
    }
    const selected = Array.from({ length: count() }, (_, i) => (first + i) % cards.length);
    cards.forEach((card, index) => { card.hidden = !selected.includes(index); });
    selected.forEach(index => carousel.appendChild(cards[index]));
  }

  carousel.tabIndex = 0;
  carousel.setAttribute('aria-description', 'Reviews rotate automatically. Focus here to pause.');
  carousel.addEventListener('mouseenter', () => { hovered = true; });
  carousel.addEventListener('mouseleave', () => { hovered = false; });
  carousel.addEventListener('focusin', () => { focused = true; });
  carousel.addEventListener('focusout', event => {
    focused = event.relatedTarget instanceof Node && carousel.contains(event.relatedTarget);
  });
  mobile.addEventListener('change', show);
  reducedMotion.addEventListener('change', show);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: 0.1 }).observe(carousel);
  }
  show();
  window.setInterval(() => {
    if (!hovered && !focused && visible && !document.hidden && !reducedMotion.matches) {
      first = (first + count()) % cards.length;
      show();
    }
  }, 4000);
}
