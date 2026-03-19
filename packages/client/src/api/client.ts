import axios from "axios";
import type { ApiResponse } from "@emp-billing/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => { if (err.response?.status === 401) { localStorage.clear(); window.location.href = "/login"; } return Promise.reject(err); }
);

export async function apiGet<T>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> { return (await api.get<ApiResponse<T>>(url, { params })).data; }
export async function apiPost<T>(url: string, body?: any): Promise<ApiResponse<T>> { return (await api.post<ApiResponse<T>>(url, body)).data; }
export async function apiPut<T>(url: string, body?: any): Promise<ApiResponse<T>> { return (await api.put<ApiResponse<T>>(url, body)).data; }
export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> { return (await api.delete<ApiResponse<T>>(url)).data; }
