import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { searchAirports } from "@/lib/airports";

interface AirportInputProps {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  id?: string;
}

const AirportInput = ({ value, onChange, placeholder = "GRU", id }: AirportInputProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = searchAirports(query);

  const selectedLabel = value
    ? (() => {
        const found = searchAirports(value).find((a) => a.iata === value);
        return found ? `${found.iata} — ${found.city}, ${found.country}` : value;
      })()
    : "";

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
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite IATA ou cidade..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {results.length === 0 ? (
              <CommandEmpty>Nenhum aeroporto encontrado.</CommandEmpty>
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
                        "mr-2 h-4 w-4",
                        value === airport.iata ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono font-semibold mr-2 text-primary">{airport.iata}</span>
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
