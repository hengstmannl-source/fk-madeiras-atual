import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableEntityOption = {
  value: string;
  label: string;
  details?: string | null;
};

type SearchableEntitySelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableEntityOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  createLabel?: string;
  onCreate?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

/**
 * Seletor de cadastros operacionais. A primeira ação é sempre criar um novo
 * cadastro e a pesquisa considera tanto o nome como as informações auxiliares.
 */
export function SearchableEntitySelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Pesquisar...",
  emptyLabel = "Nenhum resultado encontrado.",
  createLabel,
  onCreate,
  disabled = false,
  className,
  ariaLabel,
}: SearchableEntitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredOptions = useMemo(() => options.filter((option) => {
    if (!normalizedQuery) return true;
    return [option.label, option.details ?? ""].some((text) => text.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  }), [normalizedQuery, options]);

  const closeAndReset = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          data-placeholder={selected ? undefined : "true"}
          disabled={disabled}
          className={cn("w-full justify-between bg-background font-normal", className)}
        >
          <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList>
            {onCreate && createLabel ? (
              <CommandGroup heading="Ação rápida">
                <CommandItem
                  value="criar-novo"
                  onSelect={() => {
                    closeAndReset();
                    onCreate();
                  }}
                  className="text-primary"
                >
                  <Plus className="size-4" />
                  <span className="font-medium">{createLabel}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {onCreate && createLabel ? <CommandSeparator /> : null}
            {filteredOptions.length === 0 ? <CommandEmpty>{emptyLabel}</CommandEmpty> : null}
            {filteredOptions.length > 0 ? (
              <CommandGroup heading="Opções disponíveis">
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onValueChange(option.value);
                      closeAndReset();
                    }}
                  >
                    <Check className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 truncate">{option.label}</span>
                    {option.details ? <span className="ml-auto max-w-[42%] truncate pl-3 text-xs text-muted-foreground">{option.details}</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
