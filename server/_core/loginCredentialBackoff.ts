import { createHash } from "node:crypto";

export const JANELA_FALHAS_CREDENCIAL_MS = 15 * 60_000;
export const MAX_ATRASO_FALHA_CREDENCIAL_MS = 2_000;
const ATRASO_INICIAL_MS = 100;
const MAX_CREDENCIAIS_EM_MEMORIA = 10_000;
const INTERVALO_LIMPEZA = 64;

type FalhasCredencial = { quantidade: number; ultimaFalha: number };

function atrasoParaFalhas(quantidade: number) {
  const expoente = Math.min(Math.max(0, quantidade - 1), 5);
  return Math.min(MAX_ATRASO_FALHA_CREDENCIAL_MS, ATRASO_INICIAL_MS * 2 ** expoente);
}

/** Backoff suave por identificador, compartilhado entre IPs; nunca rejeita uma senha correta. */
export function criarBackoffCredencial(maxEntradas = MAX_CREDENCIAIS_EM_MEMORIA) {
  const falhasPorIdentificador = new Map<string, FalhasCredencial>();
  let operacoesDesdeLimpeza = 0;

  function chave(identificador: string) {
    return createHash("sha256").update(identificador.trim().toLocaleLowerCase("pt-BR")).digest("hex");
  }

  function limparExpiradas(agora: number) {
    falhasPorIdentificador.forEach((estado, id) => {
      if (agora - estado.ultimaFalha >= JANELA_FALHAS_CREDENCIAL_MS) falhasPorIdentificador.delete(id);
    });
  }

  return {
    registrarFalha(identificador: string, agora = Date.now()) {
      if (++operacoesDesdeLimpeza >= INTERVALO_LIMPEZA) {
        limparExpiradas(agora);
        operacoesDesdeLimpeza = 0;
      }

      const id = chave(identificador);
      const atual = falhasPorIdentificador.get(id);
      if (atual && agora - atual.ultimaFalha >= JANELA_FALHAS_CREDENCIAL_MS) falhasPorIdentificador.delete(id);
      const anterior = falhasPorIdentificador.get(id);

      // O mapa tem limite rígido. Em saturação, conserva as chaves existentes e
      // aplica o atraso máximo sem guardar identificadores adicionais.
      if (!anterior && falhasPorIdentificador.size >= maxEntradas) return MAX_ATRASO_FALHA_CREDENCIAL_MS;

      const quantidade = (anterior?.quantidade ?? 0) + 1;
      falhasPorIdentificador.set(id, { quantidade, ultimaFalha: agora });
      return atrasoParaFalhas(quantidade);
    },

    limpar(identificador: string) {
      falhasPorIdentificador.delete(chave(identificador));
    },
  };
}

const backoffCredencial = criarBackoffCredencial();

export const registrarFalhaCredencial = backoffCredencial.registrarFalha;
export const limparFalhasCredencial = backoffCredencial.limpar;
