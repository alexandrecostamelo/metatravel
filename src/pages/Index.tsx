import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, TrendingDown, Shield, Plane } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const benefits = [
  {
    icon: Search,
    title: "Busca Inteligente",
    description: "Compare milhas de 6 programas de fidelidade em uma única pesquisa.",
  },
  {
    icon: TrendingDown,
    title: "Menor Custo Real",
    description: "Calculamos o custo total em reais considerando a cotação atualizada do milheiro.",
  },
  {
    icon: Shield,
    title: "Transparência Total",
    description: "Veja taxas, milhas e custo real lado a lado. Sem surpresas.",
  },
];

const Index = () => (
  <div className="min-h-screen flex flex-col">
    <Navbar />

    {/* Hero */}
    <section className="gradient-navy pt-32 pb-20 md:pt-40 md:pb-28 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gold blur-3xl" />
        <div className="absolute bottom-10 right-20 w-96 h-96 rounded-full bg-gold blur-3xl" />
      </div>
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 mb-6 animate-fade-in">
          <Plane className="h-4 w-4 text-gold" />
          <span className="text-gold text-sm font-medium">Comparador de milhas aéreas</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-primary-foreground leading-tight max-w-3xl mx-auto animate-slide-up">
          Encontre a passagem mais barata <span className="text-gradient-gold">em milhas</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-primary-foreground/70 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: "0.15s" }}>
          Compare Smiles, Azul, LATAM Pass e mais. Descubra o custo real em reais e economize em cada viagem.
        </p>
        <div className="mt-10 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <Link to="/busca">
            <Button variant="hero" size="lg">
              <Search className="h-5 w-5" /> Buscar passagens
            </Button>
          </Link>
        </div>
      </div>
    </section>

    {/* Benefícios */}
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">
          Por que usar o <span className="text-gradient-gold">VooMilhas</span>?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl gradient-gold mb-5">
                <b.icon className="h-7 w-7 text-gold-foreground" />
              </div>
              <h3 className="text-lg font-bold text-card-foreground mb-2">{b.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default Index;
