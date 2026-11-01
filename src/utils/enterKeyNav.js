/**
 * Enter-key navigation utility for accounting / billing workflow (Tally / Busy style).
 * Pressing Enter inside any input or select advances focus to the next field/option.
 */

export function handleEnterKeyNavigation(e, containerElement = document) {
  if (e.key !== 'Enter') return;
  if (e.isDefaultPrevented && e.isDefaultPrevented()) return;

  const target = e.target;
  if (!target) return;

  // Allow Enter in standard multiline textareas and rich editors
  if (target.tagName === 'TEXTAREA') return;
  if (target.isContentEditable) return;

  // Buttons should be triggered by Enter, not skipped
  if (target.tagName === 'BUTTON' || target.type === 'submit' || target.getAttribute('role') === 'button') {
    return;
  }

  // If inside a modal/dialog, constrain focus traversal to that modal
  const modal = target.closest('.modal-content, .modal, dialog, [role="dialog"], .quick-add-modal');
  const root = modal || containerElement || document;

  // Selector for all keyboard-focusable form inputs
  const selector = [
    'input:not([type="hidden"]):not([disabled]):not([readonly])',
    'select:not([disabled])',
    '[tabindex="0"]:not([disabled])'
  ].join(', ');

  const focusables = Array.from(root.querySelectorAll(selector)).filter((el) => {
    // Only visible elements with non-zero dimensions
    return (
      el.offsetParent !== null &&
      !el.closest('[aria-hidden="true"]') &&
      window.getComputedStyle(el).display !== 'none' &&
      window.getComputedStyle(el).visibility !== 'hidden'
    );
  });

  const currentIndex = focusables.indexOf(target);

  if (currentIndex !== -1) {
    if (currentIndex < focusables.length - 1) {
      e.preventDefault();
      const nextEl = focusables[currentIndex + 1];
      nextEl.focus();
      if (nextEl.select && typeof nextEl.select === 'function' && ['text', 'number', 'tel', 'email', 'search', 'url'].includes(nextEl.type || 'text')) {
        nextEl.select();
      }
    } else {
      // Last field in the form / modal: focus primary submit button if available
      const submitBtn = root.querySelector('button[type="submit"], button.btn-primary, .modal-content button.btn-primary');
      if (submitBtn && submitBtn !== target) {
        e.preventDefault();
        submitBtn.focus();
      }
    }
  }
}

/**
 * Attaches a global Enter-key listener across the entire app so all pages,
 * inputs, selects, and options seamlessly navigate to the next field on Enter.
 */
export function attachGlobalEnterKeyNav() {
  const listener = (e) => {
    handleEnterKeyNavigation(e, document);
  };

  document.addEventListener('keydown', listener, false);

  return () => {
    document.removeEventListener('keydown', listener, false);
  };
}
