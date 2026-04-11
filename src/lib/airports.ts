export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
}

export const AIRPORTS: Airport[] = [
  // ── Brasil ───────────────────────────────────────────────────────────────
  { iata: "GRU", name: "Aeroporto Internacional de Guarulhos", city: "São Paulo", country: "Brasil" },
  { iata: "CGH", name: "Aeroporto de Congonhas", city: "São Paulo", country: "Brasil" },
  { iata: "VCP", name: "Aeroporto de Viracopos", city: "Campinas", country: "Brasil" },
  { iata: "GIG", name: "Aeroporto Internacional do Galeão", city: "Rio de Janeiro", country: "Brasil" },
  { iata: "SDU", name: "Aeroporto Santos Dumont", city: "Rio de Janeiro", country: "Brasil" },
  { iata: "BSB", name: "Aeroporto Internacional de Brasília", city: "Brasília", country: "Brasil" },
  { iata: "SSA", name: "Aeroporto Internacional de Salvador", city: "Salvador", country: "Brasil" },
  { iata: "FOR", name: "Aeroporto Internacional de Fortaleza", city: "Fortaleza", country: "Brasil" },
  { iata: "REC", name: "Aeroporto Internacional do Recife", city: "Recife", country: "Brasil" },
  { iata: "POA", name: "Aeroporto Internacional de Porto Alegre", city: "Porto Alegre", country: "Brasil" },
  { iata: "BEL", name: "Aeroporto Internacional de Belém", city: "Belém", country: "Brasil" },
  { iata: "MAO", name: "Aeroporto Internacional de Manaus", city: "Manaus", country: "Brasil" },
  { iata: "CWB", name: "Aeroporto Internacional de Curitiba", city: "Curitiba", country: "Brasil" },
  { iata: "FLN", name: "Aeroporto Internacional de Florianópolis", city: "Florianópolis", country: "Brasil" },
  { iata: "NAT", name: "Aeroporto Internacional de Natal", city: "Natal", country: "Brasil" },
  { iata: "MCZ", name: "Aeroporto Internacional de Maceió", city: "Maceió", country: "Brasil" },
  { iata: "AJU", name: "Aeroporto de Aracaju", city: "Aracaju", country: "Brasil" },
  { iata: "THE", name: "Aeroporto de Teresina", city: "Teresina", country: "Brasil" },
  { iata: "SLZ", name: "Aeroporto de São Luís", city: "São Luís", country: "Brasil" },
  { iata: "CGB", name: "Aeroporto Internacional de Cuiabá", city: "Cuiabá", country: "Brasil" },
  { iata: "CGR", name: "Aeroporto Internacional de Campo Grande", city: "Campo Grande", country: "Brasil" },
  { iata: "PMW", name: "Aeroporto de Palmas", city: "Palmas", country: "Brasil" },
  { iata: "PVH", name: "Aeroporto de Porto Velho", city: "Porto Velho", country: "Brasil" },
  { iata: "RBR", name: "Aeroporto de Rio Branco", city: "Rio Branco", country: "Brasil" },
  { iata: "MCP", name: "Aeroporto de Macapá", city: "Macapá", country: "Brasil" },
  { iata: "BVB", name: "Aeroporto de Boa Vista", city: "Boa Vista", country: "Brasil" },
  { iata: "VIX", name: "Aeroporto de Vitória", city: "Vitória", country: "Brasil" },
  { iata: "GYN", name: "Aeroporto de Goiânia", city: "Goiânia", country: "Brasil" },
  { iata: "IGU", name: "Aeroporto de Foz do Iguaçu", city: "Foz do Iguaçu", country: "Brasil" },
  { iata: "JPA", name: "Aeroporto de João Pessoa", city: "João Pessoa", country: "Brasil" },

  // ── América do Norte ─────────────────────────────────────────────────────
  { iata: "JFK", name: "John F. Kennedy International", city: "Nova York", country: "EUA" },
  { iata: "EWR", name: "Newark Liberty International", city: "Nova York", country: "EUA" },
  { iata: "LGA", name: "LaGuardia Airport", city: "Nova York", country: "EUA" },
  { iata: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "EUA" },
  { iata: "ORD", name: "O'Hare International", city: "Chicago", country: "EUA" },
  { iata: "MDW", name: "Midway International", city: "Chicago", country: "EUA" },
  { iata: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", country: "EUA" },
  { iata: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", country: "EUA" },
  { iata: "DEN", name: "Denver International", city: "Denver", country: "EUA" },
  { iata: "SFO", name: "San Francisco International", city: "San Francisco", country: "EUA" },
  { iata: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "EUA" },
  { iata: "MIA", name: "Miami International", city: "Miami", country: "EUA" },
  { iata: "MCO", name: "Orlando International", city: "Orlando", country: "EUA" },
  { iata: "BOS", name: "Logan International", city: "Boston", country: "EUA" },
  { iata: "IAD", name: "Washington Dulles International", city: "Washington DC", country: "EUA" },
  { iata: "DCA", name: "Ronald Reagan Washington National", city: "Washington DC", country: "EUA" },
  { iata: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "EUA" },
  { iata: "HOU", name: "William P. Hobby", city: "Houston", country: "EUA" },
  { iata: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", country: "EUA" },
  { iata: "LAS", name: "Harry Reid International", city: "Las Vegas", country: "EUA" },
  { iata: "MSP", name: "Minneapolis-Saint Paul International", city: "Minneapolis", country: "EUA" },
  { iata: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", country: "EUA" },
  { iata: "PHL", name: "Philadelphia International", city: "Filadélfia", country: "EUA" },
  { iata: "CLT", name: "Charlotte Douglas International", city: "Charlotte", country: "EUA" },
  { iata: "SLC", name: "Salt Lake City International", city: "Salt Lake City", country: "EUA" },
  { iata: "PDX", name: "Portland International", city: "Portland", country: "EUA" },
  { iata: "SAN", name: "San Diego International", city: "San Diego", country: "EUA" },
  { iata: "TPA", name: "Tampa International", city: "Tampa", country: "EUA" },
  { iata: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", country: "EUA" },
  { iata: "ANC", name: "Ted Stevens Anchorage International", city: "Anchorage", country: "EUA" },
  { iata: "YYZ", name: "Toronto Pearson International", city: "Toronto", country: "Canadá" },
  { iata: "YUL", name: "Montréal-Trudeau International", city: "Montreal", country: "Canadá" },
  { iata: "YVR", name: "Vancouver International", city: "Vancouver", country: "Canadá" },
  { iata: "YYC", name: "Calgary International", city: "Calgary", country: "Canadá" },
  { iata: "YEG", name: "Edmonton International", city: "Edmonton", country: "Canadá" },
  { iata: "YOW", name: "Ottawa Macdonald-Cartier International", city: "Ottawa", country: "Canadá" },
  { iata: "MEX", name: "Aeroporto Internacional da Cidade do México", city: "Cidade do México", country: "México" },
  { iata: "CUN", name: "Aeroporto Internacional de Cancún", city: "Cancún", country: "México" },
  { iata: "GDL", name: "Aeroporto Internacional de Guadalajara", city: "Guadalajara", country: "México" },
  { iata: "MTY", name: "Aeroporto Internacional de Monterrey", city: "Monterrey", country: "México" },

  // ── América do Sul ────────────────────────────────────────────────────────
  { iata: "EZE", name: "Aeroporto Internacional Ministro Pistarini", city: "Buenos Aires", country: "Argentina" },
  { iata: "AEP", name: "Aeroporto de Jorge Newbery", city: "Buenos Aires", country: "Argentina" },
  { iata: "SCL", name: "Aeroporto Internacional de Santiago", city: "Santiago", country: "Chile" },
  { iata: "LIM", name: "Aeroporto Internacional Jorge Chávez", city: "Lima", country: "Peru" },
  { iata: "BOG", name: "Aeroporto Internacional El Dorado", city: "Bogotá", country: "Colômbia" },
  { iata: "MDE", name: "Aeroporto Internacional José Maria Córdova", city: "Medellín", country: "Colômbia" },
  { iata: "GRU", name: "Aeroporto Internacional de Guarulhos", city: "São Paulo", country: "Brasil" },
  { iata: "MVD", name: "Aeroporto Internacional de Montevidéu", city: "Montevidéu", country: "Uruguai" },
  { iata: "ASU", name: "Aeroporto Internacional Silvio Pettirossi", city: "Assunção", country: "Paraguai" },
  { iata: "VVI", name: "Aeroporto Internacional Viru Viru", city: "Santa Cruz", country: "Bolívia" },
  { iata: "GYE", name: "Aeroporto Internacional José Joaquín de Olmedo", city: "Guayaquil", country: "Equador" },
  { iata: "UIO", name: "Aeroporto Internacional Mariscal Sucre", city: "Quito", country: "Equador" },
  { iata: "CCS", name: "Aeroporto Internacional Simón Bolívar", city: "Caracas", country: "Venezuela" },
  { iata: "PTY", name: "Aeroporto Internacional Tocumen", city: "Cidade do Panamá", country: "Panamá" },
  { iata: "SJO", name: "Aeroporto Internacional Juan Santamaría", city: "San José", country: "Costa Rica" },

  // ── Europa ────────────────────────────────────────────────────────────────
  { iata: "LHR", name: "London Heathrow", city: "Londres", country: "Reino Unido" },
  { iata: "LGW", name: "London Gatwick", city: "Londres", country: "Reino Unido" },
  { iata: "STN", name: "London Stansted", city: "Londres", country: "Reino Unido" },
  { iata: "LTN", name: "London Luton", city: "Londres", country: "Reino Unido" },
  { iata: "CDG", name: "Paris Charles de Gaulle", city: "Paris", country: "França" },
  { iata: "ORY", name: "Paris Orly", city: "Paris", country: "França" },
  { iata: "AMS", name: "Amsterdam Schiphol", city: "Amsterdã", country: "Holanda" },
  { iata: "FRA", name: "Frankfurt am Main", city: "Frankfurt", country: "Alemanha" },
  { iata: "MUC", name: "Munich International", city: "Munique", country: "Alemanha" },
  { iata: "TXL", name: "Berlin Tegel", city: "Berlim", country: "Alemanha" },
  { iata: "BER", name: "Berlin Brandenburg", city: "Berlim", country: "Alemanha" },
  { iata: "MAD", name: "Madrid Barajas", city: "Madri", country: "Espanha" },
  { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Espanha" },
  { iata: "LIS", name: "Aeroporto Humberto Delgado", city: "Lisboa", country: "Portugal" },
  { iata: "OPO", name: "Aeroporto Francisco Sá Carneiro", city: "Porto", country: "Portugal" },
  { iata: "FCO", name: "Roma Fiumicino", city: "Roma", country: "Itália" },
  { iata: "MXP", name: "Milano Malpensa", city: "Milão", country: "Itália" },
  { iata: "VCE", name: "Venice Marco Polo", city: "Veneza", country: "Itália" },
  { iata: "ZRH", name: "Zurich Airport", city: "Zurique", country: "Suíça" },
  { iata: "GVA", name: "Geneva Airport", city: "Genebra", country: "Suíça" },
  { iata: "VIE", name: "Vienna International", city: "Viena", country: "Áustria" },
  { iata: "BRU", name: "Brussels Airport", city: "Bruxelas", country: "Bélgica" },
  { iata: "CPH", name: "Copenhagen Airport", city: "Copenhague", country: "Dinamarca" },
  { iata: "ARN", name: "Stockholm Arlanda", city: "Estocolmo", country: "Suécia" },
  { iata: "OSL", name: "Oslo Gardermoen", city: "Oslo", country: "Noruega" },
  { iata: "HEL", name: "Helsinki-Vantaa", city: "Helsinque", country: "Finlândia" },
  { iata: "ATH", name: "Athens International", city: "Atenas", country: "Grécia" },
  { iata: "IST", name: "Istanbul Airport", city: "Istambul", country: "Turquia" },
  { iata: "SAW", name: "Istanbul Sabiha Gökçen", city: "Istambul", country: "Turquia" },
  { iata: "WAW", name: "Warsaw Chopin", city: "Varsóvia", country: "Polônia" },
  { iata: "PRG", name: "Václav Havel Airport Prague", city: "Praga", country: "Rep. Tcheca" },
  { iata: "BUD", name: "Budapest Ferenc Liszt", city: "Budapeste", country: "Hungria" },
  { iata: "OTP", name: "Henri Coandă International", city: "Bucareste", country: "Romênia" },
  { iata: "SVO", name: "Sheremetyevo International", city: "Moscou", country: "Rússia" },
  { iata: "DME", name: "Domodedovo International", city: "Moscou", country: "Rússia" },
  { iata: "LED", name: "Pulkovo Airport", city: "São Petersburgo", country: "Rússia" },
  { iata: "DUB", name: "Dublin Airport", city: "Dublin", country: "Irlanda" },
  { iata: "MAN", name: "Manchester Airport", city: "Manchester", country: "Reino Unido" },
  { iata: "EDI", name: "Edinburgh Airport", city: "Edimburgo", country: "Reino Unido" },

  // ── Oriente Médio ─────────────────────────────────────────────────────────
  { iata: "DXB", name: "Dubai International", city: "Dubai", country: "Emirados Árabes" },
  { iata: "DWC", name: "Al Maktoum International", city: "Dubai", country: "Emirados Árabes" },
  { iata: "AUH", name: "Abu Dhabi International", city: "Abu Dhabi", country: "Emirados Árabes" },
  { iata: "DOH", name: "Hamad International", city: "Doha", country: "Catar" },
  { iata: "RUH", name: "King Khalid International", city: "Riade", country: "Arábia Saudita" },
  { iata: "JED", name: "King Abdulaziz International", city: "Jedá", country: "Arábia Saudita" },
  { iata: "KWI", name: "Kuwait International", city: "Kuwait", country: "Kuwait" },
  { iata: "BAH", name: "Bahrain International", city: "Manama", country: "Bahrein" },
  { iata: "MCT", name: "Muscat International", city: "Mascate", country: "Omã" },
  { iata: "AMM", name: "Queen Alia International", city: "Amã", country: "Jordânia" },
  { iata: "BEY", name: "Rafic Hariri International", city: "Beirute", country: "Líbano" },
  { iata: "TLV", name: "Ben Gurion International", city: "Tel Aviv", country: "Israel" },

  // ── Ásia ─────────────────────────────────────────────────────────────────
  { iata: "SIN", name: "Singapore Changi", city: "Singapura", country: "Singapura" },
  { iata: "HKG", name: "Hong Kong International", city: "Hong Kong", country: "Hong Kong" },
  { iata: "NRT", name: "Tokyo Narita International", city: "Tóquio", country: "Japão" },
  { iata: "HND", name: "Tokyo Haneda International", city: "Tóquio", country: "Japão" },
  { iata: "KIX", name: "Kansai International", city: "Osaka", country: "Japão" },
  { iata: "ICN", name: "Incheon International", city: "Seul", country: "Coreia do Sul" },
  { iata: "GMP", name: "Gimpo International", city: "Seul", country: "Coreia do Sul" },
  { iata: "PEK", name: "Beijing Capital International", city: "Pequim", country: "China" },
  { iata: "PKX", name: "Beijing Daxing International", city: "Pequim", country: "China" },
  { iata: "PVG", name: "Shanghai Pudong International", city: "Xangai", country: "China" },
  { iata: "SHA", name: "Shanghai Hongqiao International", city: "Xangai", country: "China" },
  { iata: "CAN", name: "Guangzhou Baiyun International", city: "Guangzhou", country: "China" },
  { iata: "CTU", name: "Chengdu Tianfu International", city: "Chengdu", country: "China" },
  { iata: "BOM", name: "Chhatrapati Shivaji International", city: "Mumbai", country: "Índia" },
  { iata: "DEL", name: "Indira Gandhi International", city: "Nova Délhi", country: "Índia" },
  { iata: "BLR", name: "Kempegowda International", city: "Bengaluru", country: "Índia" },
  { iata: "MAA", name: "Chennai International", city: "Chennai", country: "Índia" },
  { iata: "CCU", name: "Netaji Subhas Chandra Bose International", city: "Calcutá", country: "Índia" },
  { iata: "HYD", name: "Rajiv Gandhi International", city: "Hyderabad", country: "Índia" },
  { iata: "KUL", name: "Kuala Lumpur International", city: "Kuala Lumpur", country: "Malásia" },
  { iata: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Tailândia" },
  { iata: "DMK", name: "Don Mueang International", city: "Bangkok", country: "Tailândia" },
  { iata: "CGK", name: "Soekarno-Hatta International", city: "Jacarta", country: "Indonésia" },
  { iata: "DPS", name: "Ngurah Rai International", city: "Bali", country: "Indonésia" },
  { iata: "MNL", name: "Ninoy Aquino International", city: "Manila", country: "Filipinas" },
  { iata: "SGN", name: "Tan Son Nhat International", city: "Ho Chi Minh", country: "Vietnã" },
  { iata: "HAN", name: "Noi Bai International", city: "Hanói", country: "Vietnã" },
  { iata: "RGN", name: "Yangon International", city: "Yangon", country: "Myanmar" },
  { iata: "CMB", name: "Bandaranaike International", city: "Colombo", country: "Sri Lanka" },
  { iata: "DAC", name: "Hazrat Shahjalal International", city: "Dhaka", country: "Bangladesh" },
  { iata: "KTM", name: "Tribhuvan International", city: "Katmandu", country: "Nepal" },
  { iata: "TPE", name: "Taiwan Taoyuan International", city: "Taipei", country: "Taiwan" },

  // ── África ───────────────────────────────────────────────────────────────
  { iata: "JNB", name: "O.R. Tambo International", city: "Johannesburgo", country: "África do Sul" },
  { iata: "CPT", name: "Cape Town International", city: "Cidade do Cabo", country: "África do Sul" },
  { iata: "DUR", name: "King Shaka International", city: "Durban", country: "África do Sul" },
  { iata: "NBO", name: "Jomo Kenyatta International", city: "Nairóbi", country: "Quênia" },
  { iata: "ADD", name: "Addis Ababa Bole International", city: "Adis Abeba", country: "Etiópia" },
  { iata: "CAI", name: "Cairo International", city: "Cairo", country: "Egito" },
  { iata: "CMN", name: "Mohammed V International", city: "Casablanca", country: "Marrocos" },
  { iata: "ALG", name: "Houari Boumediene Airport", city: "Argel", country: "Argélia" },
  { iata: "TUN", name: "Tunis-Carthage International", city: "Tunis", country: "Tunísia" },
  { iata: "LOS", name: "Murtala Muhammed International", city: "Lagos", country: "Nigéria" },
  { iata: "ABV", name: "Nnamdi Azikiwe International", city: "Abuja", country: "Nigéria" },
  { iata: "ACC", name: "Kotoka International", city: "Acra", country: "Gana" },
  { iata: "DAK", name: "Blaise Diagne International", city: "Dakar", country: "Senegal" },
  { iata: "MPM", name: "Maputo International", city: "Maputo", country: "Moçambique" },
  { iata: "LAD", name: "Quatro de Fevereiro Airport", city: "Luanda", country: "Angola" },

  // ── Oceania ───────────────────────────────────────────────────────────────
  { iata: "SYD", name: "Sydney Kingsford Smith", city: "Sydney", country: "Austrália" },
  { iata: "MEL", name: "Melbourne Airport", city: "Melbourne", country: "Austrália" },
  { iata: "BNE", name: "Brisbane Airport", city: "Brisbane", country: "Austrália" },
  { iata: "PER", name: "Perth Airport", city: "Perth", country: "Austrália" },
  { iata: "ADL", name: "Adelaide Airport", city: "Adelaide", country: "Austrália" },
  { iata: "AKL", name: "Auckland Airport", city: "Auckland", country: "Nova Zelândia" },
  { iata: "CHC", name: "Christchurch Airport", city: "Christchurch", country: "Nova Zelândia" },
  { iata: "WLG", name: "Wellington Airport", city: "Wellington", country: "Nova Zelândia" },
  { iata: "NAN", name: "Nadi International", city: "Nadi", country: "Fiji" },
];

export function searchAirports(query: string): Airport[] {
  if (!query || query.length < 1) return [];
  const q = query.toUpperCase().trim();
  const qLower = query.toLowerCase().trim();

  // Exact IATA match first
  const exact = AIRPORTS.filter((a) => a.iata === q);
  if (exact.length > 0) return exact;

  // Starts with IATA
  const iataStart = AIRPORTS.filter((a) => a.iata.startsWith(q));

  // City/name contains query
  const textMatch = AIRPORTS.filter(
    (a) =>
      !a.iata.startsWith(q) &&
      (a.city.toLowerCase().includes(qLower) ||
        a.name.toLowerCase().includes(qLower) ||
        a.country.toLowerCase().includes(qLower))
  );

  return [...iataStart, ...textMatch].slice(0, 8);
}
