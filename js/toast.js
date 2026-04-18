/*!
 * Luz Estelar — Toast notifications
 * ──────────────────────────────────
 * Lightweight toast queue. No dependencies, no framework.
 *
 *   LuzEstelar.toast('Perfil guardado');
 *   LuzEstelar.toast('Algo salió mal', { kind: 'error' });
 *   LuzEstelar.toast('Nueva versión disponible', {
 *     kind: 'info',
 *     duration: 0,           // 0 = sticky until dismissed
 *     action: { label: 'Actualizar', onClick: reloadApp }
 *   });
 *
 * Kinds: 'info' (default), 'success', 'warn', 'error'.
 * Stacks from bottom-up on mobile (above bottom tabs), top on desktop.
 * Respects prefers-reduced-motion. Safe-area aware.
 */
(function () {
  'use strict';

  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.toast) return;

  var STACK_ID = 'le-toast-stack';
  var DEFAULT_DURATION = 4000;
  var ACTIVE = new Set();

  function ensureStack() {
    var el = document.getElementById(STACK_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = STACK_ID;
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'false');
    document.body.appendChild(el);
    injectStyles();
    return el;
  }

  function injectStyles() {
    if (document.getElementById('le-toast-styles')) return;
    var s = document.createElement('style');
    s.id = 'le-toast-styles';
    s.textContent = [
      '#le-toast-stack{',
      '  position:fixed;left:0;right:0;z-index:3000;pointer-events:none;',
      '  display:flex;flex-direction:column;align-items:center;gap:10px;',
      '  padding:16px;',
      // Mobile: stack above bottom tabs (62px) + safe area
      '  bottom:calc(76px + env(safe-area-inset-bottom,0));top:auto;',
      '}',
      '@media(min-width:640px){',
      '  #le-toast-stack{top:20px;bottom:auto;align-items:flex-end;padding-right:24px;}',
      '}',
      '.le-toast{',
      '  pointer-events:auto;min-width:240px;max-width:min(92vw,480px);',
      '  padding:12px 16px;border-radius:12px;',
      '  background:linear-gradient(180deg,#14143a,#0c0c2a);',
      '  border:1px solid var(--glass-b,rgba(255,255,255,0.08));',
      '  box-shadow:0 8px 28px rgba(0,0,0,0.45);',
      '  color:var(--text,#e0dce8);font-family:var(--font-body,Inter,sans-serif);',
      '  font-size:0.88rem;line-height:1.4;',
      '  display:flex;align-items:center;gap:12px;',
      '  transform:translateY(20px);opacity:0;',
      '  transition:transform 260ms var(--ease-standard,cubic-bezier(0.2,0,0,1)),opacity 200ms linear;',
      '  will-change:transform,opacity;',
      '}',
      '.le-toast.is-shown{transform:translateY(0);opacity:1;}',
      '.le-toast.kind-success{border-left:3px solid var(--ok,#8fc79a);}',
      '.le-toast.kind-error{border-left:3px solid var(--err,#e89b9b);}',
      '.le-toast.kind-warn{border-left:3px solid var(--warn,#e8c07a);}',
      '.le-toast.kind-info{border-left:3px solid var(--gold,#d4a849);}',
      '.le-toast-msg{flex:1;min-width:0;}',
      '.le-toast-action{',
      '  padding:6px 12px;border-radius:8px;border:none;cursor:pointer;',
      '  background:var(--gold,#d4a849);color:var(--bg-deep,#06061a);',
      '  font-family:inherit;font-weight:600;font-size:0.82rem;',
      '  flex-shrink:0;min-height:32px;',
      '}',
      '.le-toast-close{',
      '  background:none;border:none;color:var(--text-dim,#9890a8);',
      '  font-size:1.3rem;line-height:1;cursor:pointer;padding:4px;',
      '  flex-shrink:0;',
      '}',
      '.le-toast-close:hover{color:var(--text,#e0dce8);}',
      '@media (prefers-reduced-motion: reduce){',
      '  .le-toast{transition:none;}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  function toast(message, opts) {
    opts = opts || {};
    var kind = opts.kind || 'info';
    var duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION;
    var stack = ensureStack();
    var el = document.createElement('div');
    el.className = 'le-toast kind-' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    var msg = document.createElement('div');
    msg.className = 'le-toast-msg';
    msg.textContent = message;
    el.appendChild(msg);

    var dismissBtn;
    var actionBtn;
    if (opts.action && opts.action.label) {
      actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'le-toast-action';
      actionBtn.textContent = opts.action.label;
      actionBtn.addEventListener('click', function () {
        try { opts.action.onClick && opts.action.onClick(); } catch (e) {}
        dismiss();
      });
      el.appendChild(actionBtn);
    }

    // Always provide a close button for sticky toasts
    if (duration === 0 || opts.dismissable !== false) {
      dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'le-toast-close';
      dismissBtn.setAttribute('aria-label', 'Cerrar');
      dismissBtn.innerHTML = '&times;';
      dismissBtn.addEventListener('click', dismiss);
      el.appendChild(dismissBtn);
    }

    stack.appendChild(el);
    ACTIVE.add(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-shown'); });
    });

    var timer = null;
    if (duration > 0) {
      timer = setTimeout(dismiss, duration);
    }

    function dismiss() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!ACTIVE.has(el)) return;
      ACTIVE.delete(el);
      el.classList.remove('is-shown');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }

    return { dismiss: dismiss };
  }

  ns.toast = toast;
})();
