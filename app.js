// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW Registered', reg))
      .catch(err => console.error('SW Failed', err));
  });
}

// PWA Install Logic
let deferredPrompt;
const installBtn = document.createElement('div');
installBtn.id = 'pwa-install-btn';
installBtn.innerHTML = `
  <div class="install-popup glass">
    <div class="install-content">
      <img src="Eventora Aap Logo.jpg" alt="Eventora Logo" class="app-icon-mini">
      <div class="install-text">
        <strong>Install Eventora</strong>
        <p>Get a faster experience on your home screen.</p>
      </div>
      <button class="btn btn-primary" id="btns-install">Install</button>
      <button class="btn-close" id="btns-close-pwa">✕</button>
    </div>
  </div>
`;
installBtn.style.display = 'none';
document.body.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'block';
});

document.getElementById('btns-install')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    deferredPrompt = null;
    installBtn.style.display = 'none';
  }
});

document.getElementById('btns-close-pwa')?.addEventListener('click', () => {
  installBtn.style.display = 'none';
});

// App Layout & Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
  // Add active state to bottom nav based on current page
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.bottom-nav-item');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (currentPath.includes(href) && href !== './') {
      link.classList.add('active');
    } else if (currentPath.endsWith('/') || currentPath.includes('index.html')) {
      if (href === './index.html' || href === './') link.classList.add('active');
    }
  });

  // Smooth transitions
  document.body.classList.add('fade-in');
});
