import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_SERVER_BASE_URL || 'http://localhost:10020';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const headers = authHeaders();
  Object.assign(config.headers, headers);
  return config;
});

export async function healthCheck() {
  const response = await api.get('/v1/healthCheck');
  return response.data;
}

export default api;
