import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

async function request(path, options = {}) {
  const token = Cookies.get('admin_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !path.includes('/admin/login')) {
    if (token) {
      Cookies.remove('admin_token');
      Cookies.remove('admin_user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    throw new Error('Session expired');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// Control center helpers
export const cc = {
  getSummary: () => api.get('/admin/control-center/summary'),
  getHealth: () => api.get('/admin/control-center/health'),
  getMarketReports: () => api.get('/admin/market-reports'),
  updateMarketReport: (id, body) => api.patch(`/admin/market-reports/${id}`, body),
  getWeeklyWinnerStatus: () => api.get('/admin/weekly-winner-status'),
  markWeeklyWinnerPaid: (weekStart) => api.post(`/admin/weekly-winner/${encodeURIComponent(weekStart)}/mark-paid`, {}),
  getBannedStudents: () => api.get('/admin/students/banned'),
  approveMarket: (marketId) => api.post(`/multi-markets/${marketId}/approve`, {}),
  rejectMarket: (marketId, reason) => api.post(`/multi-markets/${marketId}/reject`, { reason }),
  reconnectBot: () => api.post('/admin/bot/reconnect', {}),
  // Reused existing endpoints for panels
  getClosedMarkets: () => api.get('/multi-markets/admin/all?status=closed'),
  getPendingMarkets: () => api.get('/multi-markets/admin/all?status=pending'),
  resolveMarket: (marketId, winningOutcomeId) => api.post(`/multi-markets/${marketId}/resolve`, { winningOutcomeId }),
  getPendingContent: () => api.get('/content/pending'),
  approveContent: (id) => api.post(`/content/${id}/approve`, {}),
  publishContent: (id) => api.post(`/content/${id}/publish`, {}),
  getPendingRedemptions: () => api.get('/rewards/pending'),
  fulfillRedemption: (id, body) => api.post(`/rewards/${id}/fulfill`, body || {}),
  getSimulationAlerts: () => api.get('/admin/simulation/alerts?status=pending'),
  updateSimulationAlert: (id, body) => api.patch(`/admin/simulation/alerts/${id}`, body),
  unbanStudent: (studentId) => api.post(`/admin/students/${studentId}/unban`, {}),
};
