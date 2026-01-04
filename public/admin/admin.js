// Configuration
const API_BASE_URL = 'https://travel-api-production-23ae.up.railway.app';
// const API_BASE_URL = 'http://localhost:3000'; // For local testing

let currentDriverId = null;
let allDrivers = [];

// Helper functions for Indonesian translation
function translateVehicleType(type) {
    const translations = {
        'bike': 'Sepeda',
        'motorcycle': 'Motor',
        'car': 'Mobil',
        'truck': 'Truk',
        'wheels': 'Roda',
        'skateboard': 'Skateboard'
    };
    return translations[type] || type;
}

function translateServiceType(type) {
    const translations = {
        'ride': 'Antar Jemput',
        'delivery': 'Pengiriman',
        'both': 'Keduanya'
    };
    return translations[type] || type;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadDrivers();
    
    // Event listeners
    document.getElementById('statusFilter').addEventListener('change', loadDrivers);
    document.getElementById('searchInput').addEventListener('input', debounce(loadDrivers, 500));
    document.getElementById('confirmRejectBtn').addEventListener('click', confirmReject);
});

// Load statistics
async function loadStats() {
    try {
        console.log('Loading stats from:', `${API_BASE_URL}/api/admin/drivers-stats`);
        const response = await fetch(`${API_BASE_URL}/api/admin/drivers-stats`);
        console.log('Stats response status:', response.status);
        const data = await response.json();
        console.log('Stats data:', data);
        
        if (data.success) {
            renderStats(data.stats);
        } else {
            console.error('Stats API returned success=false');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

// Render statistics cards
function renderStats(stats) {
    const statsHTML = `
        <div class="col-md-3">
            <div class="card stats-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-muted mb-1">Total Drivers</h6>
                            <h2 class="mb-0">${stats.total_drivers}</h2>
                        </div>
                        <div class="stats-icon bg-primary bg-opacity-10 text-primary">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card stats-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-muted mb-1">Pending</h6>
                            <h2 class="mb-0 text-warning">${stats.pending_count}</h2>
                        </div>
                        <div class="stats-icon bg-warning bg-opacity-10 text-warning">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card stats-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-muted mb-1">Approved</h6>
                            <h2 class="mb-0 text-success">${stats.approved_count}</h2>
                        </div>
                        <div class="stats-icon bg-success bg-opacity-10 text-success">
                            <i class="fas fa-check-circle"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card stats-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-muted mb-1">Rejected</h6>
                            <h2 class="mb-0 text-danger">${stats.rejected_count}</h2>
                        </div>
                        <div class="stats-icon bg-danger bg-opacity-10 text-danger">
                            <i class="fas fa-times-circle"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('statsContainer').innerHTML = statsHTML;
}

// Load drivers with filters
async function loadDrivers() {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value;
    
    console.log('Loading drivers with filters - status:', status, 'search:', search);
    showLoading();
    
    try {
        let url = `${API_BASE_URL}/api/admin/drivers?status=${status}`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }
        
        console.log('Fetching drivers from:', url);
        const response = await fetch(url);
        console.log('Drivers response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Drivers data:', data);
        
        if (data.success) {
            // Handle both response structures: data.drivers or data.data
            const driversList = data.drivers || data.data || [];
            console.log('Drivers list length:', driversList.length);
            allDrivers = driversList;
            renderDrivers(driversList);
        } else {
            console.error('Drivers API returned success=false:', data);
            showError('Failed to load drivers: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading drivers:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        showError('Network error. Please try again. Details: ' + error.message);
    }
}

// Render drivers list
function renderDrivers(drivers) {
    const container = document.getElementById('driversContainer');
    
    if (drivers.length === 0) {
        container.innerHTML = `
            <div class="card">
                <div class="card-body text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No drivers found</p>
                </div>
            </div>
        `;
        return;
    }
    
    const driversHTML = drivers.map(driver => `
        <div class="card driver-card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <div class="d-flex align-items-start">
                            <img src="${driver.ktp_photo_url || 'https://via.placeholder.com/80'}" 
                                 class="driver-photo me-3 clickable-photo" 
                                 data-photo-url="${driver.ktp_photo_url}"
                                 data-photo-title="KTP Photo"
                                 alt="KTP">
                            <div class="flex-grow-1">
                                <h5 class="mb-1">${driver.full_name}</h5>
                                <div class="text-muted small mb-2">
                                    <i class="fas fa-phone me-2"></i>${driver.phone} | 
                                    <i class="fas fa-envelope me-2 ms-3"></i>${driver.email || 'N/A'}
                                </div>
                                <div class="mb-2">
                                    <span class="badge bg-light text-dark me-2">
                                        <i class="fas fa-car me-1"></i>${translateVehicleType(driver.vehicle_type)}
                                    </span>
                                    <span class="badge ${getStatusBadgeClass(driver.status)}">
                                        ${driver.status ? driver.status.toUpperCase() : 'PENDING'}
                                    </span>
                                </div>
                                <div class="text-muted small">
                                    <i class="fas fa-clock me-1"></i>
                                    Registered: ${formatDate(driver.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4 text-end">
                        ${renderActionButtons(driver)}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = driversHTML;
    
    // Add event listeners for photo clicks
    document.querySelectorAll('.clickable-photo').forEach(img => {
        img.addEventListener('click', function() {
            const url = this.getAttribute('data-photo-url');
            const title = this.getAttribute('data-photo-title');
            showPhoto(url, title);
        });
    });
}

// Render action buttons based on status
function renderActionButtons(driver) {
    if (driver.status === 'pending') {
        return `
            <button class="btn btn-info btn-sm mb-2 w-100" onclick="showDriverDetail(${driver.id})">
                <i class="fas fa-eye me-1"></i>View Detail
            </button>
            <button class="btn btn-approve btn-sm mb-2 w-100" onclick="approveDriver(${driver.id}, '${driver.full_name}')">
                <i class="fas fa-check-circle me-1"></i>Approve
            </button>
            <button class="btn btn-reject btn-sm w-100" onclick="showRejectModal(${driver.id}, '${driver.full_name}')">
                <i class="fas fa-times-circle me-1"></i>Reject
            </button>
        `;
    } else if (driver.status === 'approved') {
        return `
            <span class="badge bg-success p-2">
                <i class="fas fa-check-circle me-1"></i>Approved
            </span>
        `;
    } else if (driver.status === 'rejected') {
        return `
            <span class="badge bg-danger p-2">
                <i class="fas fa-times-circle me-1"></i>Rejected
            </span>
        `;
    }
}

// Get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case 'pending': return 'badge-pending';
        case 'approved': return 'badge-approved';
        case 'rejected': return 'badge-rejected';
        default: return 'bg-secondary';
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show photo modal
function showPhoto(url, title) {
    document.getElementById('photoModalTitle').textContent = title;
    document.getElementById('modalPhoto').src = url;
    new bootstrap.Modal(document.getElementById('photoModal')).show();
}

// Approve driver
async function approveDriver(driverId, driverName) {
    if (!confirm(`Approve driver registration for ${driverName}?`)) {
        return;
    }
    
    const button = event.target.closest('button');
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Approving...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                admin_notes: 'Approved via admin panel'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(`Driver ${driverName} has been approved!`);
            loadStats();
            loadDrivers();
        } else {
            showError(data.message || 'Failed to approve driver');
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    } catch (error) {
        console.error('Error approving driver:', error);
        showError('Network error. Please try again.');
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// Show reject modal
function showRejectModal(driverId, driverName) {
    currentDriverId = driverId;
    document.getElementById('rejectDriverName').textContent = driverName;
    document.getElementById('rejectionReason').value = '';
    new bootstrap.Modal(document.getElementById('rejectModal')).show();
}

// Confirm reject
async function confirmReject() {
    const reason = document.getElementById('rejectionReason').value.trim();
    
    if (!reason) {
        alert('Please provide a rejection reason');
        return;
    }
    
    const button = document.getElementById('confirmRejectBtn');
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Rejecting...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/drivers/${currentDriverId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rejection_reason: reason
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
            showSuccess('Driver registration has been rejected');
            loadStats();
            loadDrivers();
        } else {
            showError(data.message || 'Failed to reject driver');
        }
    } catch (error) {
        console.error('Error rejecting driver:', error);
        showError('Network error. Please try again.');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// Show loading
function showLoading() {
    document.getElementById('driversContainer').innerHTML = `
        <div class="card">
            <div class="card-body text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-muted mt-3">Loading drivers...</p>
            </div>
        </div>
    `;
}

// Show success message
function showSuccess(message) {
    // You can implement a toast notification here
    alert(message);
}

// Show error message
function showError(message) {
    alert('Error: ' + message);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show driver detail modal
async function showDriverDetail(driverId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}`);
        const data = await response.json();
        
        if (data.success) {
            const driver = data.driver;
            
            // Fill personal information
            document.getElementById('detail_full_name').textContent = driver.full_name || '-';
            document.getElementById('detail_phone').textContent = driver.phone || '-';
            document.getElementById('detail_email').textContent = driver.email || '-';
            document.getElementById('detail_nik').textContent = driver.nik || '-';
            document.getElementById('detail_dob').textContent = formatDate(driver.date_of_birth) || '-';
            document.getElementById('detail_pob').textContent = driver.place_of_birth || '-';
            document.getElementById('detail_gender').textContent = driver.gender === 'L' ? 'Laki-laki' : driver.gender === 'P' ? 'Perempuan' : '-';
            document.getElementById('detail_religion').textContent = driver.religion || '-';
            document.getElementById('detail_address').textContent = driver.address_full || '-';
            
            // Fill vehicle information
            document.getElementById('detail_vehicle_type').textContent = translateVehicleType(driver.vehicle_type) || '-';
            document.getElementById('detail_vehicle_plate').textContent = driver.vehicle_plate || '-';
            document.getElementById('detail_vehicle_color').textContent = driver.vehicle_color || '-';
            document.getElementById('detail_vehicle_year').textContent = driver.vehicle_year || '-';
            document.getElementById('detail_license_number').textContent = driver.license_number || '-';
            document.getElementById('detail_service_type').textContent = translateServiceType(driver.service_type_allowed) || '-';
            
            // Fill photos - dengan fallback handling
            const ktpImg = document.getElementById('detail_ktp');
            const selfieImg = document.getElementById('detail_selfie');
            const licenseImg = document.getElementById('detail_license');
            const stnkImg = document.getElementById('detail_stnk');
            
            // Reset images
            ktpImg.style.display = 'block';
            ktpImg.nextElementSibling.style.display = 'none';
            selfieImg.style.display = 'block';
            selfieImg.nextElementSibling.style.display = 'none';
            licenseImg.style.display = 'block';
            licenseImg.nextElementSibling.style.display = 'none';
            stnkImg.style.display = 'block';
            stnkImg.nextElementSibling.style.display = 'none';
            
            // Set photo URLs
            if (driver.ktp_photo_url) {
                console.log('KTP URL:', driver.ktp_photo_url);
                ktpImg.src = driver.ktp_photo_url;
            } else {
                console.log('KTP URL is null or empty');
                ktpImg.style.display = 'none';
                ktpImg.nextElementSibling.style.display = 'block';
            }
            
            if (driver.selfie_photo_url) {
                selfieImg.src = driver.selfie_photo_url;
            } else {
                selfieImg.style.display = 'none';
                selfieImg.nextElementSibling.style.display = 'block';
            }
            
            if (driver.license_photo_url) {
                licenseImg.src = driver.license_photo_url;
            } else {
                licenseImg.style.display = 'none';
                licenseImg.nextElementSibling.style.display = 'block';
            }
            
            if (driver.stnk_photo_url) {
                stnkImg.src = driver.stnk_photo_url;
            } else {
                stnkImg.style.display = 'none';
                stnkImg.nextElementSibling.style.display = 'block';
            }
            
            // Setup approve/reject buttons in modal
            document.getElementById('detailApproveBtn').onclick = () => {
                bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
                setTimeout(() => approveDriver(driver.id, driver.full_name), 300);
            };
            
            document.getElementById('detailRejectBtn').onclick = () => {
                bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
                setTimeout(() => showRejectModal(driver.id, driver.full_name), 300);
            };
            
            // Show modal
            new bootstrap.Modal(document.getElementById('detailModal')).show();
        } else {
            showError('Failed to load driver details');
        }
    } catch (error) {
        console.error('Error loading driver detail:', error);
        showError('Failed to load driver details');
    }
}
