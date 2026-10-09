const BASE_URL = "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // JSON pour les corps texte ; pour FormData, le navigateur gère l'en-tête lui-même
  const isJson = typeof options.body === "string";
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: isJson ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : "Données invalides";
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const photoUrl = (path: string | null | undefined) => (path ? `${BASE_URL}${path}` : null);

/* ---------- Types ---------- */
export type Cow = {
  id: number;
  ear_tag: string;
  name: string | null;
  breed: string;
  birth_date: string;
  weight: number | null;
  status: string;
  lactation_number: number;
  photo_url: string | null;
};

export type CowInput = Omit<Cow, "id" | "photo_url">;

export type CowPreview = Pick<Cow, "name" | "ear_tag" | "breed" | "photo_url">;

export type Summary = {
  date: string;
  total_cows: number;
  lactating_cows: number;
  milk_today_liters: number;
  expenses_month: number;
  top_cows: (CowPreview & { id: number; liters: number })[];
};

export type ProductionPoint = { date: string; liters: number; cows: number };

export type HealthAlert = CowPreview & {
  date: string;
  event_type: string;
  description: string | null;
  cow_id: number;
};

export type MilkRecord = { id: number; cow_id: number; date: string; quantity_liters: number };

export type CowHealthEvent = { id: number; date: string; event_type: string; description: string | null };

/* ---------- Appels ---------- */
export const api = {
  summary: () => request<Summary>("/stats/summary"),
  production: (days = 30) => request<ProductionPoint[]>(`/stats/production?days=${days}`),
  alerts: () => request<HealthAlert[]>("/stats/alerts"),

  cows: () => request<Cow[]>("/cows/"),
  cow: (id: number) => request<Cow>(`/cows/${id}`),
  createCow: (data: CowInput) => request<Cow>("/cows/", { method: "POST", body: JSON.stringify(data) }),
  updateCow: (id: number, data: Partial<CowInput>) =>
    request<Cow>(`/cows/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCow: (id: number) => request<void>(`/cows/${id}`, { method: "DELETE" }),
  cowHealth: (id: number) => request<CowHealthEvent[]>(`/cows/${id}/health`),

  uploadCowPhoto: (id: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Cow>(`/cows/${id}/photo`, { method: "POST", body });
  },
  deleteCowPhoto: (id: number) => request<Cow>(`/cows/${id}/photo`, { method: "DELETE" }),

  cowMilk: (id: number) => request<MilkRecord[]>(`/milk/?cow_id=${id}`),
  addMilk: (data: Omit<MilkRecord, "id">) =>
    request<MilkRecord>("/milk/", { method: "POST", body: JSON.stringify(data) }),
};