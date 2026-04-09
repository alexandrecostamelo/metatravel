export interface OfertaVoo {
  id: string;
  programa: string;
  programaSlug: string;
  companhia: string;
  paradas: number;
  milhas: number;
  taxas: number;
  custoTotal: number;
  cotacaoMilheiro: number;
  link: string;
}

export function gerarMockResultados(): OfertaVoo[] {
  const programas = [
    { slug: "smiles", nome: "Smiles", cia: "GOL", cotacao: 16 },
    { slug: "azul", nome: "Azul Fidelidade", cia: "Azul", cotacao: 15 },
    { slug: "latam_pass", nome: "LATAM Pass", cia: "LATAM", cotacao: 25 },
    { slug: "aeroplan", nome: "Aeroplan", cia: "Air Canada", cotacao: 45 },
    { slug: "avios_qatar", nome: "Avios Qatar", cia: "Qatar Airways", cotacao: 56 },
    { slug: "united", nome: "United MileagePlus", cia: "United", cotacao: 48 },
  ];

  const ofertas: OfertaVoo[] = [];
  let i = 0;
  for (const p of programas) {
    const milhas = Math.round((8000 + Math.random() * 50000) / 1000) * 1000;
    const taxas = Math.round((80 + Math.random() * 400) * 100) / 100;
    const custoMilhas = (milhas / 1000) * p.cotacao;
    ofertas.push({
      id: `offer-${i++}`,
      programa: p.nome,
      programaSlug: p.slug,
      companhia: p.cia,
      paradas: Math.floor(Math.random() * 3),
      milhas,
      taxas,
      custoTotal: Math.round((custoMilhas + taxas) * 100) / 100,
      cotacaoMilheiro: p.cotacao,
      link: "#",
    });
    // Add a second offer for some programs
    if (Math.random() > 0.4) {
      const milhas2 = Math.round((10000 + Math.random() * 40000) / 1000) * 1000;
      const taxas2 = Math.round((100 + Math.random() * 300) * 100) / 100;
      const custoMilhas2 = (milhas2 / 1000) * p.cotacao;
      ofertas.push({
        id: `offer-${i++}`,
        programa: p.nome,
        programaSlug: p.slug,
        companhia: p.cia,
        paradas: Math.floor(Math.random() * 3),
        milhas: milhas2,
        taxas: taxas2,
        custoTotal: Math.round((custoMilhas2 + taxas2) * 100) / 100,
        cotacaoMilheiro: p.cotacao,
        link: "#",
      });
    }
  }

  return ofertas.sort((a, b) => a.custoTotal - b.custoTotal);
}
