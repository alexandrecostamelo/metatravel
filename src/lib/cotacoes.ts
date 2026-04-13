import { useState, useEffect } from "react";

export interface Cotacoes {
  USD: number;
  EUR: number;
  GBP: number;
  CAD: number;
  atualizado_em: Date;
}

// Module-level cache so all components share one fetch
let _cached: Cotacoes | null = null;
let _fetchPromise: Promise<Cotacoes> | null = null;

async function _fetchAPI(): Promise<Cotacoes> {
  const res = await fetch(
    "https://economia.awesomeapi.com.br/json/last/USD-BRLT,EUR-BRLT,GBP-BRLT,CAD-BRLT"
  );
  if (!res.ok) throw new Error("Erro ao buscar cotações");
  const data = await res.json();
  return {
    USD: parseFloat(data.USDBRLT?.bid || "0"),
    EUR: parseFloat(data.EURBRLT?.bid || "0"),
    GBP: parseFloat(data.GBPBRLT?.bid || "0"),
    CAD: parseFloat(data.CADBRLT?.bid || "0"),
    atualizado_em: new Date(),
  };
}

/** Returns turismo BRL exchange rates. Cached for 15 minutes. */
export function useCotacoes(): { cotacoes: Cotacoes | null; loading: boolean } {
  const [cotacoes, setCotacoes] = useState<Cotacoes | null>(_cached);
  const [loading, setLoading] = useState(!_cached);

  useEffect(() => {
    if (_cached) {
      const age = Date.now() - _cached.atualizado_em.getTime();
      if (age < 15 * 60 * 1000) return; // still fresh
    }

    if (!_fetchPromise) {
      _fetchPromise = _fetchAPI().finally(() => { _fetchPromise = null; });
    }

    setLoading(true);
    _fetchPromise
      .then((c) => { _cached = c; setCotacoes(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { cotacoes, loading };
}

/**
 * Convert a foreign-currency amount to BRL using turismo rates.
 * Returns null if rates aren't loaded or currency is unsupported.
 */
export function converterParaBRL(
  valor: number,
  moeda: string,
  cotacoes: Cotacoes | null
): number | null {
  if (!cotacoes || valor === 0) return null;
  const key = moeda.toUpperCase() as keyof Pick<Cotacoes, "USD" | "EUR" | "GBP" | "CAD">;
  const rate = cotacoes[key];
  if (!rate) return null;
  return valor * rate;
}
