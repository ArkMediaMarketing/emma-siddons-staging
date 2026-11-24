function rotateReviews(carousel: HTMLElement, cards: HTMLElement[], single = false) {
  const mobile = window.matchMedia('(max-width:600px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let first = 0;
  let hovered = false;
  let focused = false;
  let visible = true;
  const count = () => single || mobile.matches ? 1 : 2;

  function show() {
    // Reduced-motion visitors can read every review without automatic replacement.
    if (reducedMotion.matches) {
      cards.forEach(card => { card.hidden = false; (single ? card.parentElement! : carousel).appendChild(card); });
      return;
    }
    const selected = Array.from({ length: count() }, (_, i) => (first + i) % cards.length);
    cards.forEach((card, index) => { card.hidden = !selected.includes(index); });
    selected.forEach(index => (single ? cards[index].parentElement! : carousel).appendChild(cards[index]));
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

const topReviews = document.querySelector<HTMLElement>('[data-home-new-reviews]');
const reviewCards = topReviews ? [...topReviews.querySelectorAll<HTMLElement>('.nh-review')] : [];
if (topReviews && reviewCards.length) rotateReviews(topReviews, reviewCards);

const bottomReviews = document.querySelector<HTMLElement>('[data-home-new-bottom-reviews]');
const bottomInner = bottomReviews?.querySelector<HTMLElement>('.nh-testimonial__inner');
const originalQuote = bottomInner?.querySelector<HTMLElement>('blockquote');
if (bottomReviews && bottomInner && originalQuote) {
  // Reuse the verified, CMS-editable review copy from the top carousel.
  const quotes = [originalQuote];
  const originalText = originalQuote.querySelector('p')?.textContent?.trim();
  for (const card of reviewCards) {
    const text = card.querySelector('blockquote p')?.textContent?.trim();
    const author = card.querySelector('figcaption')?.cloneNode(true) as HTMLElement | undefined;
    author?.querySelectorAll('span').forEach(label => label.remove());
    if (!text || !author || text === originalText) continue;
    const quote = document.createElement('blockquote');
    const paragraph = document.createElement('p');
    const citation = document.createElement('cite');
    paragraph.textContent = text;
    citation.textContent = author.textContent?.trim() || '';
    quote.appendChild(paragraph);
    quote.appendChild(citation);
    bottomInner.appendChild(quote);
    quotes.push(quote);
  }
  rotateReviews(bottomReviews, quotes, true);
}
