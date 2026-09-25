import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Estilos compartilhados para erros de validação exibidos diretamente no campo.
 * Os campos continuam legíveis no modo claro e escuro, e a cor nunca é o único sinal.
 */
export const campoInvalidoClass = (invalido: boolean) => cn(
  invalido && "border-destructive bg-destructive/5 focus-visible:border-destructive focus-visible:ring-destructive/20"
);

export function MensagemCampoInvalido({
  id,
  children = "Preencha este campo para continuar.",
  className,
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p id={id} role="alert" className={cn("mt-1 flex items-start gap-1.5 text-xs font-medium text-destructive", className)}>
      <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function LinhaIncompleta({ children = "Complete os campos destacados desta linha." }: { children?: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive">
      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
