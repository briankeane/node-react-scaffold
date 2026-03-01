import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_BASE_URL || "http://localhost:10020",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function healthCheck() {
  return api.get("/v1/healthCheck");
}

export default api;
