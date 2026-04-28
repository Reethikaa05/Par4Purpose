import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gg_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gg_token');
      localStorage.removeItem('gg_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const scoresAPI = {
  list: () => api.get('/scores'),
  add: (data) => api.post('/scores', data),
  update: (id, data) => api.put(`/scores/${id}`, data),
  delete: (id) => api.delete(`/scores/${id}`),
};

export const drawsAPI = {
  list: () => api.get('/draws'),
  current: () => api.get('/draws/current'),
  simulate: (data) => api.post('/draws/simulate', data),
  publish: (data) => api.post('/draws/publish', data),
};

export const charitiesAPI = {
  list: (params) => api.get('/charities', { params }),
  featured: () => api.get('/charities/featured'),
  get: (id) => api.get(`/charities/${id}`),
  create: (data) => api.post('/charities', data),
  update: (id, data) => api.put(`/charities/${id}`, data),
  delete: (id) => api.delete(`/charities/${id}`),
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/charities/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteImage: (id) => api.delete(`/charities/${id}/image`),
};

export const subscriptionsAPI = {
  create: (data) => api.post('/subscriptions/create', data),
  cancel: () => api.post('/subscriptions/cancel'),
  reactivate: (data) => api.post('/subscriptions/reactivate', data),
  status: () => api.get('/subscriptions/status'),
  contributions: () => api.get('/subscriptions/contributions'),
};

export const winnersAPI = {
  my: () => api.get('/winners/my'),
  list: (params) => api.get('/winners', { params }),
  uploadProof: (id, file) => {
    const fd = new FormData(); fd.append('proof', file);
    return api.post(`/winners/${id}/upload-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  verify: (id, data) => api.put(`/winners/${id}/verify`, data),
  payout: (id) => api.put(`/winners/${id}/payout`),
};

export const adminAPI = {
  users: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  analytics: () => api.get('/admin/analytics'),
  dashboard: () => api.get('/admin/dashboard'),
};

export default api;
