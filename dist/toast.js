export function toast(message, type = 'success', duration = 5500) {
  const node = document.createElement('div'); node.className = `toast ${type}`;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const text = document.createElement('span'); text.textContent = message;
  const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', 'Fechar notificação');
  node.append(text, close); document.querySelector('#toasts').append(node);
  let remaining = duration, started, timer, hovering = false, focused = false;
  function pause() { clearTimeout(timer); if (started) remaining -= performance.now() - started; started = null; }
  function resume() { if (hovering || focused) return; started = performance.now(); timer = setTimeout(remove, Math.max(0, remaining)); }
  function remove() { clearTimeout(timer); node.remove(); }
  node.addEventListener('mouseenter', () => { hovering = true; pause(); });
  node.addEventListener('mouseleave', () => { hovering = false; resume(); });
  node.addEventListener('focusin', () => { focused = true; pause(); });
  node.addEventListener('focusout', e => { if (!node.contains(e.relatedTarget)) { focused = false; resume(); } });
  close.addEventListener('click', remove); resume();
}
