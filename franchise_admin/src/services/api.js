const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
const FRANCHISE_PARTNER_ID = Number(import.meta.env.VITE_FRANCHISE_PARTNER_ID || 1);
const AUTH_TOKEN_KEY = 'franchise_admin_token';
const AUTH_PROFILE_KEY = 'franchise_admin_profile';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

async function getJson(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const token = getAuthToken();
  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  const data = await parseResponse(response);

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export function getFranchiseDashboard(params = {}) {
  return getJson('/api/franchise-admin/dashboard', params);
}

export function getFranchiseTransactions(params = {}) {
  return getJson('/api/franchise-admin/transactions', params);
}

export function getFranchiseDrivers(params = {}) {
  return getJson('/api/franchise-admin/drivers', params);
}

export function getFranchiseCustomers(params = {}) {
  return getJson('/api/franchise-admin/customers', params);
}

export async function loginFranchiseAdmin({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/api/franchise-admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await parseResponse(response);
  if (!response.ok || data.success === false || !data.token) {
    throw new Error(data.message || 'Login failed');
  }

  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(data.data || {}));
  return data;
}

export function logoutFranchiseAdmin() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_PROFILE_KEY);
}

export function hasFranchiseAuthToken() {
  return Boolean(getAuthToken());
}

export function getStoredFranchiseProfile() {
  const raw = localStorage.getItem(AUTH_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function parseResponse(response) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const rawText = await response.text();
  const shortText = String(rawText || '').slice(0, 120).replace(/\s+/g, ' ').trim();
  const message = response.ok
    ? `Unexpected response format from API: ${shortText || 'empty response'}`
    : `API returned ${response.status} ${response.statusText}: ${shortText || 'non-JSON response'}`;

  return { success: false, message };
}

export { API_BASE_URL, FRANCHISE_PARTNER_ID };
