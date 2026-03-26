import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "/api";

export function getApiUrl(): string {
  return BASE_URL;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("auth_token");
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body: any) => apiFetch(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path: string, body: any) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => apiFetch(path, { method: "DELETE" }),
};
