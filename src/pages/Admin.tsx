import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Check, X, History, ToggleLeft, ToggleRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListarProgramas,
  adminCriarPrograma,
  adminAtualizarPrograma,
  adminDeletarPrograma,
  adminRegistrarCotacao,
  adminHistoricoCotacoes,
  type ProgramaAdmin,
  type CotacaoHistorico,
} from "@/lib/api";
import { toast } from "sonner";

const PROGRAM_IATA: Record<string, string> = {
  aeroplan: "AC", aadvantage: "AA", alaska: "AS", smiles: "G3",
  azul: "AD", latam_pass: "LA", united: "UA", emirates: "EK",
  avios_british: "BA", avios_qatar: "QR", avios_iberia: "IB",
  flying_blue: "AF", singapore: "SQ", turkish: "TK", lufthansa: "LH",
  tap: "TP", finnair_plus: "AY", virgin_atlantic: "VS", etihad: "EY", qantas: "QF",
};

// Catálogo de programas conhecidos — usados no modal "Novo Programa"
const PROGRAMAS_CATALOGO = [
  { slug: "smiles",         nome: "Smiles",                  moeda: "BRL" },
  { slug: "latam_pass",     nome: "LATAM Pass",              moeda: "BRL" },
  { slug: "azul",           nome: "Azul Fidelidade",         moeda: "BRL" },
  { slug: "aeroplan",       nome: "Aeroplan",                moeda: "USD" },
  { slug: "aadvantage",     nome: "AAdvantage",              moeda: "USD" },
  { slug: "alaska",         nome: "Alaska Mileage Plan",     moeda: "USD" },
  { slug: "united",         nome: "United MileagePlus",      moeda: "USD" },
  { slug: "avios_british",  nome: "British Airways Avios",   moeda: "GBP" },
  { slug: "avios_iberia",   nome: "Iberia Avios",            moeda: "EUR" },
  { slug: "avios_qatar",    nome: "Qatar Privilege Club",    moeda: "USD" },
  { slug: "flying_blue",    nome: "Flying Blue",             moeda: "EUR" },
  { slug: "emirates",       nome: "Emirates Skywards",       moeda: "USD" },
  { slug: "etihad",         nome: "Etihad Guest",            moeda: "USD" },
  { slug: "singapore",      nome: "KrisFlyer",               moeda: "USD" },
  { slug: "turkish",        nome: "Miles & Smiles",          moeda: "USD" },
  { slug: "lufthansa",      nome: "Miles & More",            moeda: "EUR" },
  { slug: "tap",            nome: "TAP Miles&Go",            moeda: "EUR" },
  { slug: "finnair_plus",   nome: "Finnair Plus",            moeda: "EUR" },
  { slug: "virgin_atlantic",nome: "Virgin Atlantic",         moeda: "GBP" },
  { slug: "qantas",         nome: "Qantas Frequent Flyer",  moeda: "USD" },
];

function AirlineLogo({ slug }: { slug: string }) {
  const iata = PROGRAM_IATA[slug];
  if (!iata) return <span className="text-sm">✈️</span>;
  return (
    <img
      src={`https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`}
      alt={iata}
      className="w-6 h-6 object-contain"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ── Modais ────────────────────────────────────────────────────────────────────

function ModalCotacao({
  programa,
  onClose,
  onSaved,
}: {
  programa: ProgramaAdmin;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [valor, setValor] = useState(programa.cotacao_atual_brl?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<CotacaoHistorico[]>([]);

  useEffect(() => {
    adminHistoricoCotacoes(programa.id)
      .then(setHistorico)
      .catch(() => {});
  }, [programa.id]);

  const salvar = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v <= 0) { toast.error("Valor inválido"); return; }
    setLoading(true);
    try {
      await adminRegistrarCotacao(programa.id, v);
      toast.success("Cotação atualizada!");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao salvar cotação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AirlineLogo slug={programa.slug} />
            <h2 className="font-bold text-foreground">{programa.nome}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Nova cotação (R$ / 1.000 milhas)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: 25,00"
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
              <Button onClick={salvar} disabled={loading} variant="gold" size="sm">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {historico.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <History className="h-3 w-3" /> Histórico
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {historico.map((c) => (
                  <div key={c.id} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                    <span className="text-foreground font-mono">R$ {Number(c.valor_brl).toFixed(2).replace(".", ",")}</span>
                    <span className="text-muted-foreground">{formatDate(c.vigente_desde)}</span>
                    <span className="text-muted-foreground">{c.fonte}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalNovoPrograma({
  onClose,
  onSaved,
  slugsExistentes,
}: {
  onClose: () => void;
  onSaved: () => void;
  slugsExistentes: string[];
}) {
  const [selecionado, setSelecionado] = useState<typeof PROGRAMAS_CATALOGO[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  const disponiveis = PROGRAMAS_CATALOGO.filter(
    (p) => !slugsExistentes.includes(p.slug) &&
      (busca === "" || p.nome.toLowerCase().includes(busca.toLowerCase()))
  );

  const salvar = async () => {
    if (!selecionado) { toast.error("Selecione um programa"); return; }
    setLoading(true);
    try {
      await adminCriarPrograma({
        slug: selecionado.slug,
        nome: selecionado.nome,
        moeda_taxas_default: selecionado.moeda,
      });
      toast.success(`${selecionado.nome} adicionado!`);
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao criar programa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground">Adicionar Programa</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Input
          placeholder="Buscar programa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="mb-3"
        />

        <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {disponiveis.length === 0 && (
            <p className="col-span-2 text-center text-muted-foreground text-sm py-6">
              {busca ? "Nenhum programa encontrado" : "Todos os programas já foram adicionados"}
            </p>
          )}
          {disponiveis.map((p) => {
            const isSel = selecionado?.slug === p.slug;
            return (
              <button
                key={p.slug}
                onClick={() => setSelecionado(isSel ? null : p)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isSel
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <img
                  src={`https://www.gstatic.com/flights/airline_logos/70px/${PROGRAM_IATA[p.slug] || "XX"}.png`}
                  alt={p.slug}
                  className="w-6 h-6 object-contain flex-shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.moeda}</p>
                </div>
                {isSel && <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            variant="gold"
            className="flex-1"
            disabled={!selecionado || loading}
            onClick={salvar}
          >
            <Plus className="h-4 w-4" />
            {selecionado ? `Adicionar ${selecionado.nome}` : "Selecione um programa"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const Admin = () => {
  const navigate = useNavigate();
  const [programas, setProgramas] = useState<ProgramaAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCotacao, setModalCotacao] = useState<ProgramaAdmin | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setProgramas(await adminListarProgramas());
    } catch {
      toast.error("Erro ao carregar programas. Faça login novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/login");
      } else {
        carregar();
      }
    });
  }, [navigate]);

  const toggleAtivo = async (p: ProgramaAdmin) => {
    try {
      const updated = await adminAtualizarPrograma(p.id, { ativo: !p.ativo });
      setProgramas((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      toast.success(updated.ativo ? "Programa ativado" : "Programa desativado");
    } catch {
      toast.error("Erro ao atualizar programa");
    }
  };

  const deletar = async (id: number) => {
    try {
      await adminDeletarPrograma(id);
      setProgramas((prev) => prev.filter((p) => p.id !== id));
      toast.success("Programa removido");
    } catch {
      toast.error("Erro ao remover programa");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Administração</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Cotação do milheiro por programa</p>
            </div>
            <Button variant="gold" onClick={() => setModalNovo(true)}>
              <Plus className="h-4 w-4" /> Novo programa
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Programa</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Slug</th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">R$ / 1.000 pts</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Vigente desde</th>
                    <th className="text-center px-4 py-3 font-semibold text-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {programas.map((p) => (
                    <tr key={p.id} className={`border-b border-border last:border-0 transition-colors hover:bg-muted/20 ${!p.ativo ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-foreground">
                          <AirlineLogo slug={p.slug} />
                          {p.nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.slug}</td>
                      <td className="px-4 py-3 text-right">
                        {p.cotacao_atual_brl != null ? (
                          <span className="font-bold text-foreground">
                            R$ {Number(p.cotacao_atual_brl).toFixed(2).replace(".", ",")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.cotacao_vigente_desde)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleAtivo(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {p.ativo
                            ? <ToggleRight className="h-5 w-5 text-green-500" />
                            : <ToggleLeft className="h-5 w-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setModalCotacao(p)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Atualizar cotação"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {confirmDelete === p.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deletar(p.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Confirmar</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground hover:text-foreground text-xs">Cancelar</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(p.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                              title="Remover programa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {modalCotacao && (
        <ModalCotacao
          programa={modalCotacao}
          onClose={() => setModalCotacao(null)}
          onSaved={carregar}
        />
      )}
      {modalNovo && (
        <ModalNovoPrograma
          onClose={() => setModalNovo(false)}
          onSaved={carregar}
          slugsExistentes={programas.map((p) => p.slug)}
        />
      )}
    </div>
  );
};

export default Admin;
