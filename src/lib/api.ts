import { supabase } from "@/integrations/supabase/client";

const API_BASE = "/api";

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
