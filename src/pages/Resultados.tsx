import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, SearchX } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { BuscaResponse, Oferta } from "@/lib/api";

const paradasLabel = (p: number) => (p === 0 ? "Direto" : p === 1 ? "1 parada" : `${p} paradas`);

const formatBRL = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const cabineLabel: Record<string, string> = {
  economica: "Econômica",
  premium_economica: "Premium Econômica",
  executiva: "Executiva",
  primeira: "Primeira",
};

const Resultados = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const resultado: BuscaResponse | undefined = location.state?.resultado;

  const ofertas = useMemo(() => {
    if (!resultado) return [];
    return [...resultado.ofertas].sort(
      (a, b) => (a.custo_total_brl ?? Infinity) - (b.custo_total_brl ?? Infinity)
    );
  }, [resultado]);

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

  const dataFormatada = new Date(resultado.data_ida + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/busca")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {resultado.origem} → {resultado.destino}
            </h1>
            <p className="text-muted-foreground mt-1">
              {dataFormatada} · {cabineLabel[resultado.cabine] ?? resultado.cabine} · {resultado.total} oferta{resultado.total !== 1 ? "s" : ""} encontrada{resultado.total !== 1 ? "s" : ""}
            </p>
            {resultado.cache_hit && (
              <span className="inline-block mt-2 text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                Resultado em cache
              </span>
            )}
          </div>

          {/* Empty state */}
          {resultado.total === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Nenhuma oferta encontrada para esta rota</p>
              <p className="text-muted-foreground text-sm mt-1">Tente alterar datas, cabine ou programas.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/busca")}>
                Nova busca
              </Button>
            </div>
          ) : (
            /* Results table */
            <div className="overflow-x-auto">
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
                    {ofertas.map((o, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${idx === 0 ? "bg-gold/5" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{o.programa}</td>
                        <td className="px-4 py-3 text-muted-foreground">{o.cia_aerea}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{paradasLabel(o.paradas)}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {o.milhas.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatBRL(o.taxas_brl)}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground text-base">
                          {formatBRL(o.custo_total_brl)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {o.link_reserva ? (
                            <a href={o.link_reserva} target="_blank" rel="noopener noreferrer">
                              <Button variant="gold" size="sm">
                                Reservar <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              Indisponível
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Resultados;
