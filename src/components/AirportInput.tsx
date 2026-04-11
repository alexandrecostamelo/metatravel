import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function fetchAirports(q: string): Promise<Airport[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API_BASE}/api/airports?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

interface AirportInputProps {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  id?: string;
}

const AirportInput = ({ value, onChange, placeholder = "GRU", id }: AirportInputProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve label when value changes externally
  useEffect(() => {
    if (!value) { setSelectedLabel(""); return; }
    fetchAirports(value).then((airports) => {
      const found = airports.find((a) => a.iata === value);
      setSelectedLabel(found ? `${found.iata} — ${found.city}, ${found.country}` : value);
    });
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await fetchAirports(query);
      setResults(data);
      setLoading(false);
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left h-10 px-3"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? selectedLabel || value : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite IATA ou cidade..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>
                {query.trim() ? "Nenhum aeroporto encontrado." : "Digite para buscar..."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((airport) => (
                  <CommandItem
                    key={airport.iata}
                    value={airport.iata}
                    onSelect={() => {
                      onChange(airport.iata);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === airport.iata ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono font-semibold mr-2 text-primary w-10 shrink-0">
                      {airport.iata}
                    </span>
                    <span className="truncate text-sm">
                      {airport.name} — {airport.city}, {airport.country}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AirportInput;
