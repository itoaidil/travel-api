const API_BASE_URL = 'https://travel-api-production-23ae.up.railway.app';
// const API_BASE_URL = 'http://localhost:3000';

let currentMode = 'drivers';
let currentReject = { id: null, type: 'driver' };
let currentFranchiseId = null;

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  switchMode('drivers');
});

function bindEvents() {
  document.getElementById('moduleDriversBtn').addEventListener('click', () => switchMode('drivers'));
  document.getElementById('moduleFranchiseBtn').addEventListener('click', () => switchMode('franchise'));

  document.getElementById('statusFilter').addEventListener('change', loadList);
  document.getElementById('searchInput').addEventListener('input', debounce(loadList, 400));
  document.getElementById('confirmRejectBtn').addEventListener('click', confirmReject);

  document.getElementById('frSaveCommissionBtn').addEventListener('click', saveFranchiseCommission);
  document.getElementById('frSetPendingBtn').addEventListener('click', () => updateFranchiseStatus('pending'));
  document.getElementById('frActivateBtn').addEventListener('click', () => updateFranchiseStatus('active'));
  document.getElementById('frDeactivateBtn').addEventListener('click', () => updateFranchiseStatus('inactive'));
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
    btnDrivers.classList.add('active');
    btnDrivers.classList.remove('btn-outline-light');
    btnDrivers.classList.add('btn-light');

    btnFranchise.classList.remove('active');
    btnFranchise.classList.remove('btn-light');
    btnFranchise.classList.add('btn-outline-light');

    moduleTitle.textContent = 'Admin Panel - Drivers';
  } else {
    btnFranchise.classList.add('active');
    btnFranchise.classList.remove('btn-outline-light');
    btnFranchise.classList.add('btn-light');

    btnDrivers.classList.remove('active');
    btnDrivers.classList.remove('btn-light');
    btnDrivers.classList.add('btn-outline-light');

    moduleTitle.textContent = 'Admin Panel - Franchise';
  }
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
    loadData();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-2"></i>Simpan';
  }
}