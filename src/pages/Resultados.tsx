import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, SearchX, Info, X, ExternalLink } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { BuscaResponse, Oferta } from "@/lib/api";

const CABINES_ORDER = ["economica", "premium_economica", "executiva", "primeira"] as const;
type Cabine = typeof CABINES_ORDER[number];

const CABINE_LABELS: Record<Cabine, string> = {
  economica: "Econômica",
  premium_economica: "Premium",
  executiva: "Executiva",
  primeira: "Primeira",
};

const PROGRAM_NAMES: Record<string, string> = {
  aeroplan: "Aeroplan",
  aadvantage: "American",
  alaska: "Alaska",
  smiles: "Smiles",
  azul: "Azul",
  latam_pass: "LATAM Pass",
  united: "United",
  emirates: "Emirates",
  avios_british: "British Airways",
  avios_qatar: "Qatar Airways",
  avios_iberia: "Iberia",
  flying_blue: "Flying Blue",
  singapore: "Singapore",
  turkish: "Turkish",
  lufthansa: "Lufthansa",
  tap: "TAP",
  finnair_plus: "Finnair",
  virgin_atlantic: "Virgin Atlantic",
  etihad: "Etihad",
  qantas: "Qantas",
};

const PROGRAM_IATA: Record<string, string> = {
  aeroplan: "AC",
  aadvantage: "AA",
  alaska: "AS",
  smiles: "G3",
  azul: "AD",
  latam_pass: "LA",
  united: "UA",
  emirates: "EK",
  avios_british: "BA",
  avios_qatar: "QR",
  avios_iberia: "IB",
  flying_blue: "AF",
  singapore: "SQ",
  turkish: "TK",
  lufthansa: "LH",
  tap: "TP",
  finnair_plus: "AY",
  virgin_atlantic: "VS",
  etihad: "EY",
  qantas: "QF",
};

const AIRPORT_CITIES: Record<string, string> = {
  GRU: "São Paulo", CGH: "São Paulo", VCP: "Campinas",
  GIG: "Rio de Janeiro", SDU: "Rio de Janeiro",
  BSB: "Brasília", SSA: "Salvador", REC: "Recife",
  FOR: "Fortaleza", BEL: "Belém", MAO: "Manaus",
  CWB: "Curitiba", POA: "Porto Alegre", FLN: "Florianópolis",
  MIA: "Miami", JFK: "Nova York", LAX: "Los Angeles",
  LHR: "Londres", CDG: "Paris", AMS: "Amsterdam",
  FRA: "Frankfurt", MAD: "Madri", LIS: "Lisboa",
  DXB: "Dubai", DOH: "Doha", SIN: "Singapura",
  NRT: "Tóquio", PEK: "Pequim", SYD: "Sydney",
};

function cityName(iata: string): string {
  return AIRPORT_CITIES[iata] || iata;
}

function AirlineLogo({ programa, size = "sm" }: { programa: string; size?: "sm" | "lg" }) {
  const iata = PROGRAM_IATA[programa];
  if (!iata) return <span className="text-base">✈️</span>;
  const cls = size === "lg" ? "inline-block w-8 h-8 object-contain" : "inline-block w-6 h-6 object-contain";
  return (
    <img
      src={`https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`}
      alt={iata}
      className={cls}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

type CabineInfo = {
  milhas: number;
  paradas: number;
  link_reserva: string | null;
  taxas_brl: number | null;
  custo_total_brl: number | null;
};

type ResultRow = {
  key: string;
  data_ida: string;
  atualizado_em: string;
  programa: string;
  origem: string;
  destino: string;
  cabines: Partial<Record<string, CabineInfo>>;
};

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

function groupOfertas(ofertas: Oferta[]): ResultRow[] {
  const map = new Map<string, ResultRow>();
  for (const o of ofertas) {
    const key = `${o.data_ida}|${o.programa}|${o.origem}|${o.destino}`;
    if (!map.has(key)) {
      map.set(key, { key, data_ida: o.data_ida, atualizado_em: o.atualizado_em, programa: o.programa, origem: o.origem, destino: o.destino, cabines: {} });
    }
    const row = map.get(key)!;
    row.cabines[o.cabine] = {
      milhas: o.milhas,
      paradas: o.paradas,
      link_reserva: o.link_reserva,
      taxas_brl: o.taxas_brl,
      custo_total_brl: o.custo_total_brl,
    };
    if (o.atualizado_em > row.atualizado_em) row.atualizado_em = o.atualizado_em;
  }
  return Array.from(map.values());
}

function DetailModal({ row, onClose }: { row: ResultRow; onClose: () => void }) {
  const nome = PROGRAM_NAMES[row.programa] || row.programa;
  const availableCabines = CABINES_ORDER.filter((c) => row.cabines[c]);
  const [activeCabine, setActiveCabine] = useState<string>(availableCabines[0] || "economica");
  const info = row.cabines[activeCabine];
  const dataFmt = new Date(row.data_ida + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative bg-card border-l border-border shadow-2xl h-full w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs text-muted-foreground capitalize">
                {dataFmt} · Visto {formatRelativeTime(row.atualizado_em)}
              </p>
              <h2 className="text-lg font-bold text-foreground mt-0.5">
                {cityName(row.origem)} → {cityName(row.destino)}
              </h2>
              <p className="text-sm text-muted-foreground">{row.origem} → {row.destino}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Book link */}
          {info?.link_reserva && (
            <a
              href={info.link_reserva}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:underline mt-2"
            >
              <AirlineLogo programa={row.programa} size="sm" />
              Reservar via {nome}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Cabin tabs */}
        <div className="flex border-b border-border">
          {CABINES_ORDER.map((c) => {
            const has = !!row.cabines[c];
            return (
              <button
                key={c}
                onClick={() => has && setActiveCabine(c)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                  activeCabine === c
                    ? "border-primary text-foreground"
                    : has
                    ? "border-transparent text-muted-foreground hover:text-foreground"
                    : "border-transparent text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                {CABINE_LABELS[c as Cabine]}
              </button>
            );
          })}
        </div>

        {/* Cabin detail */}
        <div className="p-4">
          {info ? (
            <div className="space-y-4">
              {/* Main info card */}
              <div className="bg-muted/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {info.milhas.toLocaleString("pt-BR")} pts
                  </p>
                  {info.taxas_brl != null && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      + {formatBRL(info.taxas_brl)} em taxas
                    </p>
                  )}
                  {info.custo_total_brl != null && (
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Total: {formatBRL(info.custo_total_brl)}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold text-white ${info.paradas === 0 ? "bg-green-600" : "bg-blue-600"}`}>
                  {info.paradas === 0 ? "Direto" : `${info.paradas} parada${info.paradas > 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Route visual */}
              <div className="flex items-center gap-3 px-1">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{row.origem}</p>
                  <p className="text-xs text-muted-foreground">{cityName(row.origem)}</p>
                </div>
                <div className="flex-1 flex items-center gap-1">
                  <div className="h-px flex-1 bg-border"></div>
                  <AirlineLogo programa={row.programa} size="sm" />
                  <div className="h-px flex-1 bg-border"></div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{row.destino}</p>
                  <p className="text-xs text-muted-foreground">{cityName(row.destino)}</p>
                </div>
              </div>

              {/* Booking button */}
              {info.link_reserva ? (
                <a href={info.link_reserva} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="gold" className="w-full">
                    <ExternalLink className="h-4 w-4" />
                    Ver opções de reserva — {nome}
                  </Button>
                </a>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Link de reserva indisponível
                </Button>
              )}

              {/* All cabins summary */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Outras cabines</p>
                <div className="grid grid-cols-2 gap-2">
                  {CABINES_ORDER.filter((c) => c !== activeCabine).map((c) => {
                    const ci = row.cabines[c];
                    return (
                      <button
                        key={c}
                        onClick={() => ci && setActiveCabine(c)}
                        className={`rounded-lg border p-3 text-left transition-colors ${ci ? "border-border hover:border-primary cursor-pointer" : "border-border/50 opacity-40 cursor-not-allowed"}`}
                      >
                        <p className="text-xs text-muted-foreground">{CABINE_LABELS[c as Cabine]}</p>
                        {ci ? (
                          <p className="text-sm font-bold text-foreground mt-0.5">
                            {ci.milhas.toLocaleString("pt-BR")} pts
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-0.5">Indisponível</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Selecione uma cabine disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 25;

const Resultados = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const resultado: BuscaResponse | undefined = location.state?.resultado;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);

  const rows = useMemo(() => {
    if (!resultado) return [];
    return groupOfertas(resultado.ofertas);
  }, [resultado]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.programa.toLowerCase().includes(q) ||
        (PROGRAM_NAMES[r.programa] || r.programa).toLowerCase().includes(q) ||
        r.origem.toLowerCase().includes(q) ||
        r.destino.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!resultado) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-24 pb-12 flex items-center justify-center">
          <div className="text-center space-y-4">
            <SearchX className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nenhum resultado para exibir.</p>
            <Button variant="outline" onClick={() => navigate("/busca")}>
              <ArrowLeft className="h-4 w-4" /> Nova busca
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-4">
            <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/busca")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {resultado.origem} → {resultado.destino}
            </h1>
            <p className="text-muted-foreground mt-1">
              {new Date(resultado.data_ida + "T00:00:00").toLocaleDateString("pt-BR")}
              {" · "}
              {resultado.total} oferta{resultado.total !== 1 ? "s" : ""}
              {resultado.cache_hit && (
                <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">cache</span>
              )}
            </p>
          </div>

          {resultado.total === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Nenhuma oferta encontrada</p>
              <p className="text-muted-foreground text-sm mt-1">Tente alterar datas, cabine ou programas.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/busca")}>Nova busca</Button>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  Mostrando {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </p>
                <input
                  type="text"
                  placeholder="Buscar programa, origem..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="border border-border rounded px-3 py-1.5 text-sm bg-background text-foreground w-56 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Data</th>
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Última Viz.</th>
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Programa</th>
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Origem</th>
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Destino</th>
                        {CABINES_ORDER.map((c) => (
                          <th key={c} className="text-center px-3 py-3 font-semibold text-foreground">
                            {CABINE_LABELS[c]}
                          </th>
                        ))}
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((row) => {
                        const nome = PROGRAM_NAMES[row.programa] || row.programa;
                        return (
                          <tr
                            key={row.key}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
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
                            {CABINES_ORDER.map((cabine) => {
                              const info = row.cabines[cabine];
                              return (
                                <td key={cabine} className="px-3 py-3 text-center">
                                  {info ? (
                                    <div className="inline-flex flex-col items-center gap-0.5">
                                      {info.link_reserva ? (
                                        <a href={info.link_reserva} target="_blank" rel="noopener noreferrer">
                                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold text-white cursor-pointer transition-opacity hover:opacity-80 ${info.paradas === 0 ? "bg-green-600" : "bg-blue-600"}`}>
                                            {info.milhas.toLocaleString("pt-BR")} pts
                                          </span>
                                        </a>
                                      ) : (
                                        <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold text-white ${info.paradas === 0 ? "bg-green-600" : "bg-blue-600"}`}>
                                          {info.milhas.toLocaleString("pt-BR")} pts
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {formatBRL(info.custo_total_brl)}
                                      </span>
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
                              <button
                                onClick={() => setSelectedRow(row)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
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

              {/* Footer: legend + pagination */}
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-8 h-5 rounded bg-green-600"></span>
                    Voo direto
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-8 h-5 rounded bg-blue-600"></span>
                    Voo com conexão
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
        </div>
      </main>
      <Footer />

      {/* Detail modal */}
      {selectedRow && (
        <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
};

export default Resultados;
