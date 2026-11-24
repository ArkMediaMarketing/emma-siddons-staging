function connectTabs(selector: string, onChange?: (index: number, count: number) => void) {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(selector)];
  const show = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      if (panel) { panel.hidden = !active; panel.classList.toggle('is-showing', active); }
    });
    if (focus) tabs[index]?.focus();
    onChange?.(index, tabs.length);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(index));
    tab.addEventListener('keydown', event => {
      const direction = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 0;
      let next = index;
      if (direction) next = (index + direction + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      show(next, true);
    });
  });
  if (tabs.length) show(0);
  return {show, count: tabs.length};
}
connectTabs('.help-situations .pick__tab');
const previous = document.querySelector<HTMLButtonElement>('.help-situations [data-step="-1"]');
const next = document.querySelector<HTMLButtonElement>('.help-situations [data-step="1"]');
let current = 0;
const steps = connectTabs('.help-situations .stepper__btn', (index, count) => {
  current = index;
  if (previous) previous.disabled = index === 0;
  if (next) next.disabled = index === count - 1;
});
previous?.addEventListener('click', () => steps.show(Math.max(0, current - 1)));
next?.addEventListener('click', () => steps.show(Math.min(steps.count - 1, current + 1)));
