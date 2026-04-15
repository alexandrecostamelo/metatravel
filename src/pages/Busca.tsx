import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown, Clock, ExternalLink, Info, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { BuscaResponse, Oferta, Trip } from "@/lib/api";
import { buscarPassagens, fetchTrips } from "@/lib/api";
import { converterParaBRL, useCotacoes } from "@/lib/cotacoes";
import type { Cotacoes } from "@/lib/cotacoes";

// ─── Constants ───────────────────────────────────────────────────────────────

const CABINES_ORDER = ["economica", "premium_economica", "executiva", "primeira"] as const;
type Cabine = typeof CABINES_ORDER[number];
const CABINE_LABELS: Record<Cabine, string> = {
  economica: "Econômica",
  premium_economica: "Premium",
  executiva: "Executiva",
  primeira: "Primeira",
};

const PROGRAM_NAMES: Record<string, string> = {
  aeroplan: "Aeroplan", aadvantage: "American", alaska: "Alaska", smiles: "Smiles",
  azul: "Azul", latam_pass: "LATAM Pass", united: "United", delta: "Delta SkyMiles",
  emirates: "Emirates", avios_british: "British Airways", avios_qatar: "Qatar Airways",
  avios_iberia: "Iberia", flying_blue: "Flying Blue", singapore: "Singapore",
  turkish: "Turkish", lufthansa: "Lufthansa", tap: "TAP", finnair_plus: "Finnair",
  virgin_atlantic: "Virgin Atlantic", etihad: "Etihad", qantas: "Qantas",
};

const PROGRAM_IATA: Record<string, string> = {
  aeroplan: "AC", aadvantage: "AA", alaska: "AS", smiles: "G3", azul: "AD",
  latam_pass: "LA", united: "UA", delta: "DL", emirates: "EK", avios_british: "BA",
  avios_qatar: "QR", avios_iberia: "IB", flying_blue: "AF", singapore: "SQ",
  turkish: "TK", lufthansa: "LH", tap: "TP", finnair_plus: "AY",
  virgin_atlantic: "VS", etihad: "EY", qantas: "QF",
};

const LABEL_TO_SLUG: Record<string, string> = {
  "aeroplan": "aeroplan", "air canada aeroplan": "aeroplan",
  "american": "aadvantage", "american airlines aadvantage": "aadvantage",
  "alaska": "alaska", "alaska mileage plan": "alaska", "alaska atmos rewards": "alaska",
  "smiles": "smiles", "azul": "azul", "latam pass": "latam_pass", "latam": "latam_pass",
  "united": "united", "united mileageplus": "united",
  "delta": "delta", "delta skymiles": "delta",
  "emirates": "emirates", "emirates skywards": "emirates",
  "british airways": "avios_british", "british airways avios": "avios_british", "british airways club": "avios_british",
  "qatar airways": "avios_qatar", "qatar airways privilege club": "avios_qatar",
  "iberia": "avios_iberia",
  "air france-klm flying blue": "flying_blue", "flying blue": "flying_blue", "air france": "flying_blue",
  "singapore airlines krisflyer": "singapore", "singapore": "singapore",
  "turkish airlines miles&smiles": "turkish", "turkish": "turkish",
  "lufthansa miles & more": "lufthansa", "lufthansa": "lufthansa",
  "tap miles&go": "tap", "tap": "tap",
  "finnair plus": "finnair_plus", "finnair": "finnair_plus", "finnair plus (must login)": "finnair_plus",
  "virgin atlantic flying club": "virgin_atlantic", "virgin atlantic": "virgin_atlantic",
  "etihad guest": "etihad", "etihad": "etihad",
  "qantas frequent flyer": "qantas", "qantas": "qantas",
};

function labelToProgSlug(label: string): string | null {
  const cleaned = label.replace(/^Book via /i, "").toLowerCase().trim();
  if (LABEL_TO_SLUG[cleaned]) return LABEL_TO_SLUG[cleaned];
  for (const [key, slug] of Object.entries(LABEL_TO_SLUG)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return slug;
  }
  return null;
}

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PAGE_SIZE = 25;

// ─── Types ───────────────────────────────────────────────────────────────────

type CabineInfo = {
  milhas: number; paradas: number; link_reserva: string | null;
  taxas_brl: number | null; taxas_valor: number; taxas_moeda: string;
  custo_total_brl: number | null;
  preco_cash_brl: number | null;
  valor_milheiro_brl: number | null;
  economia_percentual: number | null;
  qualidade_resgate: string | null;
};

type ResultRow = {
  key: string; data_ida: string; atualizado_em: string;
  programa: string; origem: string; destino: string;
  cabines: Partial<Record<string, CabineInfo>>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

function formatBRL(v: number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return "R$ " + n.toFixed(2).replace(".", ",");
}

function formatMilhas(m: number): string {
  if (m >= 1000) {
    const k = m / 1000;
    return (k % 1 === 0 ? k.toString() : k.toFixed(1)) + "k pts";
  }
  return m + " pts";
}

function formatDuration(mins: number | null): string {
  if (!mins) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}

function flightIata(num: string | null): string | null {
  if (!num) return null;
  const m = num.match(/^([A-Z0-9]{2})\d/);
  return m ? m[1] : null;
}

function layoverMinutes(arr: string, dep: string): number {
  const [ah, am] = arr.split(":").map(Number);
  const [dh, dm] = dep.split(":").map(Number);
  let diff = dh * 60 + dm - (ah * 60 + am);
  if (diff <= 0) diff += 1440;
  return diff;
}

function groupOfertas(ofertas: Oferta[]): ResultRow[] {
  const map = new Map<string, ResultRow>();
  for (const o of ofertas) {
    const key = `${o.data_ida}|${o.programa}|${o.origem}|${o.destino}`;
    if (!map.has(key)) {
      map.set(key, { key, data_ida: o.data_ida, atualizado_em: o.atualizado_em, programa: o.programa, origem: o.origem, destino: o.destino, cabines: {} });
    }
    const row = map.get(key)!;
    row.cabines[o.cabine] = {
      milhas: o.milhas, paradas: o.paradas, link_reserva: o.link_reserva,
      taxas_brl: o.taxas_brl, taxas_valor: o.taxas_valor,
      taxas_moeda: o.taxas_moeda, custo_total_brl: o.custo_total_brl,
      preco_cash_brl: o.preco_cash_brl ?? null,
      valor_milheiro_brl: o.valor_milheiro_brl ?? null,
      economia_percentual: o.economia_percentual ?? null,
      qualidade_resgate: o.qualidade_resgate ?? null,
    };
    if (o.atualizado_em > row.atualizado_em) row.atualizado_em = o.atualizado_em;
  }
  return Array.from(map.values());
}

// ─── renderTotal ─────────────────────────────────────────────────────────────

function computeTotalBrl(info: CabineInfo, cotacoes: Cotacoes | null): number | null {
  if (info.custo_total_brl == null) return null;
  const milhasBrl = Number(info.custo_total_brl) - Number(info.taxas_brl ?? 0);
  const taxasValor = Number(info.taxas_valor);
  const isEstrangeira = info.taxas_moeda !== "BRL" && taxasValor > 0;
  let taxasBrlFinal = Number(info.taxas_brl ?? 0);
  if (isEstrangeira) {
    const converted = converterParaBRL(taxasValor, info.taxas_moeda, cotacoes);
    if (converted != null) taxasBrlFinal = converted;
  }
  return milhasBrl + taxasBrlFinal;
}

function renderTotal(info: CabineInfo, cotacoes: Cotacoes | null): React.ReactNode {
  const milhasBrl = Number(info.custo_total_brl) - Number(info.taxas_brl ?? 0);
  const taxasValor = Number(info.taxas_valor);
  const isEstrangeira = info.taxas_moeda !== "BRL" && taxasValor > 0;
  let taxasBrlFinal = Number(info.taxas_brl ?? 0);
  let isAproximado = false;
  if (isEstrangeira) {
    const converted = converterParaBRL(taxasValor, info.taxas_moeda, cotacoes);
    if (converted != null) { taxasBrlFinal = converted; isAproximado = true; }
  }
  const total = milhasBrl + taxasBrlFinal;
  const hasTaxa = taxasValor > 0;
  const tooltipContent = (
    <div className="space-y-1 text-xs">
      {isEstrangeira && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Taxa original:</span>
          <span className="font-medium">{info.taxas_moeda} {taxasValor.toFixed(2).replace(".", ",")}</span>
        </div>
      )}
      {hasTaxa && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Taxa em R$:</span>
          <span className="font-medium">{formatBRL(taxasBrlFinal)}</span>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Passagem:</span>
        <span className="font-medium">{formatBRL(milhasBrl)}</span>
      </div>
      {isAproximado && (
        <p className="text-[10px] text-muted-foreground/60 pt-0.5 border-t border-border">valores aproximados</p>
      )}
    </div>
  );
  if (hasTaxa) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help inline-flex items-center gap-0.5 font-bold text-green-600 dark:text-green-400">
            {formatBRL(total)}
            {isAproximado && <span className="text-[10px] opacity-60 font-normal">≈</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipContent}</TooltipContent>
      </Tooltip>
    );
  }
  return <span className="font-bold text-green-600 dark:text-green-400">{formatBRL(total)}</span>;
}

// ─── IATAChipInput ────────────────────────────────────────────────────────────

interface Airport { iata: string; name: string; city: string; country: string; }
const API_BASE = import.meta.env.VITE_API_URL ?? "";
async function fetchAirports(q: string): Promise<Airport[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API_BASE}/api/airports?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

function IATAChipInput({
  label, values, onChange, placeholder = "Ex: GRU",
}: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [inputVal, setInputVal] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputVal.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await fetchAirports(inputVal);
      setResults(data);
      setLoading(false);
      setShowDropdown(data.length > 0);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputVal]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addIata = (iata: string) => {
    const upper = iata.toUpperCase().trim();
    if (upper.length >= 3 && !values.includes(upper)) {
      onChange([...values, upper]);
    }
    setInputVal("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputVal.trim()) {
      e.preventDefault();
      if (results.length > 0) {
        addIata(results[0].iata);
      } else if (inputVal.trim().length === 3) {
        addIata(inputVal.trim());
      }
    } else if (e.key === "Backspace" && !inputVal && values.length) {
      onChange(values.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div
        className="flex flex-wrap gap-1 items-center border border-border rounded-lg px-2 py-1 min-w-[180px] min-h-[38px] bg-background cursor-text focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v) => (
          <span key={v} className="flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 text-xs font-mono font-semibold">
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)); }}
              className="ml-0.5 hover:text-destructive transition-colors leading-none"
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value.toUpperCase()); setShowDropdown(true); }}
          onKeyDown={handleKey}
          onFocus={() => { if (results.length) setShowDropdown(true); }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="outline-none bg-transparent text-sm min-w-[60px] flex-1 font-mono uppercase"
        />
      </div>
      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border rounded-xl shadow-lg w-80 overflow-hidden">
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum aeroporto encontrado.</div>
          ) : (
            <ul className="max-h-52 overflow-y-auto">
              {results.map((a) => (
                <li
                  key={a.iata}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                  onMouseDown={(e) => { e.preventDefault(); addIata(a.iata); }}
                >
                  <span className="font-mono font-bold text-primary w-10 shrink-0">{a.iata}</span>
                  <span className="truncate text-foreground">{a.name} — {a.city}, {a.country}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Logos ────────────────────────────────────────────────────────────────────

function AirlineLogo({ programa, size = "sm" }: { programa: string; size?: "sm" | "lg" }) {
  const iata = PROGRAM_IATA[programa];
  if (!iata) return <span className="text-base">✈️</span>;
  const cls = size === "lg" ? "w-8 h-8 object-contain" : "w-6 h-6 object-contain";
  return (
    <img src={`https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`} alt={iata} className={cls}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
  );
}

function SegmentLogo({ iata }: { iata: string | null }) {
  if (!iata) return <span className="text-base">✈</span>;
  return (
    <img src={`https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`} alt={iata}
      className="w-6 h-6 object-contain"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
  );
}

// ─── TripCard ─────────────────────────────────────────────────────────────────

function TripCard({
  trip, nome, programa, allRows, activeCabine, cotacoes,
}: {
  trip: Trip; nome: string; programa: string;
  allRows: ResultRow[]; activeCabine: string; cotacoes: Cotacoes | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [extraInfo, setExtraInfo] = useState<Record<string, { milhas: number; taxas_valor: number; taxas_moeda: string } | null>>({});
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (!showBooking || !trip.booking_links?.length) return;
    const missing = trip.booking_links
      .map((bl) => labelToProgSlug(bl.label))
      .filter((slug): slug is string =>
        !!slug && !allRows.find((r) => r.programa === slug) && !(slug in extraInfo)
      );
    if (!missing.length) return;
    setLoadingExtra(true);
    Promise.all(
      missing.map((slug) =>
        fetchTrips(trip.origem, trip.destino, trip.data, activeCabine, slug)
          .then((trips) => trips.length > 0
            ? [slug, { milhas: trips[0].milhas, taxas_valor: trips[0].taxas_valor, taxas_moeda: trips[0].taxas_moeda }] as const
            : [slug, null] as const)
          .catch(() => [slug, null] as const)
      )
    ).then((results) => {
      setExtraInfo((prev) => { const next = { ...prev }; for (const [s, d] of results) next[s] = d; return next; });
      setLoadingExtra(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBooking]);

  const firstSeg = trip.segmentos[0];
  const lastSeg = trip.segmentos[trip.segmentos.length - 1];
  const depTime = firstSeg?.partida || null;
  const arrTime = lastSeg?.chegada || null;
  const nextDay = !!(depTime && arrTime && arrTime < depTime);
  const firstFlightNum = firstSeg?.numero_voo || null;
  const hasSegDetails = trip.segmentos.length > 0 && !!(depTime || firstFlightNum);
  const isDireto = trip.direto || trip.paradas === 0;

  const operatingIatas: string[] = trip.airlines?.length
    ? trip.airlines
    : [...new Set(trip.segmentos.map((s) => flightIata(s.numero_voo)).filter(Boolean) as string[])];

  const taxasStr = Number(trip.taxas_valor) > 0
    ? (trip.taxas_moeda === "BRL"
        ? `R$ ${Number(trip.taxas_valor).toFixed(2).replace(".", ",")}`
        : `${trip.taxas_moeda} ${Number(trip.taxas_valor).toFixed(2)}`)
    : null;

  const currentRowInfo = allRows
    .find((r) => r.programa === programa && r.origem === trip.origem && r.destino === trip.destino)
    ?.cabines[activeCabine] ?? null;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 py-3.5">
        {/* Logos */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center gap-0.5">
          {operatingIatas.length > 0
            ? operatingIatas.slice(0, 2).map((iata) => <SegmentLogo key={iata} iata={iata} />)
            : <AirlineLogo programa={programa} />}
        </div>

        {/* Flight info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm text-foreground">
              {depTime && <span>{depTime} </span>}
              {trip.origem} → {trip.destino}
              {arrTime && <span> {arrTime}</span>}
            </span>
            {nextDay && <span className="text-xs text-orange-500 font-semibold">+1d</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {firstFlightNum && <span className="font-mono">{firstFlightNum}</span>}
            {trip.duracao_minutos && (
              <>{firstFlightNum && <span className="opacity-40">|</span>}
                <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{formatDuration(trip.duracao_minutos)}</span>
              </>
            )}
            {!hasSegDetails && trip.distancia_milhas && (
              <><span className="opacity-40">|</span><span>{trip.distancia_milhas.toLocaleString("en-US")} mi</span></>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 border border-blue-300 dark:border-blue-700 rounded px-2.5 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
              <Info className="h-3 w-3" /> Detalhes {expanded ? "▲" : "▼"}
            </button>
            {trip.link_reserva && (
              <a href={trip.link_reserva} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-2.5 py-0.5 transition-colors">
                <ExternalLink className="h-3 w-3" /> Reservar via {nome}
              </a>
            )}
            {trip.booking_links && trip.booking_links.length > 1 && (
              <button onClick={() => setShowBooking(!showBooking)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-2.5 py-0.5 hover:bg-muted transition-colors">
                Opções de reserva {showBooking ? "▲" : "▼"}
              </button>
            )}
          </div>
        </div>

        {/* Cost */}
        <div className="flex-shrink-0 text-right space-y-0.5 min-w-[96px]">
          <p className="font-bold text-sm text-foreground">{formatMilhas(trip.milhas)}</p>
          {taxasStr && <p className="text-xs text-muted-foreground">+ {taxasStr}</p>}
          {currentRowInfo?.custo_total_brl != null && (
            <div className="text-sm">{renderTotal(currentRowInfo, cotacoes)}</div>
          )}
          {trip.assentos != null && (
            <p className="text-xs text-muted-foreground">T, {trip.assentos} assento{trip.assentos !== 1 ? "s" : ""}</p>
          )}
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded text-white ${isDireto ? "bg-green-600" : "bg-blue-500"}`}>
            {isDireto ? "Direto" : "Conexão"}
          </span>
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="ml-12 mb-3 rounded-lg border border-border/60 bg-muted/20 overflow-hidden text-xs">
          {trip.segmentos.length > 0 ? (
            trip.segmentos.map((seg, i) => {
              const segIata = flightIata(seg.numero_voo);
              const nextSeg = trip.segmentos[i + 1];
              const isLast = i === trip.segmentos.length - 1;
              const layoverMins = seg.layover_minutos ??
                (seg.chegada && nextSeg?.partida ? layoverMinutes(seg.chegada, nextSeg.partida) : null);
              return (
                <div key={i}>
                  <div className="px-4 py-3">
                    {(seg.partida || seg.chegada) && (
                      <div className="flex items-baseline gap-1 mb-1 font-bold text-sm text-foreground">
                        {seg.partida && <span>{seg.partida}</span>}
                        <span className="text-muted-foreground font-normal">{seg.origem} → {seg.destino}</span>
                        {seg.chegada && <span>{seg.chegada}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                      <SegmentLogo iata={segIata} />
                      {seg.numero_voo && <span className="font-mono text-foreground font-medium">{seg.numero_voo}</span>}
                      {seg.duracao_minutos && (
                        <><span className="opacity-40">|</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{formatDuration(seg.duracao_minutos)}</span>
                        </>
                      )}
                      {i === 0 && trip.distancia_milhas && (
                        <><span className="opacity-40">|</span><span>{trip.distancia_milhas.toLocaleString("en-US")} mi</span></>
                      )}
                      {seg.aeronave && <><span className="opacity-40">|</span><span>✈ {seg.aeronave}</span></>}
                    </div>
                  </div>
                  {!isLast && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50 border-y border-border/40 text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="text-[11px]">
                        {layoverMins ? `${formatDuration(layoverMins)} de escala em ${seg.destino}` : `Escala em ${seg.destino}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">CIA operadora</span>
                <div className="flex items-center gap-1.5">
                  {operatingIatas.length > 0
                    ? operatingIatas.map((iata) => (
                        <span key={iata} className="flex items-center gap-1">
                          <SegmentLogo iata={iata} /><span className="font-mono font-medium">{iata}</span>
                        </span>
                      ))
                    : <span className="text-muted-foreground">—</span>}
                </div>
              </div>
              {trip.distancia_milhas && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-24">Distância</span>
                  <span className="font-medium">{trip.distancia_milhas.toLocaleString("en-US")} milhas</span>
                </div>
              )}
              {trip.assentos != null && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-24">Assentos</span>
                  <span className="font-medium">{trip.assentos}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Tipo</span>
                <span className={`font-semibold ${isDireto ? "text-green-600" : "text-blue-500"}`}>
                  {isDireto ? "Voo direto" : "Com conexão"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Opções de reserva */}
      {showBooking && trip.booking_links && trip.booking_links.length > 0 && (
        <div className="ml-12 mb-3 rounded-lg border border-border/60 overflow-hidden text-xs">
          {trip.booking_links.map((bl, i) => {
            const cleanLabel = bl.label.replace(/^Book via /i, "");
            const slug = labelToProgSlug(bl.label);
            const iata = slug ? PROGRAM_IATA[slug] : null;
            const matchedRow = slug ? allRows.find((r) => r.programa === slug && r.origem === trip.origem && r.destino === trip.destino) : null;
            const rowInfo = matchedRow?.cabines[activeCabine] ?? null;
            const fallback = slug ? extraInfo[slug] : null;
            const milhasVal = rowInfo?.milhas ?? fallback?.milhas;
            const taxasValorVal = rowInfo?.taxas_valor ?? fallback?.taxas_valor;
            const taxasMoedaVal = rowInfo?.taxas_moeda ?? fallback?.taxas_moeda;
            const hasData = milhasVal != null;
            const taxasStrBl = hasData && Number(taxasValorVal) > 0
              ? (taxasMoedaVal === "BRL" ? `R$ ${Number(taxasValorVal).toFixed(2).replace(".", ",")}` : `${taxasMoedaVal} ${Number(taxasValorVal).toFixed(2)}`)
              : null;
            const isPending = !hasData && loadingExtra && slug != null && !(slug in extraInfo);
            if (!isPending && !hasData && slug && slug in extraInfo) return null;
            return (
              <a key={i} href={bl.link} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors ${i > 0 ? "border-t border-border/40" : ""} ${bl.primary ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {iata ? (
                    <img src={`https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`} alt={iata}
                      className="w-6 h-6 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : <span className="text-base">✈</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${bl.primary ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
                    {cleanLabel}
                    {bl.primary && <span className="ml-1.5 text-[10px] text-blue-500 font-normal">· principal</span>}
                  </span>
                  {isPending ? (
                    <div className="mt-0.5"><span className="inline-block w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" /></div>
                  ) : hasData ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                      <span>{formatMilhas(milhasVal!)}</span>
                      {taxasStrBl && <><span className="opacity-40">+</span><span>{taxasStrBl}</span></>}
                    </div>
                  ) : null}
                </div>
                <div className="flex-shrink-0 text-right">
                  {hasData && rowInfo?.custo_total_brl != null && (
                    <span className="text-sm">{renderTotal(rowInfo, cotacoes)}</span>
                  )}
                  {(!hasData || rowInfo?.custo_total_brl == null) && !isPending && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DetailModal ──────────────────────────────────────────────────────────────

function DetailModal({
  row, onClose, allRows, cotacoes,
}: {
  row: ResultRow; onClose: () => void; allRows: ResultRow[]; cotacoes: Cotacoes | null;
}) {
  const nome = PROGRAM_NAMES[row.programa] || row.programa;
  const availableCabines = CABINES_ORDER.filter((c) => row.cabines[c]);
  const [activeCabine, setActiveCabine] = useState<string>(availableCabines[0] || "economica");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const dataFmtShort = new Date(row.data_ida + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });

  useEffect(() => {
    setLoadingTrips(true);
    setTrips([]);
    fetchTrips(row.origem, row.destino, row.data_ida, activeCabine, row.programa)
      .then(setTrips)
      .finally(() => setLoadingTrips(false));
  }, [row.origem, row.destino, row.data_ida, activeCabine, row.programa]);

  const info = row.cabines[activeCabine];
  const bookingLink = trips.find((t) => t.link_reserva)?.link_reserva || info?.link_reserva || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative bg-card border border-border shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground capitalize">
            {dataFmtShort} · Visto {formatRelativeTime(row.atualizado_em)}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pt-3 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-2xl font-bold text-foreground">{row.origem} → {row.destino}</h2>
          {bookingLink ? (
            <a href={bookingLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-500 font-medium hover:underline mt-1.5">
              Reservar via <span className="font-bold">{nome}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground mt-1.5">via {nome}</p>
          )}
        </div>
        <div className="flex border-b border-border flex-shrink-0">
          {CABINES_ORDER.map((c) => {
            const has = !!row.cabines[c];
            return (
              <button key={c} onClick={() => has && setActiveCabine(c)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                  activeCabine === c ? "border-primary text-foreground"
                    : has ? "border-transparent text-muted-foreground hover:text-foreground"
                    : "border-transparent text-muted-foreground/30 cursor-not-allowed"}`}>
                {CABINE_LABELS[c as Cabine]}
                {has && row.cabines[c] && (
                  <span className="block text-[10px] font-normal mt-0.5">{formatMilhas(row.cabines[c]!.milhas)}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingTrips ? (
            <div className="flex items-center justify-center py-12">
              <span className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : trips.length > 0 ? (
            <div className="px-4">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} nome={nome} programa={row.programa}
                  allRows={allRows} activeCabine={activeCabine} cotacoes={cotacoes} />
              ))}
            </div>
          ) : info ? (
            <div className="p-4">
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xl font-bold text-foreground">{formatMilhas(info.milhas)}</p>
                    {info.taxas_brl != null && (
                      <p className="text-sm text-muted-foreground mt-0.5">+ {formatBRL(info.taxas_brl)} em taxas</p>
                    )}
                    {info.custo_total_brl != null && (
                      <p className="text-sm mt-0.5">Total: {renderTotal(info, cotacoes)}</p>
                    )}
                    {info.valor_milheiro_brl != null && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${
                          info.qualidade_resgate === "excelente" ? "bg-green-600" :
                          info.qualidade_resgate === "bom" ? "bg-blue-500" :
                          info.qualidade_resgate === "ok" ? "bg-amber-500" : "bg-red-500"
                        }`}>
                          {info.qualidade_resgate}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          R${Number(info.valor_milheiro_brl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mil milhas
                        </span>
                        {info.economia_percentual != null && info.economia_percentual > 0 && (
                          <span className="text-sm text-green-600 font-medium">↓{Number(info.economia_percentual).toFixed(1)}% vs cash</span>
                        )}
                      </div>
                    )}
                    {info.preco_cash_brl != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Preço em dinheiro: {formatBRL(info.preco_cash_brl)}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded text-xs font-bold text-white ${info.paradas === 0 ? "bg-green-600" : "bg-blue-500"}`}>
                    {info.paradas === 0 ? "Direto" : `${info.paradas} parada${info.paradas > 1 ? "s" : ""}`}
                  </span>
                </div>
                {info.link_reserva ? (
                  <a href={info.link_reserva} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" /> Reservar via {nome}
                    </Button>
                  </a>
                ) : (
                  <Button variant="outline" className="w-full" disabled>Link indisponível</Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum voo encontrado para esta cabine.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter components ────────────────────────────────────────────────────────

function FilterChip({
  label, active, open, onToggle, children,
}: {
  label: string; active: boolean; open: boolean;
  onToggle: (e: React.MouseEvent) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          active
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-background border-border text-foreground hover:bg-muted"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 opacity-70" />
        {label}
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-3 min-w-[220px]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Recent searches ─────────────────────────────────────────────────────────

const CABINE_SHORT: Record<string, string> = {
  economica: "Eco", premium_economica: "Prem", executiva: "Exec", primeira: "1ª",
};

const RANGE_OPTIONS = [0, 1, 3, 7, 15, 30, 60] as const;

function gerarDatas(dataBase: string, range: number): string[] {
  const base = new Date(dataBase + "T00:00:00");
  const datas: string[] = [];
  for (let i = -range; i <= range; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    datas.push(d.toISOString().slice(0, 10));
  }
  return datas;
}

type SavedSearch = { origens: string[]; destinos: string[]; dataIda: string; cabines: string[]; range?: number };

const LS_KEY = "mt_recent_searches";
const MAX_RECENTES = 3;

function loadRecentes(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveRecente(s: SavedSearch) {
  const prev = loadRecentes().filter(
    (r) => !(r.origens.join() === s.origens.join() && r.destinos.join() === s.destinos.join() &&
             r.dataIda === s.dataIda && r.cabines.slice().sort().join() === s.cabines.slice().sort().join())
  );
  localStorage.setItem(LS_KEY, JSON.stringify([s, ...prev].slice(0, MAX_RECENTES)));
}

function formatRecenteLabel(s: SavedSearch): string {
  const date = s.dataIda ? new Date(s.dataIda + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
  const cabs = s.cabines.length === CABINES_ORDER.length ? "Todas" : s.cabines.map((c) => CABINE_SHORT[c] || c).join(", ");
  const rng = s.range ? `  ·  ±${s.range}d` : "";
  return `${s.origens.join(", ")} → ${s.destinos.join(", ")}  ·  ${date}${rng}  ·  ${cabs}`;
}

// ─── Main Busca page ──────────────────────────────────────────────────────────

const Busca = () => {
  // Search form
  const [origens, setOrigens] = useState<string[]>([]);
  const [destinos, setDestinos] = useState<string[]>([]);
  const [dataIda, setDataIda] = useState("");
  const [cabines, setCabines] = useState<string[]>(["economica"]);
  const [range, setRange] = useState(0);
  const [showCabineRange, setShowCabineRange] = useState(false);
  const cabineRangeRef = useRef<HTMLDivElement>(null);

  // Recent searches
  const [recentes, setRecentes] = useState<SavedSearch[]>([]);
  const [showRecentes, setShowRecentes] = useState(false);
  const recentesRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setRecentes(loadRecentes()); }, []);

  useEffect(() => {
    if (!showRecentes) return;
    const handler = (e: MouseEvent) => {
      if (recentesRef.current && !recentesRef.current.contains(e.target as Node)) {
        setShowRecentes(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRecentes]);

  // Results
  const [resultado, setResultado] = useState<BuscaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterProgramas, setFilterProgramas] = useState<string[]>([]);
  const [filterMaxPontos, setFilterMaxPontos] = useState(0);
  const [filterDias, setFilterDias] = useState<number[]>([]);
  const [openFilter, setOpenFilter] = useState<"programas" | "pontos" | "dias" | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [page, setPage] = useState(1);

  type SortCol = "data" | "atualizado" | "programa" | "origem" | "destino" | Cabine;
  const [sortCol, setSortCol] = useState<SortCol>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  // Modal
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);

  // Cotacoes
  const { cotacoes } = useCotacoes();

  // Rows
  const rows = useMemo(() => resultado ? groupOfertas(resultado.ofertas) : [], [resultado]);

  const maxPontosData = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const info of Object.values(row.cabines)) {
        if (info && info.milhas > max) max = info.milhas;
      }
    }
    return max || 500000;
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filterProgramas.length) r = r.filter((row) => filterProgramas.includes(row.programa));
    if (filterMaxPontos > 0) {
      r = r.filter((row) => Object.values(row.cabines).some((info) => info && info.milhas <= filterMaxPontos));
    }
    if (filterDias.length) {
      r = r.filter((row) => filterDias.includes(new Date(row.data_ida + "T00:00:00").getDay()));
    }
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      r = r.filter((row) =>
        row.programa.toLowerCase().includes(q) ||
        (PROGRAM_NAMES[row.programa] || "").toLowerCase().includes(q) ||
        row.origem.toLowerCase().includes(q) ||
        row.destino.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filterProgramas, filterMaxPontos, filterDias, tableSearch]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case "data":       return dir * a.data_ida.localeCompare(b.data_ida);
        case "atualizado": return dir * a.atualizado_em.localeCompare(b.atualizado_em);
        case "programa":   return dir * (PROGRAM_NAMES[a.programa] || a.programa).localeCompare(PROGRAM_NAMES[b.programa] || b.programa);
        case "origem":     return dir * a.origem.localeCompare(b.origem);
        case "destino":    return dir * a.destino.localeCompare(b.destino);
        default: {
          const aInfo = a.cabines[sortCol];
          const bInfo = b.cabines[sortCol];
          const av = aInfo ? computeTotalBrl(aInfo, cotacoes) : null;
          const bv = bInfo ? computeTotalBrl(bInfo, cotacoes) : null;
          // linhas sem valor ficam sempre no final, independente da direção
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return dir * (av - bv);
        }
      }
    });
  }, [filtered, sortCol, sortDir, cotacoes]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Fecha o dropdown cabine/range ao clicar fora
  useEffect(() => {
    if (!showCabineRange) return;
    const handler = (e: MouseEvent) => {
      if (cabineRangeRef.current && !cabineRangeRef.current.contains(e.target as Node)) {
        setShowCabineRange(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCabineRange]);

  // Close filter on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-filter]")) setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilter]);

  const handleBuscar = async (overrides?: Partial<SavedSearch>) => {
    const _origens = overrides?.origens ?? origens;
    const _destinos = overrides?.destinos ?? destinos;
    const _dataIda = overrides?.dataIda ?? dataIda;
    const _cabines = overrides?.cabines ?? cabines;
    const _range = overrides?.range ?? range;
    if (!_origens.length || !_destinos.length || !_dataIda || !_cabines.length) return;
    setLoading(true);
    setError(null);
    setResultado(null);
    setPage(1);
    setFilterProgramas([]);
    setFilterMaxPontos(0);
    setFilterDias([]);
    setTableSearch("");

    try {
      const datas = gerarDatas(_dataIda, _range);
      const combos = _origens.flatMap((o) =>
        _destinos.flatMap((d) =>
          _cabines.flatMap((c) => datas.map((dt) => [o, d, c, dt] as [string, string, string, string]))
        )
      );
      const settled = await Promise.allSettled(
        combos.map(([o, d, c, dt]) => buscarPassagens({ origem: o, destino: d, data_ida: dt, cabine: c }))
      );
      const results = settled
        .filter((r): r is PromiseFulfilledResult<BuscaResponse> => r.status === "fulfilled")
        .map((r) => r.value);
      if (results.length === 0) {
        const firstErr = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstErr?.reason?.message || "Erro ao buscar passagens.");
      }
      const combined: BuscaResponse = {
        origem: _origens.join(","),
        destino: _destinos.join(","),
        data_ida: _dataIda,
        data_volta: null,
        cabine: _cabines[0],
        total: results.reduce((s, r) => s + r.total, 0),
        ofertas: results.flatMap((r) => r.ofertas),
        cache_hit: results.every((r) => r.cache_hit),
      };
      setResultado(combined);
      saveRecente({ origens: _origens, destinos: _destinos, dataIda: _dataIda, cabines: _cabines, range: _range });
      setRecentes(loadRecentes());
    } catch (err: any) {
      setError(err.message || "Erro ao buscar passagens. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const canSearch = origens.length > 0 && destinos.length > 0 && !!dataIda && cabines.length > 0 && !loading;


  const applyRecente = (s: SavedSearch) => {
    setOrigens(s.origens);
    setDestinos(s.destinos);
    setDataIda(s.dataIda);
    setCabines(s.cabines);
    setRange(s.range ?? 0);
    setShowRecentes(false);
    handleBuscar(s);
  };

  // Unique programs in results for filter
  const programasNoResult = useMemo(() => [...new Set(rows.map((r) => r.programa))], [rows]);

  const filtersActive =
    filterProgramas.length > 0 || filterMaxPontos > 0 || filterDias.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background pt-24">
      <Navbar />

      {/* ── Sticky search bar ── */}
      <div className="sticky top-24 z-[49] bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-end gap-2 flex-wrap">
            <IATAChipInput label="Aeroportos de Origem" values={origens} onChange={setOrigens} placeholder="GRU" />

            <button
              type="button"
              onClick={() => { setOrigens(destinos); setDestinos(origens); }}
              className="mb-0.5 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground border border-border"
              title="Inverter rota"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>

            <IATAChipInput label="Aeroportos de Destino" values={destinos} onChange={setDestinos} placeholder="MIA" />

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data de Partida</label>
              <input
                type="date"
                value={dataIda}
                onChange={(e) => setDataIda(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleBuscar(); }}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring h-[38px]"
              />
            </div>

            {/* Cabine + Intervalo — dropdown compacto */}
            <div className="space-y-1 relative" ref={cabineRangeRef}>
              <label className="text-xs font-medium text-muted-foreground">Cabine / Intervalo</label>
              <button
                type="button"
                onClick={() => setShowCabineRange((v) => !v)}
                className="flex items-center justify-between gap-2 h-[38px] px-3 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors min-w-[160px]"
              >
                <span className="truncate text-xs">
                  {cabines.length === CABINES_ORDER.length ? "Todas" : cabines.map((c) => CABINE_SHORT[c]).join(", ")}
                  {range > 0 && <span className="text-muted-foreground ml-1">· ±{range}d</span>}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${showCabineRange ? "rotate-180" : ""}`} />
              </button>

              {showCabineRange && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-3 w-56 space-y-3">
                  {/* Cabines */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Cabine</p>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold mb-1">
                      <input
                        type="checkbox"
                        checked={cabines.length === CABINES_ORDER.length}
                        ref={(el) => {
                          if (el) el.indeterminate = cabines.length > 0 && cabines.length < CABINES_ORDER.length;
                        }}
                        onChange={() =>
                          setCabines(cabines.length === CABINES_ORDER.length ? ["economica"] : [...CABINES_ORDER])
                        }
                        className="w-3.5 h-3.5 accent-primary"
                      />
                      Marcar todas
                    </label>
                    <div className="space-y-1 pl-0.5">
                      {CABINES_ORDER.map((c) => (
                        <label key={c} className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={cabines.includes(c)}
                            onChange={() => {
                              setCabines((prev) =>
                                prev.includes(c)
                                  ? prev.length > 1 ? prev.filter((x) => x !== c) : prev
                                  : [...prev, c]
                              );
                            }}
                            className="w-3.5 h-3.5 accent-blue-600"
                          />
                          {CABINE_LABELS[c as Cabine]}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Intervalo */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Intervalo de datas</p>
                    <div className="flex flex-wrap gap-1">
                      {RANGE_OPTIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRange(r)}
                          className={`px-2 py-1 rounded-md border text-xs font-semibold transition-colors ${
                            range === r
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {r === 0 ? "Exato" : `±${r}d`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              id="btn-buscar"
              onClick={() => handleBuscar()}
              disabled={!canSearch}
              className="h-[38px] bg-blue-600 hover:bg-blue-700 text-white gap-2 self-end"
            >
              {loading
                ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Search className="h-4 w-4" />}
              Buscar
            </Button>

            {/* Recentes */}
            {recentes.length > 0 && (
              <div className="relative self-end" ref={recentesRef}>
                <button
                  type="button"
                  onClick={() => setShowRecentes((v) => !v)}
                  className="h-[38px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  Recentes
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRecentes ? "rotate-180" : ""}`} />
                </button>
                {showRecentes && (
                  <div className="absolute top-full mt-1 right-0 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[340px]">
                    {recentes.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyRecente(s)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border/50 last:border-0"
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">{formatRecenteLabel(s)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 container mx-auto px-4 py-5">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Buscando disponibilidade em todos os programas...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-destructive/10 text-destructive border border-destructive/30 rounded-xl p-4 text-sm flex items-center gap-2 mt-2">
            <X className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {resultado && !loading && (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm text-muted-foreground mr-1">
                {resultado.total} oferta{resultado.total !== 1 ? "s" : ""}
                {resultado.cache_hit && <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded">cache</span>}
              </span>

              {/* Programas */}
              <div data-filter="programas">
                <FilterChip
                  label={filterProgramas.length ? `Programas (${filterProgramas.length})` : "Programas"}
                  active={filterProgramas.length > 0}
                  open={openFilter === "programas"}
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter((f) => f === "programas" ? null : "programas"); }}
                >
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setFilterProgramas([])}
                    >
                      Limpar seleção
                    </button>
                    {programasNoResult.map((slug) => (
                      <label key={slug} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={filterProgramas.length === 0 || filterProgramas.includes(slug)}
                          onChange={() => {
                            setFilterProgramas((prev) => {
                              const all = programasNoResult;
                              const current = prev.length === 0 ? all : prev;
                              if (current.includes(slug)) return current.filter((s) => s !== slug);
                              return [...current, slug];
                            });
                          }}
                        />
                        <AirlineLogo programa={slug} size="sm" />
                        <span>{PROGRAM_NAMES[slug] || slug}</span>
                      </label>
                    ))}
                  </div>
                </FilterChip>
              </div>

              {/* Pontos */}
              <div data-filter="pontos">
                <FilterChip
                  label={filterMaxPontos > 0 ? `Pontos (até ${formatMilhas(filterMaxPontos)})` : "Pontos"}
                  active={filterMaxPontos > 0}
                  open={openFilter === "pontos"}
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter((f) => f === "pontos" ? null : "pontos"); }}
                >
                  <div className="space-y-3 w-56">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Máximo de pontos</span>
                      <span className="font-semibold text-foreground">
                        {filterMaxPontos > 0 ? formatMilhas(filterMaxPontos) : "Sem limite"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxPontosData}
                      step={Math.max(1000, Math.floor(maxPontosData / 100))}
                      value={filterMaxPontos || maxPontosData}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setFilterMaxPontos(v >= maxPontosData ? 0 : v);
                      }}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0</span><span>{formatMilhas(maxPontosData)}</span>
                    </div>
                    {filterMaxPontos > 0 && (
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => setFilterMaxPontos(0)}>
                        Remover filtro
                      </button>
                    )}
                  </div>
                </FilterChip>
              </div>

              {/* Dias */}
              <div data-filter="dias">
                <FilterChip
                  label={filterDias.length ? `Dias (${filterDias.length})` : "Dias"}
                  active={filterDias.length > 0}
                  open={openFilter === "dias"}
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter((f) => f === "dias" ? null : "dias"); }}
                >
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">Dias da semana</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {DIAS_PT.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => setFilterDias((prev) =>
                            prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                          )}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            filterDias.includes(i)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    {filterDias.length > 0 && (
                      <button className="text-xs text-blue-600 hover:underline mt-1" onClick={() => setFilterDias([])}>
                        Limpar
                      </button>
                    )}
                  </div>
                </FilterChip>
              </div>

              {filtersActive && (
                <button
                  onClick={() => { setFilterProgramas([]); setFilterMaxPontos(0); setFilterDias([]); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpar filtros
                </button>
              )}

              <div className="ml-auto">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={tableSearch}
                  onChange={(e) => { setTableSearch(e.target.value); setPage(1); }}
                  className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground w-40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <SearchX className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium">Nenhuma oferta encontrada</p>
                <p className="text-muted-foreground text-sm mt-1">Tente alterar filtros, datas ou programas.</p>
                {filtersActive && (
                  <button
                    onClick={() => { setFilterProgramas([]); setFilterMaxPontos(0); setFilterDias([]); }}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Remover todos os filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          {(
                            [
                              { col: "data" as SortCol,      label: "Data",        align: "left"   },
                              { col: "atualizado" as SortCol, label: "Última Viz.", align: "left"   },
                              { col: "programa" as SortCol,  label: "Programa",    align: "left"   },
                              { col: "origem" as SortCol,    label: "Origem",      align: "left"   },
                              { col: "destino" as SortCol,   label: "Destino",     align: "left"   },
                              ...CABINES_ORDER.map((c) => ({ col: c as SortCol, label: CABINE_LABELS[c as Cabine], align: "center" })),
                            ] as { col: SortCol; label: string; align: string }[]
                          ).map(({ col, label, align }) => (
                            <th
                              key={col}
                              onClick={() => handleSort(col)}
                              className={`px-4 py-3 font-semibold text-foreground cursor-pointer select-none hover:bg-muted/80 transition-colors ${align === "center" ? "text-center px-3" : "text-left"}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {label}
                                <span className="text-muted-foreground/60 text-[10px]">
                                  {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                                </span>
                              </span>
                            </th>
                          ))}
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((row) => {
                          const nome = PROGRAM_NAMES[row.programa] || row.programa;
                          return (
                            <tr key={row.key} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-foreground whitespace-nowrap">
                                {new Date(row.data_ida + "T00:00:00").toLocaleDateString("pt-BR")}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                {formatRelativeTime(row.atualizado_em)}
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                                <span className="inline-flex items-center gap-2">
                                  <AirlineLogo programa={row.programa} />
                                  {nome}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-blue-500">{row.origem}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-blue-500">{row.destino}</td>
                              {CABINES_ORDER.map((cabineCol) => {
                                const info = row.cabines[cabineCol];
                                return (
                                  <td key={cabineCol} className="px-3 py-3 text-center">
                                    {info ? (
                                      <div className="inline-flex flex-col items-center gap-0.5">
                                        {info.link_reserva ? (
                                          <a href={info.link_reserva} target="_blank" rel="noopener noreferrer">
                                            <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold text-white cursor-pointer hover:opacity-80 transition-opacity ${info.paradas === 0 ? "bg-green-600" : "bg-blue-600"}`}>
                                              {info.milhas.toLocaleString("pt-BR")} pts
                                            </span>
                                          </a>
                                        ) : (
                                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold text-white ${info.paradas === 0 ? "bg-green-600" : "bg-blue-600"}`}>
                                            {info.milhas.toLocaleString("pt-BR")} pts
                                          </span>
                                        )}
                                        {info.custo_total_brl != null && (
                                          <div className="text-sm mt-0.5">{renderTotal(info, cotacoes)}</div>
                                        )}
                                        {info.valor_milheiro_brl != null && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${
                                              info.qualidade_resgate === "excelente" ? "bg-green-600" :
                                              info.qualidade_resgate === "bom" ? "bg-blue-500" :
                                              info.qualidade_resgate === "ok" ? "bg-amber-500" : "bg-red-500"
                                            }`}>
                                              {info.qualidade_resgate}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                              R${Number(info.valor_milheiro_brl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mil
                                            </span>
                                          </div>
                                        )}
                                        {info.economia_percentual != null && info.economia_percentual > 0 && (
                                          <span className="text-[10px] text-green-600 font-medium">
                                            ↓{Number(info.economia_percentual).toFixed(1)}% vs cash
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-muted text-muted-foreground">
                                        Indisponível
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-3 text-center">
                                <button onClick={() => setSelectedRow(row)}
                                  className="text-muted-foreground hover:text-foreground transition-colors">
                                  <Info className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-8 h-5 rounded bg-green-600" /> Voo direto
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-8 h-5 rounded bg-blue-600" /> Com conexão
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>«</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
                    <span className="px-3 py-1 text-sm font-medium bg-primary text-primary-foreground rounded">{page}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</Button>
                    <span className="text-sm text-muted-foreground ml-1">/ {totalPages}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {!resultado && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Search className="h-14 w-14 text-muted-foreground/20 mb-5" />
            <p className="text-lg font-semibold text-foreground">Busque passagens com milhas</p>
            <p className="text-muted-foreground text-sm mt-1">Digite a origem, destino e data acima para ver disponibilidade</p>
          </div>
        )}
      </main>

      <Footer />

      {selectedRow && (
        <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} allRows={rows} cotacoes={cotacoes} />
      )}
    </div>
  );
};

export default Busca;
