// Registro del service worker y botón "Instalar app" (Chrome/Android/escritorio) o instrucciones (iPhone/iPad).
(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ }));
  }
  const yaInstalada = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let aviso = null;

  function botones() { return document.querySelectorAll('[data-instalar]'); }
  function mostrar(texto) { for (const b of botones()) { b.hidden = false; if (texto) b.textContent = texto; } }
  function ocultar() { for (const b of botones()) b.hidden = true; }

  if (yaInstalada) { ocultar(); return; }

  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); aviso = ev; mostrar('Instalar app'); });
  window.addEventListener('appinstalled', () => { aviso = null; ocultar(); });

  document.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('[data-instalar]');
    if (!boton) return;
    if (aviso) {
      aviso.prompt();
      const { outcome } = await aviso.userChoice;
      if (outcome === 'accepted') ocultar();
      aviso = null;
    } else if (esIOS) {
      const ayuda = document.getElementById(boton.dataset.instalar);
      if (ayuda) ayuda.hidden = !ayuda.hidden;
    }
  });

  // En iPhone/iPad no hay botón del sistema: se muestran las instrucciones de Safari.
  if (esIOS) document.addEventListener('DOMContentLoaded', () => mostrar('Instalar app'));
})();
