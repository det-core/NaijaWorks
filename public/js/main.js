// ============================================================
// NaijaWorks — Global Frontend Utilities
// ============================================================

// ─── Firebase SDK (loaded from CDN in HTML) ───────────────
// firebase/app, firebase/auth, firebase/firestore loaded via CDN

// ─── Auth State ───────────────────────────────────────────
let _currentUser = null;
let _authToken = null;

async function getAuthToken() {
  if (!firebase.auth().currentUser) return null;
  try {
    _authToken = await firebase.auth().currentUser.getIdToken(true);
    return _authToken;
  } catch (e) {
    return null;
  }
}

function getCurrentUser() {
  return _currentUser;
}

// Listen for auth state changes globally
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase === 'undefined') return;

  firebase.auth().onAuthStateChanged(async (user) => {
    _currentUser = user;
    if (user) {
      _authToken = await user.getIdToken();
      // Update nav UI
      updateNavForAuth(true);
    } else {
      _authToken = null;
      updateNavForAuth(false);
    }
  });
});

function updateNavForAuth(isLoggedIn) {
  const loginBtn = document.getElementById('nav-login-btn');
  const signupBtn = document.getElementById('nav-signup-btn');
  const dashBtn = document.getElementById('nav-dashboard-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');

  if (isLoggedIn) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (dashBtn) dashBtn.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (signupBtn) signupBtn.style.display = 'inline-flex';
    if (dashBtn) dashBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

// ─── API Request Helper ───────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const token = await getAuthToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
    config.headers['Content-Type'] = 'application/json';
  }

  if (config.body instanceof FormData) {
    delete config.headers['Content-Type']; // Let browser set multipart boundary
  }

  const response = await fetch(endpoint, config);
  let data;

  try {
    data = await response.json();
  } catch (e) {
    data = { success: false, message: 'Invalid server response' };
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

// Shorthand methods
const api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body }),
  patch: (url, body) => apiRequest(url, { method: 'PATCH', body }),
  delete: (url) => apiRequest(url, { method: 'DELETE' }),
  upload: (url, formData) => apiRequest(url, { method: 'POST', body: formData }),
};

// ─── Toast Notifications ──────────────────────────────────
function showToast(message, type = 'info', title = '', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const defaultTitles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '📢'}</span>
    <div class="toast-text">
      <div class="toast-title">${title || defaultTitles[type]}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button onclick="this.closest('.toast').remove()" style="background:none;border:none;color:#9298a8;cursor:pointer;font-size:1.1rem;padding:0;margin-left:8px;">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Form Helpers ─────────────────────────────────────────
function setButtonLoading(btn, loading, text) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text || 'Please wait...'}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || text || 'Submit';
  }
}

function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`) ||
                  input?.nextElementSibling;
  if (input) input.classList.add('error');
  if (errorEl && errorEl.classList.contains('form-error')) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`);
  if (input) input.classList.remove('error');
  if (errorEl) errorEl.classList.remove('show');
}

function clearAllErrors(formEl) {
  formEl.querySelectorAll('.form-input.error, .form-select.error').forEach(el => el.classList.remove('error'));
  formEl.querySelectorAll('.form-error.show').forEach(el => el.classList.remove('show'));
}

// ─── Formatters ───────────────────────────────────────────
function formatNaira(amount) {
  if (typeof amount !== 'number') return '₦0';
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(timestamp);
}

function renderStars(rating, max = 5) {
  const filled = Math.round(rating || 0);
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += `<span style="color:${i <= filled ? '#f59e0b' : '#d1d5db'}">★</span>`;
  }
  return html;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function truncate(text, length = 100) {
  if (!text || text.length <= length) return text;
  return text.substring(0, length).trim() + '...';
}

// ─── Auth Guards ──────────────────────────────────────────
function requireAuthPage(redirectTo = '/login.html') {
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = redirectTo;
    }
  });
}

function redirectIfLoggedIn(redirectTo = '/client-dashboard.html') {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;
    // Get role and redirect appropriately
    try {
      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const role = userDoc.data().role;
        window.location.href = role === 'worker' ? '/worker-dashboard.html' : '/client-dashboard.html';
      }
    } catch (e) {
      window.location.href = redirectTo;
    }
  });
}

// ─── Mobile Menu ──────────────────────────────────────────
function initMobileMenu() {
  const btn = document.getElementById('nav-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const closeBtn = document.getElementById('mobile-menu-close');

  if (!btn || !menu) return;

  btn.addEventListener('click', () => menu.classList.add('open'));
  if (closeBtn) closeBtn.addEventListener('click', () => menu.classList.remove('open'));

  // Close on outside click
  menu.addEventListener('click', (e) => {
    if (e.target === menu) menu.classList.remove('open');
  });
}

// ─── Scroll Animations ────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-up').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// ─── Logout ───────────────────────────────────────────────
async function handleLogout() {
  try {
    const token = await getAuthToken();
    if (token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    }
    await firebase.auth().signOut();
    window.location.href = '/';
  } catch (e) {
    await firebase.auth().signOut();
    window.location.href = '/';
  }
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initScrollAnimations();

  // Logout buttons
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', handleLogout);
  });
});
