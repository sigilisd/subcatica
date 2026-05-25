export function escHtml(s) {
  const el = document.createElement('div');
  el.textContent = String(s ?? '');
  return el.innerHTML;
}

export function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
