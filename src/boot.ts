/** Content and controls first, visible images next, fonts and visited-only caching last. */
const screen = document.getElementById('load-screen');
const slow = setTimeout(() => { if (screen) screen.dataset.state = 'slow'; }, 15000);
const painted = () => new Promise<void>(resolve => {
  if (document.hidden) resolve();
  else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});
try {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    // An earlier production preview may have registered a worker on this localhost port.
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }
  if (document.body.dataset.page === 'guide') {
    const { mountGuide } = await import('./guide/main.ts');
    await mountGuide();
  } else {
    const { mountQuickref } = await import('./quickref/main.ts');
    const unmount = await mountQuickref();
    import.meta.hot?.dispose(unmount);
  }
  const { initPeek } = await import('./lib/peek.ts');
  const disposePeek = initPeek();
  import.meta.hot?.dispose(disposePeek);
  clearTimeout(slow);
  document.body.classList.remove('is-loading');
  document.body.removeAttribute('aria-busy');
  screen?.remove();
  performance.mark('app-ready');
  await painted();
  import('./lib/about.ts').then(module => {
    const dispose = module.initAbout();
    import.meta.hot?.dispose(dispose);
  }).catch(() => {});
  import('./lib/deferred.ts').then(module => module.loadDeferredAssets()).catch(() => {});
} catch (error) {
  clearTimeout(slow);
  if (screen) screen.dataset.state = 'error';
  console.error('Page initialization failed', error);
}
