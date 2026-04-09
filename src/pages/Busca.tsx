import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plane } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulated API call — will be replaced by real backend
    await new Promise((r) => setTimeout(r, 800));

    const params = new URLSearchParams({
      origem: form.origem.toUpperCase(),
      destino: form.destino.toUpperCase(),
      dataIda: form.dataIda,
      cabine: form.cabine,
      pax: form.passageiros,
      ...(form.dataVolta ? { dataVolta: form.dataVolta } : {}),
    });

    setLoading(false);
    navigate(`/resultados?${params.toString()}`);
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
