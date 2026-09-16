addEventListener('load', () => {
  if (typeof THREE === 'undefined') return;
  setTimeout(() => {
    Engine.init();
    UI.init();
    Engine.animate();
    document.getElementById('loading').classList.add('hidden');
    Utils.showStatus('Готов')
  }, 200)
});