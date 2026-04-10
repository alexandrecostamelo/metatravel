import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plane, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchProgramas, buscarPassagens, type Programa, type BuscaResponse } from "@/lib/api";
import { toast } from "sonner";

const cabines = [
  { value: "economica", label: "Econômica" },
  { value: "premium_economica", label: "Premium Econômica" },
  { value: "executiva", label: "Executiva" },
  { value: "primeira", label: "Primeira" },
];

const Busca = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    origem: "",
    destino: "",
    dataIda: "",
    dataVolta: "",
    cabine: "economica",
    passageiros: "1",
  });
  const [loading, setLoading] = useState(false);

  // Programas from API
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programasLoading, setProgramasLoading] = useState(true);
  const [selProgramas, setSelProgramas] = useState<string[]>([]);

  useEffect(() => {
    fetchProgramas()
      .then((data) => {
        const ativos = data.filter((p) => p.ativo);
        setProgramas(ativos);
        // All selected by default (empty = all on backend)
        setSelProgramas([]);
      })
      .catch(() => {
        toast.error("Não foi possível carregar os programas de milhas.");
      })
      .finally(() => setProgramasLoading(false));
  }, []);

  const togglePrograma = (slug: string) => {
    setSelProgramas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body: any = {
        origem: form.origem.toUpperCase(),
        destino: form.destino.toUpperCase(),
        data_ida: form.dataIda,
        cabine: form.cabine,
        adultos: Number(form.passageiros),
      };
      if (form.dataVolta) body.data_volta = form.dataVolta;
      if (selProgramas.length > 0) body.programas = selProgramas;

      const resultado: BuscaResponse = await buscarPassagens(body);

      navigate("/resultados", {
        state: { resultado },
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar passagens. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl gradient-gold mb-4">
              <Plane className="h-7 w-7 text-gold-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Buscar Passagens em Milhas</h1>
            <p className="text-muted-foreground mt-2">Preencha os dados da sua viagem</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-5 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origem">Origem (IATA)</Label>
                <Input
                  id="origem"
                  placeholder="GRU"
                  maxLength={3}
                  required
                  value={form.origem}
                  onChange={(e) => setForm({ ...form, origem: e.target.value.toUpperCase() })}
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destino">Destino (IATA)</Label>
                <Input
                  id="destino"
                  placeholder="MIA"
                  maxLength={3}
                  required
                  value={form.destino}
                  onChange={(e) => setForm({ ...form, destino: e.target.value.toUpperCase() })}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataIda">Data de ida</Label>
                <Input
                  id="dataIda"
                  type="date"
                  required
                  value={form.dataIda}
                  onChange={(e) => setForm({ ...form, dataIda: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataVolta">Data de volta (opcional)</Label>
                <Input
                  id="dataVolta"
                  type="date"
                  value={form.dataVolta}
                  onChange={(e) => setForm({ ...form, dataVolta: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cabine</Label>
                <Select value={form.cabine} onValueChange={(v) => setForm({ ...form, cabine: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cabines.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Passageiros</Label>
                <Select value={form.passageiros} onValueChange={(v) => setForm({ ...form, passageiros: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 9 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtro de programas */}
            <div className="space-y-3">
              <Label className="font-semibold">Programas de milhas</Label>
              {programasLoading ? (
                <p className="text-sm text-muted-foreground">Carregando programas...</p>
              ) : programas.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Nenhum programa disponível
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {programas.map((p) => (
                    <label key={p.slug} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={selProgramas.length === 0 || selProgramas.includes(p.slug)}
                        onCheckedChange={() => togglePrograma(p.slug)}
                      />
                      <span className="text-foreground">{p.nome}</span>
                      {p.cotacao_milheiro_brl != null && (
                        <span className="text-muted-foreground text-xs">
                          R${Number(p.cotacao_milheiro_brl).toFixed(0)}/mil
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {selProgramas.length === 0 && programas.length > 0 && (
                <p className="text-xs text-muted-foreground">Todos os programas selecionados</p>
              )}
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-gold-foreground/30 border-t-gold-foreground rounded-full animate-spin" />
                  Buscando...
                </span>
              ) : (
                <>
                  <Search className="h-5 w-5" /> Buscar
                </>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Busca;
