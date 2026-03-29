// ============================================================
// NaijaWorks — Dashboard Shared JS
// ============================================================

let dashUser = null;
let dashWallet = null;
let notifPanel = null;

// ─── Init Dashboard ───────────────────────────────────────
async function initDashboard(requiredRole) {
  // Guard: require auth
  await new Promise(resolve => {
    const unsub = firebase.auth().onAuthStateChanged(async (user) => {
      unsub();
      if (!user) { window.location.href = '/login.html'; return; }

      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) { window.location.href = '/login.html'; return; }
        const data = await res.json();
        dashUser = data.user;

        // Role check
        if (requiredRole && dashUser.role !== requiredRole && dashUser.role !== 'admin') {
          window.location.href = dashUser.role === 'worker'
            ? '/worker-dashboard.html'
            : '/client-dashboard.html';
          return;
        }

        renderSidebarUser();
        loadNotifications();
        resolve();
      } catch (e) {
        window.location.href = '/login.html';
      }
    });
  });
}

// ─── Sidebar User ─────────────────────────────────────────
function renderSidebarUser() {
  if (!dashUser) return;
  const nameEl   = document.getElementById('sidebar-user-name');
  const roleEl   = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const topbarEl = document.getElementById('topbar-username');

  if (nameEl)   nameEl.textContent   = dashUser.fullName || 'User';
  if (roleEl)   roleEl.textContent   = (dashUser.isVIP ? '⭐ VIP ' : '') + (dashUser.role || '');
  if (topbarEl) topbarEl.textContent = dashUser.fullName?.split(' ')[0] || '';

  if (avatarEl) {
    if (dashUser.profilePhoto) {
      avatarEl.innerHTML = `<img src="${dashUser.profilePhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    } else {
      avatarEl.textContent = getInitials(dashUser.fullName);
    }
  }
}

// ─── Sidebar Toggle (mobile) ──────────────────────────────
function initSidebarToggle() {
  const sidebar  = document.getElementById('dash-sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const hamburger= document.getElementById('topbar-hamburger');

  if (!sidebar) return;

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay?.classList.remove('open');
  });
}

// ─── Notifications ────────────────────────────────────────
async function loadNotifications() {
  try {
    const token = await getAuthToken();
    const res = await fetch('/api/v1/notifications?limit=20', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    renderNotifications(data.notifications || []);
  } catch (e) {}
}

function renderNotifications(notifications) {
  const panel = document.getElementById('notif-panel');
  const dot   = document.getElementById('notif-dot');
  const unread = notifications.filter(n => !n.read);

  if (dot) dot.style.display = unread.length ? 'block' : 'none';

  if (!panel) return;
  const listEl = panel.querySelector('.notif-list');
  if (!listEl) return;

  if (!notifications.length) {
    listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.9rem;">No notifications yet</div>`;
    return;
  }

  listEl.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}', this)">
      <div class="notif-item-title">${n.title || 'Notification'}</div>
      <div class="notif-item-msg">${n.message || ''}</div>
      <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
    </div>`).join('');
}

async function markNotifRead(id, el) {
  el.classList.remove('unread');
  try {
    const token = await getAuthToken();
    await fetch(`/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (e) {}
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('open');
}

// ─── Active sidebar link ──────────────────────────────────
function setActiveSidebarLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.includes(href.replace('.html', '').replace('/', ''))) {
      link.classList.add('active');
    }
  });
}

// ─── Wallet Card ──────────────────────────────────────────
async function loadWalletSummary(elId) {
  try {
    const token = await getAuthToken();
    const res = await fetch('/api/v1/wallet', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    dashWallet = data.wallet;
    const el = document.getElementById(elId);
    if (!el) return;

    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--green-50);">💰</div>
        <div class="stat-label">Available Balance</div>
        <div class="stat-value">${formatNaira(dashWallet.availableBalance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fef9c3;">⏳</div>
        <div class="stat-label">Pending Earnings</div>
        <div class="stat-value">${formatNaira(dashWallet.pendingBalance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--green-50);">📈</div>
        <div class="stat-label">Total Earned</div>
        <div class="stat-value">${formatNaira(dashWallet.totalEarned)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fee2e2;">💸</div>
        <div class="stat-label">Total Withdrawn</div>
        <div class="stat-value">${formatNaira(dashWallet.totalWithdrawn)}</div>
      </div>`;
  } catch (e) {}
}

// ─── Generic Table Loader ─────────────────────────────────
async function loadTableData(endpoint, tableBodyId, renderRow, emptyMsg = 'No records found') {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted);">
    <div class="spinner dark" style="margin:0 auto 12px;"></div>Loading…</td></tr>`;

  try {
    const token = await getAuthToken();
    const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const items = data.jobs || data.offers || data.contracts || data.withdrawals || data.reviews || data.items || [];

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted);">${emptyMsg}</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(renderRow).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--status-error);">Failed to load. <button onclick="location.reload()" class="btn btn-ghost btn-sm">Retry</button></td></tr>`;
  }
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  setActiveSidebarLink();

  // Notification toggle
  document.getElementById('notif-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifPanel();
  });
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notif-panel');
    if (panel && !panel.contains(e.target) && e.target.id !== 'notif-btn') {
      panel.classList.remove('open');
    }
  });

  // Logout
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', handleLogout);
  });
});
