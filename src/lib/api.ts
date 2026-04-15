import { supabase } from "@/integrations/supabase/client";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export interface Programa {
  slug: string;
  nome: string;
  cotacao_milheiro_brl: number | null;
  ativo: boolean;
}

export interface Oferta {
  origem: string;
  destino: string;
  data_ida: string;
  data_volta: string | null;
  cia_aerea: string;
  cabine: string;
  paradas: number;
  duracao_minutos: number | null;
  programa: string;
  milhas: number;
  taxas_moeda: string;
  taxas_valor: number;
  taxas_brl: number | null;
  cotacao_milheiro_brl: number | null;
  custo_total_brl: number | null;
  link_reserva: string | null;
  fonte: string;
  atualizado_em: string;
  // Campos CPM (Duffel)
  preco_cash_brl: number | null;
  preco_cash_moeda: string | null;
  valor_milha_brl: number | null;
  valor_milheiro_brl: number | null;
  economia_brl: number | null;
  economia_percentual: number | null;
  qualidade_resgate: string | null;
}

export interface BuscaResponse {
  origem: string;
  destino: string;
  data_ida: string;
  data_volta: string | null;
  cabine: string;
  total: number;
  cache_hit: boolean;
  ofertas: Oferta[];
}

export interface BuscaRequest {
  origem: string;
  destino: string;
  data_ida: string;
  data_volta?: string;
  cabine: string;
  adultos?: number;
  programas?: string[];
}

export async function fetchProgramas(): Promise<Programa[]> {
  const res = await fetch(`${API_BASE}/programas`);
  if (!res.ok) throw new Error("Erro ao carregar programas");
  return res.json();
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface ProgramaAdmin {
  id: number;
  slug: string;
  nome: string;
  moeda_taxas_default: string;
  ativo: boolean;
  cotacao_atual_brl: number | null;
  cotacao_vigente_desde: string | null;
}

export interface CotacaoHistorico {
  id: number;
  programa_id: number;
  valor_brl: number;
  vigente_desde: string;
  fonte: string;
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
}

// ── Trips ─────────────────────────────────────────────────────────────────────

export interface Segmento {
  origem: string;
  destino: string;
  partida: string | null;
  chegada: string | null;
  numero_voo: string | null;
  duracao_minutos: number | null;
  layover_minutos?: number | null;
  escala: boolean;
  aeronave?: string | null;
}

export interface Trip {
  id: string;
  origem: string;
  destino: string;
  data: string;
  cabine: string;
  milhas: number;
  taxas_valor: number;
  taxas_moeda: string;
  paradas: number;
  duracao_minutos: number | null;
  segmentos: Segmento[];
  link_reserva: string | null;
  assentos?: number | null;
  airlines?: string[];
  carriers?: Record<string, string>;
  source?: string | null;
  distancia_milhas?: number | null;
  direto?: boolean;
  booking_links?: { label: string; link: string; primary: boolean }[];
}

export async function fetchTrips(
  origem: string,
  destino: string,
  data: string,
  cabine: string,
  programa: string,
): Promise<Trip[]> {
  const params = new URLSearchParams({ origem, destino, data, cabine, programa });
  const res = await fetch(`${API_BASE}/trips?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function adminListarProgramas(): Promise<ProgramaAdmin[]> {
  const res = await adminFetch("/admin/programas");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export async function adminCriarPrograma(body: { slug: string; nome: string; moeda_taxas_default?: string }): Promise<ProgramaAdmin> {
  const res = await adminFetch("/admin/programas", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminAtualizarPrograma(id: number, body: { nome?: string; ativo?: boolean }): Promise<ProgramaAdmin> {
  const res = await adminFetch(`/admin/programas/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminDeletarPrograma(id: number): Promise<void> {
  const res = await adminFetch(`/admin/programas/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function adminRegistrarCotacao(programaId: number, valorBrl: number): Promise<CotacaoHistorico> {
  const res = await adminFetch(`/admin/programas/${programaId}/cotacao`, {
    method: "POST",
    body: JSON.stringify({ valor_brl: valorBrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminHistoricoCotacoes(programaId: number): Promise<CotacaoHistorico[]> {
  const res = await adminFetch(`/admin/programas/${programaId}/cotacoes`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function buscarPassagens(body: BuscaRequest): Promise<BuscaResponse> {
  const authHeaders = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${API_BASE}/busca`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `Erro ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("A busca demorou demais. Tente novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
