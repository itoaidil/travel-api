const API_BASE_URL = 'https://travel-api-production-23ae.up.railway.app';
// const API_BASE_URL = 'http://localhost:3000';

// ── Auth helpers ────────────────────────────────────────────────────────────
function getAdminToken() {
  return localStorage.getItem('hantar_admin_token') || '';
}

function getAdminAuthHeaders() {
  const token = getAdminToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function adminLogout() {
  localStorage.removeItem('hantar_admin_token');
  localStorage.removeItem('hantar_admin_token_exp');
  // Also clear old prompt-based token
  localStorage.removeItem('exp_seed_token');
  window.location.replace('/admin/login.html');
}
// ── End auth helpers ─────────────────────────────────────────────────────────

let currentMode = 'drivers';
let currentView = 'dashboard';
let currentReject = { id: null, type: 'driver' };
let currentFranchiseId = null;
let currentApplicantId = null;
let jobsCache = [];
let applicantsCache = [];
let expeditionCache = [];
let expeditionPricingServices = [];
let expeditionMinCharges = [];
let dispatchDrivers = [];
let dispatchSummaryRows = [];
let dispatchSearchableReady = false;
let senderCoords = null;
let recipientCoords = null;
let driverStatusChartInstance = null;
let franchiseStatusChartInstance = null;
let customerGrowthChartInstance = null;
let transactionsTrendChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // Show logged-in username in topbar
  try {
    const token = getAdminToken();
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const el = document.getElementById('adminUsernameLabel');
      if (el && payload.username) el.textContent = payload.username;
    }
  } catch (_) {}

  // Wire logout button
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);

  bindEvents();
  switchView('dashboard');
});

function bindEvents() {
  document.getElementById('menuDashboardBtn').addEventListener('click', () => switchView('dashboard'));
  document.getElementById('moduleDriversBtn').addEventListener('click', () => switchView('drivers'));
  document.getElementById('moduleFranchiseBtn').addEventListener('click', () => switchView('franchise'));
  document.getElementById('menuJobsBtn').addEventListener('click', () => switchView('jobs'));
  document.getElementById('menuApplicantsBtn').addEventListener('click', () => switchView('applicants'));
  document.getElementById('menuExpeditionBtn').addEventListener('click', () => switchView('expedition'));
  document.getElementById('menuBatchDispatchBtn').addEventListener('click', () => switchView('batch_dispatch'));
  document.getElementById('menuExpeditionPricingBtn').addEventListener('click', () => switchView('expedition_pricing'));

  document.getElementById('statusFilter').addEventListener('change', loadList);
  document.getElementById('searchInput').addEventListener('input', debounce(loadList, 400));
  document.getElementById('confirmRejectBtn').addEventListener('click', confirmReject);

  document.getElementById('frSaveCommissionBtn').addEventListener('click', saveFranchiseCommission);
  document.getElementById('frSetPendingBtn').addEventListener('click', () => updateFranchiseStatus('pending'));
  document.getElementById('frActivateBtn').addEventListener('click', () => updateFranchiseStatus('active'));
  document.getElementById('frDeactivateBtn').addEventListener('click', () => updateFranchiseStatus('inactive'));

  document.getElementById('saveJobBtn').addEventListener('click', saveJob);
  document.getElementById('resetJobBtn').addEventListener('click', resetJobForm);
  document.getElementById('refreshJobsBtn').addEventListener('click', loadJobs);
  document.getElementById('jobActiveFilter').addEventListener('change', loadJobs);

  document.getElementById('refreshApplicantsBtn').addEventListener('click', loadApplicants);
  document.getElementById('applicantJobFilter').addEventListener('change', loadApplicants);
  document.getElementById('applicantStatusFilter').addEventListener('change', loadApplicants);

  document.getElementById('expGetQuoteBtn').addEventListener('click', handleExpeditionQuote);
  document.getElementById('expeditionForm').addEventListener('submit', handleExpeditionCreate);
  document.getElementById('expRefreshBtn').addEventListener('click', loadExpeditionShipments);
  document.getElementById('expStatusFilter').addEventListener('change', loadExpeditionShipments);
  document.getElementById('expSearchInput').addEventListener('input', debounce(loadExpeditionShipments, 400));
  document.getElementById('expReloadPricingBtn').addEventListener('click', loadExpeditionPricingSetup);
  document.getElementById('expCheckWilayahSeedBtn').addEventListener('click', loadExpeditionWilayahSeedStatus);
  document.getElementById('expTriggerWilayahSeedBtn').addEventListener('click', triggerExpeditionWilayahSeed);
  document.getElementById('expServicePricingForm').addEventListener('submit', saveExpeditionServicePricing);
  document.getElementById('expMinChargeForm').addEventListener('submit', saveExpeditionMinimumCharge);
  document.getElementById('dispatchRefreshBtn').addEventListener('click', loadBatchDispatchPanel);
  document.getElementById('dispatchLoadPackagesBtn').addEventListener('click', loadBatchDispatchPackages);
  document.getElementById('dispatchReassignSelectedBtn').addEventListener('click', reassignSelectedPackages);
  document.getElementById('dispatchReassignKawasanBtn').addEventListener('click', reassignByKawasan);
  document.getElementById('dispatchSelectAll').addEventListener('change', toggleDispatchSelectAll);
  document.getElementById('dispatchSourceDriver').addEventListener('change', () => {
    fillDispatchKawasanOptions();
    loadBatchDispatchPackages();
  });

  // Semua field penerima diisi manual oleh admin
}

function switchView(view) {
  currentView = view;
  setSidebarButtons(view);
  setViewVisibility(view);

  if (view === 'dashboard') {
    document.getElementById('moduleTitle').textContent = 'Dashboard';
    loadDashboardStats();
    return;
  }

  if (view === 'jobs') {
    document.getElementById('moduleTitle').textContent = 'Data Lowongan';
    loadJobs();
    return;
  }

  if (view === 'applicants') {
    document.getElementById('moduleTitle').textContent = 'Daftar Pelamar';
    loadApplicants();
    return;
  }

  if (view === 'expedition') {
    document.getElementById('moduleTitle').textContent = 'Ekspedisi Pilot Tangerang';
    loadExpeditionOffice();
    loadExpeditionShipments();
    return;
  }

  if (view === 'batch_dispatch') {
    document.getElementById('moduleTitle').textContent = 'Dispatch Batch Delivery';
    loadBatchDispatchPanel();
    return;
  }

  if (view === 'expedition_pricing') {
    document.getElementById('moduleTitle').textContent = 'Setup Tarif Ekspedisi';
    loadExpeditionPricingSetup();
    return;
  }

  switchMode(view);
}

function setSidebarButtons(view) {
  const buttonMap = {
    dashboard: document.getElementById('menuDashboardBtn'),
    drivers: document.getElementById('moduleDriversBtn'),
    franchise: document.getElementById('moduleFranchiseBtn'),
    jobs: document.getElementById('menuJobsBtn'),
    applicants: document.getElementById('menuApplicantsBtn'),
    expedition: document.getElementById('menuExpeditionBtn'),
    batch_dispatch: document.getElementById('menuBatchDispatchBtn'),
    expedition_pricing: document.getElementById('menuExpeditionPricingBtn'),
  };

  Object.values(buttonMap).forEach((btn) => btn && btn.classList.remove('active'));
  if (buttonMap[view]) buttonMap[view].classList.add('active');
}

function setViewVisibility(view) {
  const stats = document.getElementById('statsContainer');
  const dashboardCharts = document.getElementById('dashboardChartsSection');
  const dashboardOps = document.getElementById('dashboardOpsSection');
  const dashboardTrends = document.getElementById('dashboardTrendsSection');
  const controls = document.getElementById('listControlsSection');
  const listContainer = document.getElementById('driversContainer');
  const jobsSection = document.getElementById('jobsSection');
  const applicantsSection = document.getElementById('applicantsSection');
  const expeditionSection = document.getElementById('expeditionSection');
  const batchDispatchSection = document.getElementById('batchDispatchSection');
  const expeditionPricingSection = document.getElementById('expeditionPricingSection');

  // Hide all first
  [stats, dashboardCharts, dashboardOps, dashboardTrends, controls, listContainer, jobsSection, applicantsSection, expeditionSection, batchDispatchSection, expeditionPricingSection].forEach(
    (el) => el.classList.add('section-hidden')
  );

  if (view === 'dashboard') {
    stats.classList.remove('section-hidden');
    dashboardCharts.classList.remove('section-hidden');
    dashboardOps.classList.remove('section-hidden');
    dashboardTrends.classList.remove('section-hidden');
  } else if (view === 'jobs') {
    jobsSection.classList.remove('section-hidden');
  } else if (view === 'applicants') {
    applicantsSection.classList.remove('section-hidden');
  } else if (view === 'expedition') {
    expeditionSection.classList.remove('section-hidden');
  } else if (view === 'batch_dispatch') {
    batchDispatchSection.classList.remove('section-hidden');
  } else if (view === 'expedition_pricing') {
    expeditionPricingSection.classList.remove('section-hidden');
  } else {
    stats.classList.remove('section-hidden');
    controls.classList.remove('section-hidden');
    listContainer.classList.remove('section-hidden');
  }
}

function switchMode(mode) {
  currentMode = mode;
  setModuleButtons(mode);
  setupFilterForMode(mode);
  loadStats();
  loadList();
}

function setModuleButtons(mode) {
  const btnDrivers = document.getElementById('moduleDriversBtn');
  const btnFranchise = document.getElementById('moduleFranchiseBtn');
  const moduleTitle = document.getElementById('moduleTitle');

  if (mode === 'drivers') {
    moduleTitle.textContent = 'Approval Driver';
  } else {
    moduleTitle.textContent = 'Approval Franchise';
  }
}

async function loadDashboardStats() {
  try {
    const [driverRes, franchiseRes, heartbeatRes, bookingsTodayRes, customerGrowthRes, transactionsTrendRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/admin/drivers-stats`),
      fetch(`${API_BASE_URL}/api/admin/franchise/stats`),
      fetch(`${API_BASE_URL}/api/driver-location/status-all?timeout_minutes=15`),
      fetch(`${API_BASE_URL}/api/admin/dashboard/bookings-today`),
      fetch(`${API_BASE_URL}/api/admin/dashboard/customer-growth`),
      fetch(`${API_BASE_URL}/api/admin/dashboard/transactions-trend`),
    ]);

    const driverData = await driverRes.json();
    const franchiseData = await franchiseRes.json();
    const heartbeatData = await heartbeatRes.json();
    const bookingsTodayData = await bookingsTodayRes.json();
    const customerGrowthData = await customerGrowthRes.json();
    const transactionsTrendData = await transactionsTrendRes.json();

    const ds = driverData.stats || {};
    const fs = franchiseData.stats || {};
    const heartbeatSummary = heartbeatData.success ? heartbeatData : {
      total_drivers: 0,
      online_count: 0,
      offline_count: 0,
      drivers: [],
    };
    const bookingsToday = bookingsTodayData.success ? bookingsTodayData : {
      summary: { total_bookings: 0, total_amount: 0, first_booking_at: null, last_booking_at: null },
      by_status: [],
    };

    document.getElementById('statsContainer').innerHTML = `
      <div class="col-md-6 col-lg-3">
        <div class="card small-stat blue">
          <div class="card-body">
            <h3>${ds.total || 0}</h3>
            <div class="stat-label">Total Drivers</div>
            <div class="stat-icon"><i class="fas fa-user-plus"></i></div>
            <div class="stat-link">Overview</div>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="card small-stat green">
          <div class="card-body">
            <h3>${ds.approved || 0}</h3>
            <div class="stat-label">Driver Approved</div>
            <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
            <div class="stat-link">Performance</div>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="card small-stat yellow">
          <div class="card-body">
            <h3>${ds.pending || 0}</h3>
            <div class="stat-label">Driver Pending</div>
            <div class="stat-icon"><i class="fas fa-user-clock"></i></div>
            <div class="stat-link">Need Action</div>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="card small-stat red">
          <div class="card-body">
            <h3>${fs.active || 0}</h3>
            <div class="stat-label">Franchise Active</div>
            <div class="stat-icon"><i class="fas fa-store"></i></div>
            <div class="stat-link">Franchise</div>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="card small-stat blue">
          <div class="card-body">
            <h3>${bookingsToday.summary?.total_bookings || 0}</h3>
            <div class="stat-label">Booking Hari Ini</div>
            <div class="stat-icon"><i class="fas fa-receipt"></i></div>
            <div class="stat-link">All Status</div>
          </div>
        </div>
      </div>
    `;

    renderDashboardCharts(ds, fs);
    renderHeartbeatDashboard(heartbeatSummary);
    renderTodayBookingDashboard(bookingsToday);
    renderCustomerGrowthChart(customerGrowthData.success ? customerGrowthData.data : []);
    renderTransactionsTrendChart(transactionsTrendData.success ? transactionsTrendData.data : []);
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    showError('Failed to load dashboard');
  }
}

function renderHeartbeatDashboard(data) {
  const summaryEl = document.getElementById('heartbeatSummaryCards');
  const bodyEl = document.getElementById('heartbeatDriversTableBody');
  const updatedAtEl = document.getElementById('heartbeatUpdatedAtLabel');

  if (!summaryEl || !bodyEl || !updatedAtEl) return;

  const drivers = Array.isArray(data.drivers) ? data.drivers : [];
  const heartbeatActive = drivers.filter((d) => d.online === true && d.last_heartbeat).length;
  const updatedAt = new Date().toLocaleString('id-ID');
  updatedAtEl.textContent = `Update: ${updatedAt}`;

  summaryEl.innerHTML = `
    <div class="col-4">
      <div class="border rounded p-2 bg-white h-100">
        <div class="small text-muted">Total Driver</div>
        <div class="fw-bold fs-5">${Number(data.total_drivers || 0).toLocaleString('id-ID')}</div>
      </div>
    </div>
    <div class="col-4">
      <div class="border rounded p-2 bg-white h-100">
        <div class="small text-muted">Online</div>
        <div class="fw-bold fs-5 text-success">${Number(data.online_count || 0).toLocaleString('id-ID')}</div>
      </div>
    </div>
    <div class="col-4">
      <div class="border rounded p-2 bg-white h-100">
        <div class="small text-muted">Heartbeat Aktif</div>
        <div class="fw-bold fs-5 text-primary">${Number(heartbeatActive || 0).toLocaleString('id-ID')}</div>
      </div>
    </div>
  `;

  if (!drivers.length) {
    bodyEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Data heartbeat belum tersedia</td></tr>';
    return;
  }

  bodyEl.innerHTML = drivers
    .slice(0, 120)
    .map((driver) => {
      const onlineBadge = driver.online
        ? '<span class="badge bg-success-subtle text-success">Online</span>'
        : '<span class="badge bg-danger-subtle text-danger">Offline</span>';
      const driverStatus = driver.status || '-';
      const lastHb = driver.last_heartbeat
        ? new Date(driver.last_heartbeat).toLocaleString('id-ID')
        : 'never';
      const minutes = driver.minutes_since_update ?? 'never';
      return `
        <tr>
          <td>${driver.driver_id || '-'}</td>
          <td>${driver.name || '-'}</td>
          <td>${String(driverStatus).toUpperCase()}</td>
          <td>${onlineBadge}</td>
          <td>${lastHb}</td>
          <td>${minutes}</td>
        </tr>
      `;
    })
    .join('');
}

function renderTodayBookingDashboard(data) {
  const summaryEl = document.getElementById('todayBookingSummaryCards');
  const bodyEl = document.getElementById('todayBookingStatusBody');

  if (!summaryEl || !bodyEl) return;

  const summary = data.summary || {};
  const byStatus = Array.isArray(data.by_status) ? data.by_status : [];

  summaryEl.innerHTML = `
    <div class="col-6">
      <div class="border rounded p-2 bg-white h-100">
        <div class="small text-muted">Total Booking</div>
        <div class="fw-bold fs-5">${Number(summary.total_bookings || 0).toLocaleString('id-ID')}</div>
      </div>
    </div>
    <div class="col-6">
      <div class="border rounded p-2 bg-white h-100">
        <div class="small text-muted">Total Nominal</div>
        <div class="fw-bold fs-6">Rp ${Number(summary.total_amount || 0).toLocaleString('id-ID')}</div>
      </div>
    </div>
  `;

  if (!byStatus.length) {
    bodyEl.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Belum ada pemesanan hari ini</td></tr>';
    return;
  }

  bodyEl.innerHTML = byStatus
    .map((item) => `
      <tr>
        <td>${String(item.booking_status || 'unknown').toUpperCase()}</td>
        <td class="text-end fw-semibold">${Number(item.total || 0).toLocaleString('id-ID')}</td>
      </tr>
    `)
    .join('');
}

function renderCustomerGrowthChart(rawData) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('customerGrowthChart');
  if (!canvas) return;

  const labels = buildLast30DaysLabels();
  const dataMap = {};
  rawData.forEach((row) => { dataMap[row.date] = Number(row.total || 0); });
  const values = labels.map((d) => dataMap[d] || 0);

  if (customerGrowthChartInstance) customerGrowthChartInstance.destroy();
  customerGrowthChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels.map((d) => formatDateLabel(d)),
      datasets: [{
        label: 'Customer Baru',
        data: values,
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14,165,233,0.12)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf2f7' } },
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
      },
    },
  });
}

function renderTransactionsTrendChart(rawData) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('transactionsTrendChart');
  if (!canvas) return;

  const labels = buildLast30DaysLabels();
  const countMap = {};
  rawData.forEach((row) => { countMap[row.date] = Number(row.total_bookings || 0); });
  const values = labels.map((d) => countMap[d] || 0);

  if (transactionsTrendChartInstance) transactionsTrendChartInstance.destroy();
  transactionsTrendChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels.map((d) => formatDateLabel(d)),
      datasets: [{
        label: 'Jumlah Transaksi',
        data: values,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.12)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf2f7' } },
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
      },
    },
  });
}

function buildLast30DaysLabels() {
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function renderDashboardCharts(driverStats, franchiseStats) {
  if (typeof Chart === 'undefined') return;

  const driverCanvas = document.getElementById('driverStatusChart');
  const franchiseCanvas = document.getElementById('franchiseStatusChart');
  if (!driverCanvas || !franchiseCanvas) return;

  const driverData = [
    Number(driverStats.pending || 0),
    Number(driverStats.approved || 0),
    Number(driverStats.rejected || 0),
  ];

  const franchiseData = [
    Number(franchiseStats.pending || 0),
    Number(franchiseStats.active || 0),
    Number(franchiseStats.inactive || 0),
  ];

  if (driverStatusChartInstance) driverStatusChartInstance.destroy();
  if (franchiseStatusChartInstance) franchiseStatusChartInstance.destroy();

  driverStatusChartInstance = new Chart(driverCanvas, {
    type: 'bar',
    data: {
      labels: ['Pending', 'Approved', 'Rejected'],
      datasets: [{
        label: 'Driver',
        data: driverData,
        backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: '#edf2f7' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });

  franchiseStatusChartInstance = new Chart(franchiseCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Active', 'Inactive'],
      datasets: [{
        data: franchiseData,
        backgroundColor: ['#f59e0b', '#0ea5e9', '#ef4444'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
      },
    },
  });
}

function setupFilterForMode(mode) {
  const filter = document.getElementById('statusFilter');
  const search = document.getElementById('searchInput');

  if (mode === 'drivers') {
    filter.innerHTML = `
      <option value="pending">Pending Only</option>
      <option value="all">All Drivers</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
    `;
    search.placeholder = 'Search by name, phone, email, or NIK...';
  } else {
    filter.innerHTML = `
      <option value="pending">Pending Only</option>
      <option value="all">All Franchise</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    `;
    search.placeholder = 'Search by business name, owner, phone, email, or city...';
  }

  search.value = '';
}

async function loadStats() {
  try {
    if (currentMode === 'drivers') {
      const res = await fetch(`${API_BASE_URL}/api/admin/drivers-stats`);
      const data = await res.json();
      if (data.success) renderDriverStats(data.stats || {});
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/admin/franchise/stats`);
    const data = await res.json();
    if (data.success) renderFranchiseStats(data.stats || {});
  } catch (error) {
    console.error('Error loading stats:', error);
    showError('Failed to load statistics');
  }
}

function renderDriverStats(stats) {
  document.getElementById('statsContainer').innerHTML = `
    <div class="col-md-6 col-lg">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Total Drivers</h6><h2 class="mb-0">${stats.total || 0}</h2></div>
        <div class="stats-icon bg-primary bg-opacity-10 text-primary"><i class="fas fa-users"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Pending</h6><h2 class="mb-0 text-warning">${stats.pending || 0}</h2></div>
        <div class="stats-icon bg-warning bg-opacity-10 text-warning"><i class="fas fa-clock"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Approved</h6><h2 class="mb-0 text-success">${stats.approved || 0}</h2></div>
        <div class="stats-icon bg-success bg-opacity-10 text-success"><i class="fas fa-check-circle"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Rejected</h6><h2 class="mb-0 text-danger">${stats.rejected || 0}</h2></div>
        <div class="stats-icon bg-danger bg-opacity-10 text-danger"><i class="fas fa-times-circle"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Total Customers</h6><h2 class="mb-0 text-info">${stats.total_customers || 0}</h2></div>
        <div class="stats-icon bg-info bg-opacity-10 text-info"><i class="fas fa-user-friends"></i></div>
      </div></div></div>
    </div>
  `;
}

function renderFranchiseStats(stats) {
  document.getElementById('statsContainer').innerHTML = `
    <div class="col-md-6 col-lg-3">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Total Franchise</h6><h2 class="mb-0">${stats.total || 0}</h2></div>
        <div class="stats-icon bg-primary bg-opacity-10 text-primary"><i class="fas fa-store"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg-3">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Pending</h6><h2 class="mb-0 text-warning">${stats.pending || 0}</h2></div>
        <div class="stats-icon bg-warning bg-opacity-10 text-warning"><i class="fas fa-clock"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg-3">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Active</h6><h2 class="mb-0 text-success">${stats.active || 0}</h2></div>
        <div class="stats-icon bg-success bg-opacity-10 text-success"><i class="fas fa-check-circle"></i></div>
      </div></div></div>
    </div>
    <div class="col-md-6 col-lg-3">
      <div class="card stats-card"><div class="card-body"><div class="d-flex justify-content-between align-items-center">
        <div><h6 class="text-muted mb-1">Inactive</h6><h2 class="mb-0 text-danger">${stats.inactive || 0}</h2></div>
        <div class="stats-icon bg-danger bg-opacity-10 text-danger"><i class="fas fa-ban"></i></div>
      </div></div></div>
    </div>
  `;
}

async function loadList() {
  if (currentView !== 'drivers' && currentView !== 'franchise') return;

  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value.trim();

  showLoading();

  try {
    if (currentMode === 'drivers') {
      let url = `${API_BASE_URL}/api/admin/drivers?status=${encodeURIComponent(status)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      const data = await res.json();
      const list = data.drivers || data.data || [];
      renderDrivers(list);
      return;
    }

    let url = `${API_BASE_URL}/api/admin/franchise/list?status=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    const data = await res.json();
    renderFranchise(data.data || []);
  } catch (error) {
    console.error('Error loading list:', error);
    showError('Failed to load list');
  }
}

async function loadJobs() {
  const tbody = document.getElementById('jobsTableBody');
  const activeFilter = document.getElementById('jobActiveFilter').value;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading jobs...</td></tr>';

  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/admin/jobs?active=${encodeURIComponent(activeFilter)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load jobs');

    jobsCache = data.data || [];
    renderJobs(jobsCache);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">${error.message}</td></tr>`;
  }
}

function renderJobs(items) {
  const tbody = document.getElementById('jobsTableBody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Belum ada lowongan</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((job) => {
    const inactiveClass = job.is_active ? '' : 'job-row-inactive';
    return `
      <tr class="${inactiveClass}">
        <td>${job.id}</td>
        <td>
          <div class="fw-semibold">${job.title || '-'}</div>
          <small class="text-muted">${(job.description || '-').slice(0, 90)}</small>
        </td>
        <td>${job.duration || '-'}</td>
        <td>${job.location || '-'}</td>
        <td>${job.is_active ? '<span class="badge bg-success-subtle text-success">Active</span>' : '<span class="badge bg-secondary-subtle text-secondary">Inactive</span>'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editJob(${job.id})">Edit</button>
          ${job.is_active
            ? `<button class="btn btn-sm btn-outline-danger" onclick="deactivateJob(${job.id})">Nonaktifkan</button>`
            : `<button class="btn btn-sm btn-outline-success" onclick="activateJob(${job.id})">Aktifkan</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

function resetJobForm() {
  document.getElementById('jobIdInput').value = '';
  document.getElementById('jobTitleInput').value = '';
  document.getElementById('jobDescriptionInput').value = '';
  document.getElementById('jobQualificationsInput').value = '';
  document.getElementById('jobDurationInput').value = '';
  document.getElementById('jobLocationInput').value = '';
}

function editJob(jobId) {
  const job = jobsCache.find((x) => x.id === jobId);
  if (!job) return;
  document.getElementById('jobIdInput').value = job.id;
  document.getElementById('jobTitleInput').value = job.title || '';
  document.getElementById('jobDescriptionInput').value = job.description || '';
  document.getElementById('jobQualificationsInput').value = job.qualifications || '';
  document.getElementById('jobDurationInput').value = job.duration || '';
  document.getElementById('jobLocationInput').value = job.location || '';
}

async function saveJob() {
  const id = document.getElementById('jobIdInput').value;
  const payload = {
    title: document.getElementById('jobTitleInput').value.trim(),
    description: document.getElementById('jobDescriptionInput').value.trim(),
    qualifications: document.getElementById('jobQualificationsInput').value.trim(),
    duration: document.getElementById('jobDurationInput').value.trim(),
    location: document.getElementById('jobLocationInput').value.trim(),
  };

  if (!payload.title) {
    showError('Judul lowongan wajib diisi');
    return;
  }

  try {
    const url = id ? `${API_BASE_URL}/api/jobs/admin/${id}` : `${API_BASE_URL}/api/jobs/admin/create`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to save job');

    showSuccess(id ? 'Lowongan berhasil diupdate' : 'Lowongan berhasil ditambahkan');
    resetJobForm();
    loadJobs();
  } catch (error) {
    showError(error.message);
  }
}

async function deactivateJob(jobId) {
  if (!confirm('Nonaktifkan lowongan ini?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/admin/${jobId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to deactivate job');
    showSuccess('Lowongan dinonaktifkan');
    loadJobs();
  } catch (error) {
    showError(error.message);
  }
}

async function activateJob(jobId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/admin/${jobId}/activate`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to activate job');
    showSuccess('Lowongan diaktifkan');
    loadJobs();
  } catch (error) {
    showError(error.message);
  }
}

function renderDrivers(drivers) {
  const container = document.getElementById('driversContainer');

  if (!drivers.length) {
    container.innerHTML = emptyState('No drivers found');
    return;
  }

  container.innerHTML = drivers.map((driver) => `
    <div class="card driver-card mb-3">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col-md-8">
            <div class="d-flex align-items-start">
              <img src="${driver.ktp_photo_url || 'https://via.placeholder.com/80'}"
                   class="driver-photo me-3 clickable-photo"
                   data-photo-url="${driver.ktp_photo_url || ''}"
                   data-photo-title="KTP Photo"
                   alt="KTP">
              <div class="flex-grow-1">
                <h5 class="mb-1">${driver.full_name || '-'}</h5>
                <div class="text-muted small mb-2">
                  <i class="fas fa-phone me-2"></i>${driver.phone || '-'} |
                  <i class="fas fa-envelope me-2 ms-3"></i>${driver.email || 'N/A'}
                </div>
                <div class="mb-2">
                  <span class="badge bg-light text-dark me-2">
                    <i class="fas fa-car me-1"></i>${translateVehicleType(driver.vehicle_type)}
                  </span>
                  <span class="badge ${getStatusBadgeClass(driver.status)}">${(driver.status || 'pending').toUpperCase()}</span>
                </div>
                <div class="text-muted small">
                  <i class="fas fa-clock me-1"></i>Registered: ${formatDate(driver.created_at)}
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4 text-end">${renderDriverActions(driver)}</div>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.clickable-photo').forEach((img) => {
    img.addEventListener('click', function onClickPhoto() {
      if (!this.getAttribute('data-photo-url')) return;
      showPhoto(this.getAttribute('data-photo-url'), this.getAttribute('data-photo-title'));
    });
  });
}

function renderDriverActions(driver) {
  const detailButton = `
    <button class="btn btn-info btn-sm mb-2 w-100" onclick="showDriverDetail(${driver.id})">
      <i class="fas fa-eye me-1"></i>View Detail
    </button>
  `;

  if (driver.status === 'pending') {
    return `
      ${detailButton}
      <button class="btn btn-approve btn-sm mb-2 w-100" onclick="approveDriver(event, ${driver.id}, '${escapeQuotes(driver.full_name || '')}')">
        <i class="fas fa-check-circle me-1"></i>Approve
      </button>
      <button class="btn btn-reject btn-sm w-100" onclick="showRejectModal(${driver.id}, '${escapeQuotes(driver.full_name || '')}', 'driver')">
        <i class="fas fa-times-circle me-1"></i>Reject
      </button>
    `;
  }

  return detailButton;
}

function renderFranchise(items) {
  const container = document.getElementById('driversContainer');

  if (!items.length) {
    container.innerHTML = emptyState('No franchise partners found');
    return;
  }

  container.innerHTML = items.map((fr) => `
    <div class="card driver-card mb-3">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col-md-8">
            <h5 class="mb-1">${fr.name || '-'}</h5>
            <div class="text-muted small mb-2">
              <i class="fas fa-user me-1"></i>${fr.owner_name || '-'}
              <span class="ms-3"><i class="fas fa-phone me-1"></i>${fr.phone || '-'}</span>
            </div>
            <div class="text-muted small mb-2">
              <i class="fas fa-location-dot me-1"></i>${fr.city || '-'} | Coverage: ${fr.coverage_count || 0} area
            </div>
            <div class="mb-2">
              <span class="badge bg-light text-dark me-2">Commission: ${Number(fr.commission_rate || 0).toFixed(2)}%</span>
              <span class="badge ${getStatusBadgeClass(fr.status)}">${(fr.status || 'pending').toUpperCase()}</span>
            </div>
            <div class="text-muted small">
              <i class="fas fa-clock me-1"></i>Registered: ${formatDate(fr.created_at)}
            </div>
          </div>
          <div class="col-md-4 text-end">
            <button class="btn btn-info btn-sm mb-2 w-100" onclick="showFranchiseDetail(${fr.id})">
              <i class="fas fa-eye me-1"></i>View Detail
            </button>
            <button class="btn btn-success btn-sm mb-2 w-100" onclick="quickFranchiseStatus(${fr.id}, 'active')">
              <i class="fas fa-check me-1"></i>Set Active
            </button>
            <button class="btn btn-reject btn-sm w-100" onclick="showRejectModal(${fr.id}, '${escapeQuotes(fr.name || '')}', 'franchise')">
              <i class="fas fa-ban me-1"></i>Set Inactive
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function emptyState(text) {
  return `
    <div class="card">
      <div class="card-body text-center py-5">
        <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
        <p class="text-muted">${text}</p>
      </div>
    </div>
  `;
}

async function approveDriver(event, driverId, driverName) {
  if (!confirm(`Approve driver registration for ${driverName}?`)) return;

  const button = event.target.closest('button');
  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="loading"></span> Approving...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: 'Approved via admin panel' })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to approve driver');

    showSuccess(`Driver ${driverName} approved`);
    loadStats();
    loadList();
  } catch (error) {
    showError(error.message);
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}

function showRejectModal(entityId, entityName, type) {
  currentReject = { id: entityId, type };

  const title = document.querySelector('#rejectModal .modal-title');
  const label = document.querySelector('#rejectModal .form-label');
  const nameEl = document.getElementById('rejectDriverName');

  if (type === 'franchise') {
    title.textContent = 'Set Franchise Inactive';
    label.textContent = 'Reason / Notes';
    nameEl.textContent = entityName;
  } else {
    title.textContent = 'Reject Driver Registration';
    label.textContent = 'Rejection Reason *';
    nameEl.textContent = entityName;
  }

  document.getElementById('rejectionReason').value = '';
  new bootstrap.Modal(document.getElementById('rejectModal')).show();
}

async function confirmReject() {
  const reason = document.getElementById('rejectionReason').value.trim();
  const button = document.getElementById('confirmRejectBtn');

  if (currentReject.type === 'driver' && !reason) {
    alert('Please provide a rejection reason');
    return;
  }

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="loading"></span> Processing...';

  try {
    if (currentReject.type === 'driver') {
      const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${currentReject.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to reject driver');
      showSuccess('Driver rejected');
    } else {
      const res = await fetch(`${API_BASE_URL}/api/admin/franchise/${currentReject.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive', notes: reason || null })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update franchise status');
      showSuccess('Franchise set to inactive');
    }

    bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
    loadStats();
    loadList();
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function showDriverDetail(driverId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}`);
    const data = await response.json();

    if (!data.success) throw new Error('Failed to load driver details');
    const driver = data.driver;

    document.getElementById('detail_full_name').textContent = driver.full_name || '-';
    document.getElementById('detail_phone').textContent = driver.phone || '-';
    document.getElementById('detail_email').textContent = driver.email || '-';
    document.getElementById('detail_nik').textContent = driver.nik || '-';
    document.getElementById('detail_dob').textContent = formatDate(driver.date_of_birth) || '-';
    document.getElementById('detail_pob').textContent = driver.place_of_birth || '-';
    document.getElementById('detail_gender').textContent = driver.gender === 'L' ? 'Laki-laki' : driver.gender === 'P' ? 'Perempuan' : '-';
    document.getElementById('detail_religion').textContent = driver.religion || '-';
    document.getElementById('detail_address').textContent = driver.address_full || '-';

    document.getElementById('detail_vehicle_type').textContent = translateVehicleType(driver.vehicle_type) || '-';
    document.getElementById('detail_vehicle_plate').textContent = driver.vehicle_plate || '-';
    document.getElementById('detail_vehicle_color').textContent = driver.vehicle_color || '-';
    document.getElementById('detail_vehicle_year').textContent = driver.vehicle_year || '-';
    document.getElementById('detail_license_number').textContent = driver.license_number || '-';
    document.getElementById('detail_service_type').textContent = translateServiceType(driver.service_type_allowed) || '-';

    setDetailPhoto('detail_ktp', driver.ktp_photo_url);
    setDetailPhoto('detail_selfie', driver.selfie_photo_url);
    setDetailPhoto('detail_license', driver.license_photo_url);
    setDetailPhoto('detail_stnk', driver.stnk_photo_url);

    document.getElementById('detailApproveBtn').onclick = () => {
      bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
      approveDriver({ target: document.getElementById('detailApproveBtn') }, driver.id, driver.full_name);
    };

    document.getElementById('detailRejectBtn').onclick = () => {
      bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
      showRejectModal(driver.id, driver.full_name, 'driver');
    };

    document.getElementById('detailEditVehicleBtn').onclick = () => {
      bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
      showEditVehicleModal(driver);
    };

    new bootstrap.Modal(document.getElementById('detailModal')).show();
  } catch (error) {
    console.error(error);
    showError('Failed to load driver details');
  }
}

function setDetailPhoto(id, url) {
  const img = document.getElementById(id);
  const fallback = img.nextElementSibling;

  if (url) {
    img.style.display = 'block';
    fallback.style.display = 'none';
    img.src = url;
  } else {
    img.style.display = 'none';
    fallback.style.display = 'block';
  }
}

async function showFranchiseDetail(franchiseId) {
  try {
    currentFranchiseId = franchiseId;
    const res = await fetch(`${API_BASE_URL}/api/admin/franchise/${franchiseId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load franchise detail');

    const fr = data.data;
    document.getElementById('fr_detail_name').textContent = fr.name || '-';
    document.getElementById('fr_detail_owner').textContent = fr.owner_name || '-';
    document.getElementById('fr_detail_phone').textContent = fr.phone || '-';
    document.getElementById('fr_detail_email').textContent = fr.email || '-';
    document.getElementById('fr_detail_city').textContent = fr.city || '-';
    document.getElementById('fr_detail_address').textContent = fr.address || '-';
    document.getElementById('fr_detail_status').textContent = (fr.status || 'pending').toUpperCase();
    document.getElementById('fr_detail_notes').textContent = fr.notes || '-';
    document.getElementById('fr_detail_commission_input').value = Number(fr.commission_rate || 0).toFixed(2);

    const coverageList = document.getElementById('fr_detail_coverage_list');
    const coverage = fr.coverage_areas || [];
    if (!coverage.length) {
      coverageList.innerHTML = '<li class="list-group-item text-muted">No area configured</li>';
    } else {
      coverageList.innerHTML = coverage
        .map((x) => `<li class="list-group-item d-flex justify-content-between"><span>${x.kabupaten_name}</span><span class="badge ${x.is_active ? 'bg-success' : 'bg-secondary'}">${x.is_active ? 'Active' : 'Inactive'}</span></li>`)
        .join('');
    }

    new bootstrap.Modal(document.getElementById('franchiseDetailModal')).show();
  } catch (error) {
    console.error(error);
    showError(error.message || 'Failed to load franchise detail');
  }
}

async function quickFranchiseStatus(franchiseId, status) {
  if (!confirm(`Set franchise status to ${status}?`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/franchise/${franchiseId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to update franchise status');

    showSuccess(`Franchise status updated to ${status}`);
    loadStats();
    loadList();
  } catch (error) {
    showError(error.message);
  }
}

async function updateFranchiseStatus(status) {
  if (!currentFranchiseId) return;
  const notes = prompt('Optional notes (can be empty):', '') || '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/franchise/${currentFranchiseId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes: notes || null })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to update franchise status');

    showSuccess(`Franchise status updated to ${status}`);
    showFranchiseDetail(currentFranchiseId);
    loadStats();
    loadList();
  } catch (error) {
    showError(error.message);
  }
}

async function saveFranchiseCommission() {
  if (!currentFranchiseId) return;

  const commission = parseFloat(document.getElementById('fr_detail_commission_input').value);
  if (Number.isNaN(commission) || commission < 0 || commission > 100) {
    showError('Commission must be between 0 and 100');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/franchise/${currentFranchiseId}/commission`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commission_rate: commission })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to update commission');

    showSuccess('Commission updated');
    loadList();
    showFranchiseDetail(currentFranchiseId);
  } catch (error) {
    showError(error.message);
  }
}

function showPhoto(url, title) {
  document.getElementById('photoModalTitle').textContent = title;
  document.getElementById('modalPhoto').src = url;
  new bootstrap.Modal(document.getElementById('photoModal')).show();
}

function showLoading() {
  const label = currentMode === 'drivers' ? 'Loading drivers...' : 'Loading franchise...';
  document.getElementById('driversContainer').innerHTML = `
    <div class="card">
      <div class="card-body text-center py-5">
        <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
        <p class="text-muted mt-3">${label}</p>
      </div>
    </div>
  `;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending': return 'badge-pending';
    case 'approved':
    case 'active': return 'badge-approved';
    case 'rejected':
    case 'inactive':
    case 'offline': return 'badge-rejected';
    default: return 'bg-secondary';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function translateVehicleType(type) {
  const map = {
    bike: 'Sepeda',
    motorcycle: 'Motor',
    car: 'Mobil',
    truck: 'Truk',
    wheels: 'Roda',
    skateboard: 'Skateboard'
  };
  return map[type] || type || '-';
}

function translateServiceType(type) {
  const map = { ride: 'Antar Jemput', delivery: 'Pengiriman', both: 'Keduanya' };
  return map[type] || type || '-';
}

function showSuccess(message) {
  alert(message);
}

function showError(message) {
  alert(`Error: ${message}`);
}

function debounce(func, wait) {
  let timeout;
  return function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function escapeQuotes(value) {
  return String(value).replace(/'/g, "\\'");
}

function showEditVehicleModal(driver) {
  const isMotor = driver.vehicle_type !== 'bike' && driver.vehicle_type !== 'skateboard' && driver.vehicle_type !== 'wheels';
  document.getElementById('ev_driver_id').value = driver.id;
  document.getElementById('ev_vehicle_type').value = driver.vehicle_type || 'bike';
  document.getElementById('ev_vehicle_plate').value = driver.vehicle_plate || '';
  document.getElementById('ev_license_number').value = driver.license_number || '';
  document.getElementById('ev_stnk_number').value = driver.stnk_number || '';
  document.getElementById('ev_vehicle_color').value = driver.vehicle_color || '';
  document.getElementById('ev_vehicle_year').value = driver.vehicle_year || '';
  document.getElementById('ev_motor_fields').style.display = isMotor ? '' : 'none';

  document.getElementById('ev_vehicle_type').onchange = function () {
    const isMV = this.value !== 'bike' && this.value !== 'skateboard' && this.value !== 'wheels';
    document.getElementById('ev_motor_fields').style.display = isMV ? '' : 'none';
  };

  new bootstrap.Modal(document.getElementById('editVehicleModal')).show();
}

async function saveVehicleEdit() {
  const driverId = document.getElementById('ev_driver_id').value;
  const vehicleType = document.getElementById('ev_vehicle_type').value;
  const isMotor = vehicleType !== 'bike' && vehicleType !== 'skateboard' && vehicleType !== 'wheels';

  const payload = {
    vehicleType,
    vehiclePlate: isMotor ? document.getElementById('ev_vehicle_plate').value.trim() : null,
    licenseNumber: isMotor ? document.getElementById('ev_license_number').value.trim() : null,
    stnkNumber: isMotor ? document.getElementById('ev_stnk_number').value.trim() : null,
    vehicleColor: document.getElementById('ev_vehicle_color').value.trim() || null,
    vehicleYear: document.getElementById('ev_vehicle_year').value || null,
  };

  if (isMotor && (!payload.vehiclePlate || !payload.licenseNumber)) {
    alert('Plat nomor dan no. SIM wajib diisi untuk kendaraan bermotor.');
    return;
  }

  const btn = document.getElementById('ev_save_btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/vehicle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal menyimpan');

    bootstrap.Modal.getInstance(document.getElementById('editVehicleModal')).hide();
    alert('Data kendaraan berhasil diupdate!');
    loadList();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-2"></i>Simpan';
  }
}

// =============================================
// DAFTAR PELAMAR
// =============================================

async function loadApplicants() {
  const tbody = document.getElementById('applicantsTableBody');
  const jobFilter = document.getElementById('applicantJobFilter').value;
  const statusFilter = document.getElementById('applicantStatusFilter').value;
  tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>';

  try {
    let url = `${API_BASE_URL}/api/jobs/admin/applications?`;
    if (jobFilter) url += `job_id=${encodeURIComponent(jobFilter)}&`;
    if (statusFilter && statusFilter !== 'all') url += `status=${encodeURIComponent(statusFilter)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load applicants');

    applicantsCache = data.data || [];
    populateApplicantJobFilter(applicantsCache);
    renderApplicants(applicantsCache);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">${error.message}</td></tr>`;
  }
}

function populateApplicantJobFilter(applicants) {
  const select = document.getElementById('applicantJobFilter');
  const currentVal = select.value;
  const jobMap = {};
  applicants.forEach((a) => { jobMap[a.job_id] = a.job_title; });
  const options = ['<option value="">Semua Posisi</option>'];
  Object.entries(jobMap).forEach(([id, title]) => {
    options.push(`<option value="${id}" ${String(currentVal) === String(id) ? 'selected' : ''}>${title}</option>`);
  });
  select.innerHTML = options.join('');
}

function renderApplicants(items) {
  const tbody = document.getElementById('applicantsTableBody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4"><i class="fas fa-inbox me-2"></i>Belum ada pelamar</td></tr>';
    return;
  }

  const statusLabel = { pending: 'Baru', reviewed: 'Diproses', accepted: 'Diterima', rejected: 'Ditolak' };
  const statusClass = {
    pending: 'bg-warning text-dark',
    reviewed: 'bg-info text-white',
    accepted: 'bg-success text-white',
    rejected: 'bg-danger text-white',
  };

  tbody.innerHTML = items.map((a) => `
    <tr>
      <td>${a.id}</td>
      <td class="fw-semibold">${a.full_name || '-'}</td>
      <td><small>${a.job_title || '-'}</small></td>
      <td><small>${a.email || '-'}</small></td>
      <td><small>${a.phone || '-'}</small></td>
      <td><span class="badge ${statusClass[a.status] || 'bg-secondary'}">${statusLabel[a.status] || a.status}</span></td>
      <td><small>${formatDate(a.applied_at)}</small></td>
      <td>
        <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="showApplicantDetail(${a.id})">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function showApplicantDetail(applicantId) {
  const a = applicantsCache.find((x) => x.id === applicantId);
  if (!a) return;

  currentApplicantId = applicantId;

  const genderMap = { male: 'Laki-laki', female: 'Perempuan', other: 'Lainnya' };
  const statusLabel = { pending: 'Baru', reviewed: 'Diproses', accepted: 'Diterima', rejected: 'Ditolak' };
  const statusClass = {
    pending: 'bg-warning text-dark',
    reviewed: 'bg-info text-white',
    accepted: 'bg-success text-white',
    rejected: 'bg-danger text-white',
  };

  document.getElementById('apd_full_name').textContent = a.full_name || '-';
  document.getElementById('apd_email').textContent = a.email || '-';
  document.getElementById('apd_phone').textContent = a.phone || '-';
  document.getElementById('apd_gender').textContent = genderMap[a.gender] || a.gender || '-';
  document.getElementById('apd_edu_level').textContent = a.education_level || '-';
  document.getElementById('apd_edu_inst').textContent = a.education_institution || '-';
  document.getElementById('apd_edu_major').textContent = a.education_major || '-';
  document.getElementById('apd_edu_year').textContent = a.education_year || '-';
  document.getElementById('apd_edu_gpa').textContent = a.education_gpa || '-';
  document.getElementById('apd_experience').textContent = a.work_experience || 'Tidak ada pengalaman yang dicantumkan.';
  document.getElementById('apd_job_title').textContent = a.job_title || '-';
  document.getElementById('apd_status_badge').innerHTML = `<span class="badge ${statusClass[a.status] || 'bg-secondary'}">${statusLabel[a.status] || a.status}</span>`;

  setDocLink('apd_cv_link', a.cv_url);
  setDocLink('apd_ktp_link', a.ktp_url);
  setDocLink('apd_ijazah_link', a.ijazah_url);
  setDocLink('apd_transcript_link', a.transcript_url);
  setDocLink('apd_certificate_link', a.certificate_url);

  new bootstrap.Modal(document.getElementById('applicantDetailModal')).show();
}

function setDocLink(id, url) {
  const el = document.getElementById(id);
  if (url) {
    el.href = url;
    el.classList.remove('disabled');
    el.style.opacity = '';
  } else {
    el.href = '#';
    el.classList.add('disabled');
    el.style.opacity = '0.5';
  }
}

async function updateApplicantStatus(status) {
  if (!currentApplicantId) return;
  const statusLabel = { pending: 'Baru', reviewed: 'Diproses', accepted: 'Diterima', rejected: 'Ditolak' };
  if (!confirm(`Ubah status lamaran menjadi "${statusLabel[status]}"?`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/admin/applications/${currentApplicantId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to update status');

    const a = applicantsCache.find((x) => x.id === currentApplicantId);
    if (a) a.status = status;

    showSuccess(`Status lamaran diubah ke "${statusLabel[status]}"`);
    bootstrap.Modal.getInstance(document.getElementById('applicantDetailModal')).hide();
    renderApplicants(applicantsCache);
  } catch (error) {
    showError(error.message);
  }
}

// =============================================
// BATCH DISPATCH
// =============================================

async function loadBatchDispatchPanel() {
  try {
    await Promise.all([
      loadBatchDispatchDrivers(),
      loadBatchDispatchSummary(),
      loadBatchDispatchDeliverySummary(),
    ]);
    await loadBatchDispatchPackages();
    initDispatchSearchableCombos();
  } catch (error) {
    showError(error.message || 'Gagal load dispatch panel');
  }
}

function initDispatchSearchableCombos() {
  if (typeof window.TomSelect === 'undefined') return;

  const selectIds = [
    'dispatchSourceDriver',
    'dispatchTargetDriver',
    'dispatchKawasanValue',
    'dispatchKawasanTargetDriver',
  ];

  selectIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.tomselect) {
      const currentValue = String(el.tomselect.getValue() || el.value || '');
      el.tomselect.clearOptions();
      Array.from(el.options).forEach((opt) => {
        el.tomselect.addOption({ value: opt.value, text: opt.text });
      });
      el.tomselect.refreshOptions(false);
      if (currentValue && Array.from(el.options).some((opt) => opt.value === currentValue)) {
        el.tomselect.setValue(currentValue, true);
      } else {
        el.tomselect.clear(true);
      }
      return;
    }

    new TomSelect(el, {
      create: false,
      persist: false,
      maxItems: 1,
      allowEmptyOption: true,
      plugins: ['dropdown_input'],
      dropdownParent: 'body',
      placeholder: 'Ketik untuk mencari...',
      onChange: function onChange(value) {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  });

  dispatchSearchableReady = true;
}

function getDispatchSelectValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.tomselect) return String(el.tomselect.getValue() || '').trim();
  return String(el.value || '').trim();
}

async function loadBatchDispatchDrivers() {
  const res = await fetch(`${API_BASE_URL}/api/batch-delivery/drivers`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Gagal load driver dispatch');

  dispatchDrivers = data.data || [];

  const filterDriver = document.getElementById('dispatchFilterDriver');
  const targetDriver = document.getElementById('dispatchTargetDriver');
  const sourceDriver = document.getElementById('dispatchSourceDriver');
  const kawasanTargetDriver = document.getElementById('dispatchKawasanTargetDriver');

  const baseOption = '<option value="">Semua Driver</option>';
  const opts = dispatchDrivers.map((d) =>
    `<option value="${d.id}">${escapeHtml(d.full_name || `Driver #${d.id}`)} (${escapeHtml(d.status || '-')})</option>`
  ).join('');

  filterDriver.innerHTML = baseOption + opts;
  sourceDriver.innerHTML = '<option value="">Pilih Driver Asal</option>' + opts;
  targetDriver.innerHTML = '<option value="">Pilih Driver Tujuan</option>' + opts;
  kawasanTargetDriver.innerHTML = '<option value="">Pilih Driver Tujuan</option>' + opts;

  if (dispatchSearchableReady) initDispatchSearchableCombos();
}

async function loadBatchDispatchSummary() {
  const tbody = document.getElementById('dispatchSummaryBody');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">Memuat summary...</td></tr>';

  const res = await fetch(`${API_BASE_URL}/api/batch-delivery/assigned-summary`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Gagal load summary dispatch');

  dispatchSummaryRows = data.data || [];
  if (!dispatchSummaryRows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">Tidak ada paket assigned</td></tr>';
    return;
  }

  tbody.innerHTML = dispatchSummaryRows.map((r) => `
    <tr>
      <td>${escapeHtml(r.driver_name || `Driver #${r.driver_id}`)}</td>
      <td>${escapeHtml(r.kawasan || '(tanpa kawasan)')}</td>
      <td>${formatNumber(r.total_packages || 0)}</td>
    </tr>
  `).join('');

  const sourceDriverEl = document.getElementById('dispatchSourceDriver');
  if (sourceDriverEl && !sourceDriverEl.value) {
    const firstDriverWithAssigned = dispatchSummaryRows[0]?.driver_id;
    if (firstDriverWithAssigned) sourceDriverEl.value = String(firstDriverWithAssigned);
  }

  fillDispatchKawasanFilter();
  fillDispatchKawasanOptions();
}

async function loadBatchDispatchDeliverySummary() {
  const tbody = document.getElementById('dispatchDeliverySummaryBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">Memuat rekap kirim...</td></tr>';

  const dateEl = document.getElementById('deliverySummaryDate');
  const dateVal = dateEl ? dateEl.value : '';
  const qs = dateVal ? `?date=${encodeURIComponent(dateVal)}` : '';

  const res = await fetch(`${API_BASE_URL}/api/batch-delivery/delivery-summary${qs}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Gagal load rekap pengiriman');

  const rows = data.data || [];
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">Belum ada paket delivered</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const lastAt = r.last_delivered_at
      ? new Date(r.last_delivered_at).toLocaleString('id-ID')
      : '-';
    return `
      <tr>
        <td>${escapeHtml(r.driver_name || `Driver #${r.driver_id}`)}</td>
        <td>${formatNumber(r.total_delivered || 0)}</td>
        <td>${escapeHtml(lastAt)}</td>
      </tr>
    `;
  }).join('');
}

function fillDispatchKawasanFilter() {
  const el = document.getElementById('dispatchFilterKawasan');
  const currentVal = getDispatchSelectValue('dispatchFilterKawasan');
  const unique = [...new Set(dispatchSummaryRows.map((x) => x.kawasan || '(tanpa kawasan)'))].sort();
  el.innerHTML = '<option value="">Semua Kawasan</option>'
    + unique.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
  el.value = unique.includes(currentVal) ? currentVal : '';

  if (dispatchSearchableReady) initDispatchSearchableCombos();
}

function fillDispatchKawasanOptions() {
  const sourceDriverId = getDispatchSelectValue('dispatchSourceDriver');
  const kawasanEl = document.getElementById('dispatchKawasanValue');
  const current = getDispatchSelectValue('dispatchKawasanValue');

  const filtered = sourceDriverId
    ? dispatchSummaryRows.filter((r) => String(r.driver_id) === String(sourceDriverId))
    : dispatchSummaryRows;

  const unique = [...new Set(filtered.map((x) => x.kawasan || '(tanpa kawasan)'))].sort();
  const label = sourceDriverId ? 'Pilih Kawasan' : 'Semua Kawasan (pilih driver untuk mempersempit)';
  kawasanEl.innerHTML = `<option value="">${label}</option>`
    + unique.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
  kawasanEl.value = unique.includes(current) ? current : '';

  if (dispatchSearchableReady) initDispatchSearchableCombos();
}

async function loadBatchDispatchPackages() {
  const tbody = document.getElementById('dispatchPackagesBody');
  const hintEl = document.getElementById('dispatchHint');
  const driverId = getDispatchSelectValue('dispatchFilterDriver');
  const kawasan = getDispatchSelectValue('dispatchFilterKawasan');

  try {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-2">Memuat paket...</td></tr>';

    const params = new URLSearchParams();
    params.set('limit', '500');
    if (driverId) params.set('driver_id', driverId);
    if (kawasan) params.set('kawasan', kawasan);

    const res = await fetch(`${API_BASE_URL}/api/batch-delivery/assigned-list?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal load paket assigned');

    const rows = data.data || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-2">Tidak ada paket sesuai filter</td></tr>';
      hintEl.textContent = 'Belum ada data assigned untuk filter tersebut.';
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td><input type="checkbox" class="dispatch-item-check" value="${r.id}"></td>
        <td>${r.id}</td>
        <td>${escapeHtml(r.npp || '-')}</td>
        <td>${escapeHtml(r.kawasan || '(tanpa kawasan)')}</td>
        <td>${escapeHtml(r.driver_name || `Driver #${r.driver_id}`)}</td>
      </tr>
    `).join('');

    const all = document.getElementById('dispatchSelectAll');
    if (all) all.checked = false;
    hintEl.textContent = `Total ${formatNumber(rows.length)} paket assigned dimuat. Pilih paket atau gunakan mode per kawasan.`;
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-2">Gagal memuat paket</td></tr>';
    hintEl.textContent = error.message || 'Gagal memuat paket assigned.';
  }
}

function toggleDispatchSelectAll() {
  const checked = document.getElementById('dispatchSelectAll').checked;
  document.querySelectorAll('.dispatch-item-check').forEach((el) => {
    el.checked = checked;
  });
}

function getSelectedDispatchPackageIds() {
  return Array.from(document.querySelectorAll('.dispatch-item-check:checked'))
    .map((el) => parseInt(el.value, 10))
    .filter((x) => Number.isInteger(x) && x > 0);
}

async function reassignSelectedPackages() {
  try {
    const targetDriverId = parseInt(getDispatchSelectValue('dispatchTargetDriver'), 10);
    const packageIds = getSelectedDispatchPackageIds();

    if (!targetDriverId) {
      showError('Pilih driver tujuan terlebih dahulu');
      return;
    }
    if (!packageIds.length) {
      showError('Pilih minimal 1 paket yang ingin dipindahkan');
      return;
    }
    if (!confirm(`Pindahkan ${packageIds.length} paket ke driver tujuan?`)) return;

    const res = await fetch(`${API_BASE_URL}/api/batch-delivery/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_driver_id: targetDriverId,
        package_ids: packageIds,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal reassign per paket');

    showSuccess(`Berhasil memindahkan ${data.data?.moved || 0} paket`);
    await loadBatchDispatchPanel();
  } catch (error) {
    showError(error.message || 'Gagal reassign paket');
  }
}

async function reassignByKawasan() {
  try {
    const sourceDriverId = parseInt(getDispatchSelectValue('dispatchSourceDriver'), 10);
    const kawasan = getDispatchSelectValue('dispatchKawasanValue');
    const targetDriverId = parseInt(getDispatchSelectValue('dispatchKawasanTargetDriver'), 10);

    if (!sourceDriverId || !kawasan || !targetDriverId) {
      showError('Lengkapi driver asal, kawasan, dan driver tujuan');
      return;
    }
    if (sourceDriverId === targetDriverId) {
      showError('Driver asal dan tujuan tidak boleh sama');
      return;
    }
    if (!confirm(`Pindahkan semua paket assigned di kawasan "${kawasan}" ke driver tujuan?`)) return;

    const res = await fetch(`${API_BASE_URL}/api/batch-delivery/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_driver_id: targetDriverId,
        source_driver_id: sourceDriverId,
        kawasan,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal reassign per kawasan');

    showSuccess(`Berhasil memindahkan ${data.data?.moved || 0} paket untuk kawasan ${kawasan}`);
    await loadBatchDispatchPanel();
  } catch (error) {
    showError(error.message || 'Gagal reassign kawasan');
  }
}

// ─── Expedition geocoding helpers ────────────────────────────────────────────

async function loadExpeditionOffice() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/expedition/office`);
    const data = await res.json();
    if (!data.success) return;
    const o = data.data;
    // Pre-fill sender panel (readonly) with office data
    document.getElementById('expSenderName').value = o.name || 'Hantar Ekspedisi';
    document.getElementById('expSenderPhone').value = o.phone || '-';
    document.getElementById('expSenderAddress').value = o.address || '';
    document.getElementById('expSenderKecamatan').value = o.kecamatan || '';
    document.getElementById('expSenderKabupaten').value = o.kabupaten || '';
    document.getElementById('expSenderPostal').value = o.postal_code || '';
    document.getElementById('expSenderProvinsi').value = o.provinsi || '';
    const badge = document.getElementById('expOfficeBadge');
    if (badge) badge.textContent = o.name || 'Kantor Hantar';
    // Set sender coordinates so distance calc works immediately on recipient geocode
    senderCoords = { lat: o.lat, lon: o.lon };
  } catch (e) {
    // non-critical
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function updateAutoDistanceVehicle() {
  if (!senderCoords || !recipientCoords) return;

  const km = haversineKm(senderCoords.lat, senderCoords.lon, recipientCoords.lat, recipientCoords.lon);
  const kmRounded = Math.round(km * 10) / 10;

  const distInput = document.getElementById('expDistanceKm');
  const vehicleSelect = document.getElementById('expVehicleType');
  const vehicleNote = document.getElementById('expVehicleAutoNote');
  const distNote = document.getElementById('expDistanceNote');

  distInput.value = kmRounded;
  distNote.textContent = `— ${kmRounded} KM terisi otomatis`;

  if (kmRounded >= 5) {
    vehicleSelect.value = 'motorcycle';
    vehicleSelect.disabled = true;
    vehicleNote.textContent = '(otomatis Motor — jarak ≥5 KM)';
    vehicleNote.style.color = '#0d6efd';
  } else {
    vehicleSelect.disabled = false;
    vehicleNote.textContent = '(pilih Sepeda atau Motor)';
    vehicleNote.style.color = '#6c757d';
  }
}

async function geocodeAddressForExpedition(type) {
  const isRecipient = type === 'recipient';
  const addressEl = document.getElementById(isRecipient ? 'expRecipientAddress' : 'expSenderAddress');
  const statusEl = document.getElementById(isRecipient ? 'expRecipientGeoStatus' : 'expSenderGeoStatus');
  const address = addressEl.value.trim();

  if (!address || address.length < 10) return;

  // ── Step 1: parse address locally (instant, no API) ──────────────────────
  const parsed = parseIndonesianAddress(address);
  if (isRecipient) {
    if (parsed.kecamatan) document.getElementById('expRecipientKecamatan').value = parsed.kecamatan;
    if (parsed.kabupaten) document.getElementById('expRecipientKabupaten').value = parsed.kabupaten;
    if (parsed.provinsi)  document.getElementById('expRecipientProvinsi').value  = parsed.provinsi;
    if (parsed.kodePos)   document.getElementById('expRecipientPostal').value    = parsed.kodePos;
  }

  // ── Step 2: geocode for coordinates (use simplified query for better hit) ─
  statusEl.textContent = '⏳ Mencari koordinat...';
  statusEl.style.color = '#6c757d';

  // Build a simplified query: prefer extracted kecamatan+kabupaten over raw address
  const geoQuery = parsed.kecamatan && parsed.kabupaten
    ? `${parsed.kecamatan}, ${parsed.kabupaten}, ${parsed.provinsi || 'Indonesia'}`
    : address;

  try {
    const res = await fetch(`${API_BASE_URL}/api/expedition/geocode?address=${encodeURIComponent(geoQuery)}`);
    const data = await res.json();

    if (!data.success) {
      // Coordinates not found — distance won't auto-calc, but address fields may still be filled
      const filledPartially = parsed.kecamatan || parsed.kabupaten;
      statusEl.textContent = filledPartially
        ? '⚠ Koordinat tidak ditemukan — isi kode pos manual, jarak perlu diisi manual jika belum muncul'
        : '⚠ Alamat tidak ditemukan di peta, coba tambahkan nama kecamatan/kabupaten';
      statusEl.style.color = '#e65c00';
      return;
    }

    const d = data.data;
    statusEl.textContent = `✓ Koordinat ditemukan (${d.display_name.slice(0, 70)}...)`;
    statusEl.style.color = '#198754';

    if (isRecipient) {
      recipientCoords = { lat: d.lat, lon: d.lon };
      // Only overwrite if local parse didn't already fill them
      if (!parsed.kecamatan && d.kecamatan) document.getElementById('expRecipientKecamatan').value = d.kecamatan;
      if (!parsed.kabupaten && d.kabupaten) document.getElementById('expRecipientKabupaten').value = d.kabupaten;
      if (!parsed.provinsi  && d.provinsi)  document.getElementById('expRecipientProvinsi').value  = d.provinsi;
    } else {
      senderCoords = { lat: d.lat, lon: d.lon };
      if (!parsed.kecamatan && d.kecamatan) document.getElementById('expSenderKecamatan').value = d.kecamatan;
      if (!parsed.kabupaten && d.kabupaten) document.getElementById('expSenderKabupaten').value = d.kabupaten;
      if (!parsed.provinsi  && d.provinsi)  document.getElementById('expSenderProvinsi').value  = d.provinsi;
    }

    updateAutoDistanceVehicle();
  } catch (err) {
    statusEl.textContent = '⚠ Koneksi ke peta gagal, isi manual';
    statusEl.style.color = '#dc3545';
  }
}

/**
 * Parse Indonesian address text to extract kecamatan, kabupaten, provinsi, kodePos.
 * Handles common patterns: "Kec. X", "Kecamatan X", "Kabupaten/Kota X", "Provinsi X",
 * and trailing 5-digit postal codes.
 */
function parseIndonesianAddress(text) {
  const result = { kecamatan: '', kabupaten: '', provinsi: '', kodePos: '' };
  if (!text) return result;

  // Postal code: 5-digit number at end (or anywhere)
  const kodeMatch = text.match(/\b(\d{5})\b/);
  if (kodeMatch) result.kodePos = kodeMatch[1];

  // Kecamatan: "Kec. X" / "Kecamatan X"
  const kecMatch = text.match(/\bkec(?:amatan)?[.\s]+([A-Za-z\s]+?)(?=[,\n]|Kab|Kota|Kabupaten|Provinsi|Banten|Jawa|Sumatera|Sulawesi|$)/i);
  if (kecMatch) result.kecamatan = kecMatch[1].trim().replace(/\s+/g, ' ');

  // Kabupaten / Kota: "Kabupaten X" / "Kab. X" / "Kota X"
  const kabMatch = text.match(/\b(Kab(?:upaten)?\.?\s+|Kota\s+)([A-Za-z\s]+?)(?=[,\n]|Provinsi|Banten|Jawa|Sumatera|Sulawesi|\d|$)/i);
  if (kabMatch) {
    const prefix = kabMatch[1].trim();
    const name   = kabMatch[2].trim().replace(/\s+/g, ' ');
    result.kabupaten = prefix.toLowerCase().startsWith('kota') ? `Kota ${name}` : `Kabupaten ${name}`;
  }

  // Provinsi: known province names embedded in address
  const provinces = [
    'Banten','DKI Jakarta','Jawa Barat','Jawa Tengah','Jawa Timur','DI Yogyakarta',
    'Bali','Sumatera Utara','Sumatera Barat','Sumatera Selatan','Riau','Kepulauan Riau',
    'Lampung','Bengkulu','Jambi','Aceh','Bangka Belitung','Sulawesi Selatan',
    'Sulawesi Utara','Sulawesi Tengah','Sulawesi Tenggara','Gorontalo','Kalimantan Barat',
    'Kalimantan Timur','Kalimantan Selatan','Kalimantan Tengah','Kalimantan Utara',
    'Nusa Tenggara Barat','Nusa Tenggara Timur','Maluku','Maluku Utara','Papua','Papua Barat',
  ];
  for (const prov of provinces) {
    if (text.toLowerCase().includes(prov.toLowerCase())) {
      result.provinsi = prov;
      break;
    }
  }

  return result;
}

async function handleExpeditionQuote() {
  try {
    const serviceType = document.getElementById('expServiceType').value;
    const vehicleType = document.getElementById('expVehicleType').value;
    const distanceKm = parseFloat(document.getElementById('expDistanceKm').value || '0');
    const weightKg = parseFloat(document.getElementById('expWeightKg').value || '0');
    const lengthCm = parseFloat(document.getElementById('expLengthCm').value || '0');
    const widthCm = parseFloat(document.getElementById('expWidthCm').value || '0');
    const heightCm = parseFloat(document.getElementById('expHeightCm').value || '0');
    const insuranceEnabled = document.getElementById('expInsurance').checked;

    if (!distanceKm || distanceKm <= 0) {
      showError('Isi jarak (KM) terlebih dahulu');
      return;
    }

    if ((!weightKg || weightKg <= 0) && (!lengthCm || !widthCm || !heightCm)) {
      showError('Isi berat aktual atau lengkapkan dimensi P/L/T agar tarif bisa dihitung');
      return;
    }

    const params = new URLSearchParams();
    params.set('service_type', serviceType);
    params.set('vehicle_type', vehicleType);
    params.set('distance_km', String(distanceKm));
    if (weightKg > 0) params.set('weight_kg', String(weightKg));
    if (lengthCm > 0) params.set('length_cm', String(lengthCm));
    if (widthCm > 0) params.set('width_cm', String(widthCm));
    if (heightCm > 0) params.set('height_cm', String(heightCm));
    params.set('insurance_enabled', insuranceEnabled ? 'true' : 'false');

    const res = await fetch(`${API_BASE_URL}/api/expedition/quote?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal hitung tarif');

    const d = data.data;
    document.getElementById('expQuoteResult').innerHTML =
      `Harga: <strong>Rp${formatNumber(d.customer_price)}</strong> | Komisi: <strong>Rp${formatNumber(d.driver_commission)}</strong> | Margin: <strong>Rp${formatNumber(d.platform_margin)}</strong> | Berat Tagih: <strong>${d.chargeable_weight_kg} kg</strong>`;
  } catch (error) {
    showError(error.message);
  }
}

async function handleExpeditionCreate(e) {
  e.preventDefault();

  try {
    const payload = {
      service_type: document.getElementById('expServiceType').value,
      vehicle_type: document.getElementById('expVehicleType').value,
      distance_km: parseFloat(document.getElementById('expDistanceKm').value || '0'),
      pickup_type: document.getElementById('expPickupType').value,

      sender_name: document.getElementById('expSenderName').value.trim(),
      sender_phone: document.getElementById('expSenderPhone').value.trim(),
      sender_address: document.getElementById('expSenderAddress').value.trim(),
      sender_kecamatan: document.getElementById('expSenderKecamatan').value.trim(),
      sender_kabupaten: document.getElementById('expSenderKabupaten').value.trim(),
      sender_provinsi: document.getElementById('expSenderProvinsi').value.trim(),
      sender_postal_code: document.getElementById('expSenderPostal').value.trim(),

      recipient_name: document.getElementById('expRecipientName').value.trim(),
      recipient_phone: document.getElementById('expRecipientPhone').value.trim(),
      recipient_address: document.getElementById('expRecipientAddress').value.trim(),
      recipient_kecamatan: document.getElementById('expRecipientKecamatan').value.trim(),
      recipient_kabupaten: document.getElementById('expRecipientKabupaten').value.trim(),
      recipient_provinsi: document.getElementById('expRecipientProvinsi').value.trim(),
      recipient_postal_code: document.getElementById('expRecipientPostal').value.trim(),

      weight_kg: parseFloat(document.getElementById('expWeightKg').value || '0') || null,
      length_cm: parseFloat(document.getElementById('expLengthCm').value || '0') || null,
      width_cm: parseFloat(document.getElementById('expWidthCm').value || '0') || null,
      height_cm: parseFloat(document.getElementById('expHeightCm').value || '0') || null,
      insurance_enabled: document.getElementById('expInsurance').checked,
      created_by: 'admin-web',
    };

    const res = await fetch(`${API_BASE_URL}/api/expedition/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal membuat shipment');

    showSuccess(`Shipment berhasil dibuat. Resi: ${data.data.tracking_number}`);
    document.getElementById('expeditionForm').reset();
    document.getElementById('expQuoteResult').textContent = 'Belum ada quote.';
    document.getElementById('expVehicleType').disabled = false;
    loadExpeditionOffice();
    await loadExpeditionShipments();
  } catch (error) {
    showError(error.message);
  }
}

async function loadExpeditionShipments() {
  try {
    const status = document.getElementById('expStatusFilter').value;
    const search = document.getElementById('expSearchInput').value.trim();

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const res = await fetch(`${API_BASE_URL}/api/expedition/shipments?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal load shipment');

    expeditionCache = data.data || [];
    renderExpeditionShipments(expeditionCache);
  } catch (error) {
    showError(error.message);
  }
}

async function loadExpeditionPricingSetup() {
  try {
    const [serviceRes, minRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/expedition/pricing/services`),
      fetch(`${API_BASE_URL}/api/expedition/pricing/minimum-charges`),
    ]);

    const serviceData = await serviceRes.json();
    const minData = await minRes.json();

    if (!serviceData.success) throw new Error(serviceData.message || 'Gagal load service pricing');
    if (!minData.success) throw new Error(minData.message || 'Gagal load minimum charge');

    expeditionPricingServices = serviceData.data || [];
    expeditionMinCharges = minData.data || [];

    renderExpeditionPricingServices(expeditionPricingServices);
    renderExpeditionMinCharges(expeditionMinCharges);
    await loadExpeditionWilayahSeedStatus();
  } catch (error) {
    showError(error.message);
  }
}

async function loadExpeditionWilayahSeedStatus() {
  const countsEl = document.getElementById('expWilayahSeedCounts');
  const hintEl = document.getElementById('expWilayahSeedHint');
  if (!countsEl || !hintEl) return;

  try {
    countsEl.textContent = 'memuat...';
    const res = await fetch(`${API_BASE_URL}/api/expedition/admin/seed-wilayah/status`, {
      headers: { ...getAdminAuthHeaders() },
    });
    const data = await res.json();
    if (res.status === 401) {
      adminLogout();
      return;
    }
    if (!data.success) throw new Error(data.message || 'Gagal cek status wilayah');

    const d = data.data || {};
    countsEl.textContent = `provinsi ${formatNumber(d.provinces || 0)} | kab/kota ${formatNumber(d.regencies || 0)} | kecamatan ${formatNumber(d.districts || 0)}`;
    hintEl.textContent = 'Status master wilayah terbaru berhasil dimuat.';
  } catch (error) {
    countsEl.textContent = 'gagal cek status';
    hintEl.textContent = error.message || 'Terjadi kesalahan saat cek status.';
  }
}

async function triggerExpeditionWilayahSeed() {
  const btn = document.getElementById('expTriggerWilayahSeedBtn');
  const hintEl = document.getElementById('expWilayahSeedHint');
  const oldText = btn ? btn.textContent : '';

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Memproses...';
    }

    const res = await fetch(`${API_BASE_URL}/api/expedition/admin/seed-wilayah`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders(),
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status === 401) {
      adminLogout();
      return;
    }
    if (!data.success) throw new Error(data.message || 'Gagal trigger sinkron wilayah');

    showSuccess(data.message || 'Sinkronisasi master wilayah dimulai');
    if (hintEl) hintEl.textContent = 'Sinkronisasi berjalan di server. Klik Cek Master Wilayah dalam 1-2 menit.';
    await loadExpeditionWilayahSeedStatus();
  } catch (error) {
    showError(error.message);
    if (hintEl) hintEl.textContent = error.message || 'Gagal trigger sinkron wilayah.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || 'Sinkron Master Wilayah';
    }
  }
}

function renderExpeditionPricingServices(rows) {
  const tbody = document.getElementById('expPricingServiceBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-2">Belum ada setup tarif layanan</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const sla = `${r.sla_min_hours || 0}-${r.sla_max_hours || 0} jam`;
    const commission = String(r.driver_commission_type) === 'percentage'
      ? `${r.driver_commission_value}%`
      : `Rp${formatNumber(r.driver_commission_value)}`;
    return `
      <tr>
        <td>${escapeHtml(r.service_type)}</td>
        <td>${escapeHtml(r.vehicle_type)}</td>
        <td>${escapeHtml(sla)}</td>
        <td>${escapeHtml(String(r.volumetric_divisor || '-'))}</td>
        <td>Rp${formatNumber(r.rate_per_km || 0)}</td>
        <td>Rp${formatNumber(r.rate_per_kg || 0)}</td>
        <td>Rp${formatNumber(r.base_fee || 0)}</td>
        <td>${escapeHtml(commission)}</td>
      </tr>
    `;
  }).join('');
}

function renderExpeditionMinCharges(rows) {
  const tbody = document.getElementById('expMinChargeBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">Belum ada minimum charge</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.service_type)}</td>
      <td>${escapeHtml(r.vehicle_type)}</td>
      <td>Rp${formatNumber(r.minimum_charge || 0)}</td>
    </tr>
  `).join('');
}

async function saveExpeditionServicePricing(e) {
  e.preventDefault();
  try {
    const payload = {
      service_type: document.getElementById('spServiceType').value,
      vehicle_type: document.getElementById('spVehicleType').value,
      sla_min_hours: parseInt(document.getElementById('spSlaMin').value || '0', 10) || 0,
      sla_max_hours: parseInt(document.getElementById('spSlaMax').value || '0', 10) || 0,
      volumetric_divisor: parseInt(document.getElementById('spDivisor').value || '4000', 10) || 4000,
      base_fee: parseInt(document.getElementById('spBaseFee').value || '0', 10) || 0,
      rate_per_km: parseInt(document.getElementById('spRateKm').value || '0', 10) || 0,
      rate_per_kg: parseInt(document.getElementById('spRateKg').value || '0', 10) || 0,
      handling_fee: parseInt(document.getElementById('spHandling').value || '0', 10) || 0,
      fuel_surcharge_percent: parseFloat(document.getElementById('spFuelPct').value || '0') || 0,
      insurance_fee_flat: parseInt(document.getElementById('spInsuranceFlat').value || '0', 10) || 0,
      insurance_fee_percent: parseFloat(document.getElementById('spInsurancePct').value || '0') || 0,
      driver_commission_type: document.getElementById('spCommissionType').value,
      driver_commission_value: parseFloat(document.getElementById('spCommissionValue').value || '0') || 0,
      is_active: 1,
    };

    const res = await fetch(`${API_BASE_URL}/api/expedition/pricing/services/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal simpan service pricing');

    showSuccess('Setup tarif layanan berhasil disimpan');
    await loadExpeditionPricingSetup();
  } catch (error) {
    showError(error.message);
  }
}

async function saveExpeditionMinimumCharge(e) {
  e.preventDefault();
  try {
    const payload = {
      service_type: document.getElementById('mcServiceType').value,
      vehicle_type: document.getElementById('mcVehicleType').value,
      minimum_charge: parseInt(document.getElementById('mcAmount').value || '0', 10) || 0,
      is_active: 1,
    };

    const res = await fetch(`${API_BASE_URL}/api/expedition/pricing/minimum-charges/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal simpan minimum charge');

    showSuccess('Minimum charge berhasil disimpan');
    await loadExpeditionPricingSetup();
  } catch (error) {
    showError(error.message);
  }
}

function renderExpeditionShipments(rows) {
  const tbody = document.getElementById('expeditionTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">Belum ada data shipment</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const statusBadge = renderExpeditionStatusBadge(r.status);
    const vehicleLabel = r.vehicle_type === 'motorcycle' ? 'Motor' : 'Sepeda';
    return `
      <tr>
        <td>${r.id}</td>
        <td><strong>${escapeHtml(r.tracking_number || '-')}</strong></td>
        <td>${vehicleLabel}</td>
        <td>${escapeHtml(r.sender_name || '-')}<br><small class="text-muted">${escapeHtml(r.sender_phone || '-')}</small></td>
        <td>${escapeHtml(r.recipient_name || '-')}<br><small class="text-muted">${escapeHtml(r.recipient_phone || '-')}</small></td>
        <td>${Number(r.distance_km || 0).toFixed(1)} KM</td>
        <td>Rp${formatNumber(r.customer_price || 0)}</td>
        <td>Rp${formatNumber(r.driver_commission || 0)}</td>
        <td>${statusBadge}</td>
        <td>
          <select class="form-select form-select-sm" onchange="updateExpeditionStatus(${r.id}, this.value)">
            <option value="">Ubah status</option>
            <option value="scheduled">Scheduled</option>
            <option value="picked_up">Picked Up</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="returned">Returned</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

function renderExpeditionStatusBadge(status) {
  const map = {
    created: 'secondary',
    scheduled: 'primary',
    picked_up: 'info',
    in_transit: 'warning',
    delivered: 'success',
    failed: 'danger',
    returned: 'dark',
  };
  const cls = map[status] || 'secondary';
  return `<span class="badge text-bg-${cls}">${escapeHtml((status || '-').toUpperCase())}</span>`;
}

async function updateExpeditionStatus(id, status) {
  if (!status) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/expedition/shipments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal update status');

    showSuccess('Status shipment diperbarui');
    await loadExpeditionShipments();
  } catch (error) {
    showError(error.message);
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}