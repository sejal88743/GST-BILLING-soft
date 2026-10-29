/**
 * Moves focus to the next input/select when the Enter key is pressed.
 * Textile / Accounting software standard behavior (like Tally / Busy).
 */
export function handleEnterKeyNavigation(e, containerElement = document) {
  if (e.key !== 'Enter') return;

  const target = e.target;
  if (!target) return;

  // Do not intercept Enter inside multi-line textareas or buttons
  if (target.tagName === 'TEXTAREA') return;
  if (target.tagName === 'BUTTON' || target.type === 'submit') return;

  // Find all focusable form inputs in the container
  const selector = 'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const root = containerElement || document;
  const focusables = Array.from(root.querySelectorAll(selector)).filter((el) => {
    // Only visible elements
    return el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
  });

  const currentIndex = focusables.indexOf(target);
  if (currentIndex !== -1 && currentIndex < focusables.length - 1) {
    e.preventDefault();
    const nextEl = focusables[currentIndex + 1];
    nextEl.focus();
    if (nextEl.select && typeof nextEl.select === 'function' && nextEl.tagName === 'INPUT') {
      nextEl.select();
    }
  }
}
