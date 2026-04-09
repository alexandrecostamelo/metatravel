import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { gerarMockResultados, type OfertaVoo } from "@/lib/mockResults";

const paradasLabel = (p: number) => (p === 0 ? "Direto" : p === 1 ? "1 parada" : `${p} paradas`);

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Resultados = () => {
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") ?? "";
  const destino = searchParams.get("destino") ?? "";
  const dataIda = searchParams.get("dataIda") ?? "";

  const [ofertas] = useState<OfertaVoo[]>(() => gerarMockResultados());

  // Filters
  const programas = useMemo(() => [...new Set(ofertas.map((o) => o.programaSlug))], [ofertas]);
  const [selProgramas, setSelProgramas] = useState<string[]>(programas);
  const [maxParadas, setMaxParadas] = useState<number | null>(null);
  const [orcamentoMax, setOrcamentoMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let r = ofertas.filter((o) => selProgramas.includes(o.programaSlug));
    if (maxParadas !== null) r = r.filter((o) => o.paradas <= maxParadas);
    if (orcamentoMax) r = r.filter((o) => o.custoTotal <= Number(orcamentoMax));
    return r.sort((a, b) => a.custoTotal - b.custoTotal);
  }, [ofertas, selProgramas, maxParadas, orcamentoMax]);

  const togglePrograma = (slug: string) => {
    setSelProgramas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const cotacaoInfo = ofertas[0];
  const dataFormatada = dataIda
    ? new Date(dataIda + "T00:00:00").toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {origem} → {destino}
            </h1>
            <p className="text-muted-foreground mt-1">
              {dataFormatada} · {filtered.length} ofertas encontradas
            </p>
            {cotacaoInfo && (
              <div className="mt-3 bg-gold/10 border border-gold/20 rounded-lg px-4 py-2 inline-block">
                <span className="text-sm text-foreground">
                  Cotação aplicada: a partir de <strong>{formatBRL(15)}</strong>/milheiro — atualizada em{" "}
                  {new Date().toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters - mobile toggle */}
            <div className="lg:hidden">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4" /> Filtros
              </Button>
            </div>

            {/* Sidebar filters */}
            <aside className={`${showFilters ? "block" : "hidden"} lg:block lg:w-64 shrink-0 space-y-6`}>
              <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Programas</h3>
                  <div className="space-y-2">
                    {programas.map((slug) => {
                      const oferta = ofertas.find((o) => o.programaSlug === slug);
                      return (
                        <label key={slug} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selProgramas.includes(slug)}
                            onCheckedChange={() => togglePrograma(slug)}
                          />
                          <span className="text-sm text-foreground">{oferta?.programa}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-3">Paradas</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Todas", value: null },
                      { label: "Direto", value: 0 },
                      { label: "Até 1", value: 1 },
                      { label: "Até 2", value: 2 },
                    ].map((opt) => (
                      <label key={opt.label} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paradas"
                          checked={maxParadas === opt.value}
                          onChange={() => setMaxParadas(opt.value)}
                          className="accent-gold"
                        />
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">Orçamento máximo (R$)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 3000"
                    className="mt-2"
                    value={orcamentoMax}
                    onChange={(e) => setOrcamentoMax(e.target.value)}
                  />
                </div>
              </div>
            </aside>

            {/* Results table */}
            <div className="flex-1 overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <p className="text-muted-foreground">Nenhuma oferta encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Programa</th>
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Cia</th>
                        <th className="text-center px-4 py-3 font-semibold text-foreground">Paradas</th>
                        <th className="text-right px-4 py-3 font-semibold text-foreground">Milhas</th>
                        <th className="text-right px-4 py-3 font-semibold text-foreground">Taxas</th>
                        <th className="text-right px-4 py-3 font-semibold text-foreground">Custo Total</th>
                        <th className="text-center px-4 py-3 font-semibold text-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o, idx) => (
                        <tr
                          key={o.id}
                          className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${idx === 0 ? "bg-gold/5" : ""}`}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">{o.programa}</td>
                          <td className="px-4 py-3 text-muted-foreground">{o.companhia}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{paradasLabel(o.paradas)}</td>
                          <td className="px-4 py-3 text-right font-mono text-foreground">
                            {o.milhas.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatBRL(o.taxas)}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{formatBRL(o.custoTotal)}</td>
                          <td className="px-4 py-3 text-center">
                            <a href={o.link} target="_blank" rel="noopener noreferrer">
                              <Button variant="gold" size="sm">
                                Reservar <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Resultados;
