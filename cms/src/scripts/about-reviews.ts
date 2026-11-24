const track = document.querySelector<HTMLElement>('.about-brief .reviews__track');
if (track) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let visible = false;
  track.setAttribute('aria-description', 'Client reviews scroll automatically. Focus here with the keyboard to pause.');
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, {threshold: .1}).observe(track);
  window.setInterval(() => {
    const card = track.querySelector<HTMLElement>('.review');
    if (!card || !visible || document.hidden || motion.matches || track.matches(':focus-visible')) return;
    const step = card.getBoundingClientRect().width + 18;
    const shown = Math.max(1, Math.round(track.clientWidth / step));
    const last = Math.max(0, track.children.length - shown);
    index = index >= last ? 0 : index + 1;
    track.scrollTo({left: index * step, behavior: 'smooth'});
  }, 4000);
}
