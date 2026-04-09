import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, History } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface BuscaLog {
  id: number;
  origem: string;
  destino: string;
  data_ida: string;
  data_volta: string | null;
  cabine: string;
  total_ofertas: number;
  criado_em: string;
}

const cabineLabel: Record<string, string> = {
  economica: "Econômica",
  premium_economica: "Premium Econômica",
  executiva: "Executiva",
  primeira: "Primeira",
};

const Historico = () => {
  const navigate = useNavigate();
  const [buscas, setBuscas] = useState<BuscaLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para ver seu histórico.");
        navigate("/login");
        return;
      }
      const { data, error } = await supabase
        .from("buscas_log")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) toast.error(error.message);
      else setBuscas((data as BuscaLog[]) ?? []);
      setLoading(false);
    };
    check();
  }, [navigate]);

  const refazer = (b: BuscaLog) => {
    const params = new URLSearchParams({
      origem: b.origem,
      destino: b.destino,
      dataIda: b.data_ida,
      cabine: b.cabine,
      ...(b.data_volta ? { dataVolta: b.data_volta } : {}),
    });
    navigate(`/busca?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <History className="h-7 w-7 text-gold" />
            <h1 className="text-2xl font-bold text-foreground">Minhas Buscas</h1>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : buscas.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground">Você ainda não fez nenhuma busca.</p>
              <Button variant="gold" className="mt-4" onClick={() => navigate("/busca")}>
                Buscar agora
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {buscas.map((b) => (
                <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {b.origem} → {b.destino}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(b.data_ida).toLocaleDateString("pt-BR")}
                      {b.data_volta && ` — ${new Date(b.data_volta).toLocaleDateString("pt-BR")}`}
                      {" · "}
                      {cabineLabel[b.cabine] ?? b.cabine}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Buscado em {new Date(b.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refazer(b)}>
                    <RefreshCw className="h-4 w-4" /> Refazer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Historico;
