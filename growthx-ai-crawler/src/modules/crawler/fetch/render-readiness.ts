/** Runs inside the browser. Keep this function self-contained. */
export function renderedContentReady(): boolean {
  const root = document.querySelector('main, [role="main"], #root, #app, #__next, [data-reactroot]');
  if (!root) return Boolean(document.body?.innerText.trim());
  const text = (root.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text || /^(?:loading(?:\.{0,3}|…)?|please wait(?:\.{0,3}|…)?|loading (?:page|content|products)(?:\.{0,3}|…)?)[.!\s]*$/i.test(text)) return false;
  // A short sign-in form is valid content; a busy skeleton is not.
  if (root.getAttribute('aria-busy') === 'true') return false;
  if (text.length < 120 && /^(?:loading|please wait)\b/i.test(text) && !root.querySelector('h1, form, input, button')) return false;
  return true;
}
