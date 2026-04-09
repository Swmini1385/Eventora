// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW Registered'))
      .catch(err => console.error('SW Failed', err));
  });
}

// PWA Install Logic - Smart Behavior
let deferredPrompt;
const installBtn = document.createElement('div');
installBtn.id = 'pwa-install-btn';
installBtn.innerHTML = `
  <div class="install-popup glass">
    <div class="install-content">
      <img src="Eventora Aap Logo.jpg" alt="Eventora" class="app-icon-mini">
      <div class="install-text">
        <strong>Install Eventora</strong>
        <p>Add to home screen for absolute experience.</p>
      </div>
      <button class="btn btn-primary" id="btns-install" style="border-radius: 12px; padding: 0.6rem 1.25rem; font-weight: 700;">Install</button>
      <button class="btn-close" id="btns-close-pwa" style="position: absolute; top: -10px; right: -10px; background: #fff; color: #000; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; border: none; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">✕</button>
    </div>
  </div>
`;
installBtn.style.display = 'none';
document.body.appendChild(installBtn);

const checkInstallStatus = () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isLocalStored = localStorage.getItem('isAppInstalled') === 'true';
  
  if (isStandalone || isLocalStored) {
    if (isStandalone) localStorage.setItem('isAppInstalled', 'true');
    installBtn.style.display = 'none';
    return true;
  }
  return false;
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show button only if not already installed
  if (!checkInstallStatus()) {
    installBtn.style.display = 'block';
  }
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('isAppInstalled', 'true');
  installBtn.style.display = 'none';
  deferredPrompt = null;
  console.log('Eventora was installed');
});

document.getElementById('btns-install')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('isAppInstalled', 'true');
      installBtn.style.display = 'none';
    }
    deferredPrompt = null;
  }
});

document.getElementById('btns-close-pwa')?.addEventListener('click', () => {
  installBtn.style.display = 'none';
});

// App Layout & Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
  checkInstallStatus();

  // Add active state to bottom nav based on current page
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.bottom-nav-item');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const cleanHref = href.replace('./', '');
    if (currentPath.includes(cleanHref) && cleanHref !== '') {
      link.classList.add('active');
    } else if ((currentPath.endsWith('/') || currentPath.includes('index.html')) && (cleanHref === 'index.html' || cleanHref === '')) {
      link.classList.add('active');
    }
  });

  document.body.classList.add('fade-in');
});
