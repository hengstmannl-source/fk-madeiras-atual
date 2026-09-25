import { and, asc, eq } from "drizzle-orm";
import { centrosCustosGerenciais } from "../../drizzle/schema";
import { normalizarCodigoCentroCusto, validarNomeCentroCusto, validarTipoCentroCusto, type TipoCentroCusto } from "../centros-custo.logic";
import { getDb } from "./core";
import { getEmpresaUnica } from "./identidade";

type DatabaseLike = NonNullable<Awaited<ReturnType<typeof getDb>>> | any;

export async function listarCentrosCusto(incluirInativos = false) {
  const database = await getDb();
  if (!database) return [];
  const empresaId = (await getEmpresaUnica()).id;
  const condicoes = [eq(centrosCustosGerenciais.empresaId, empresaId)];
  if (!incluirInativos) condicoes.push(eq(centrosCustosGerenciais.ativo, true));
  return database.select().from(centrosCustosGerenciais)
    .where(and(...condicoes))
    .orderBy(asc(centrosCustosGerenciais.tipo), asc(centrosCustosGerenciais.nome));
}

export async function obterCentroCustoAtivo(centroCustoId: number, database?: DatabaseLike, empresaIdParam?: number) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = empresaIdParam ?? (await getEmpresaUnica()).id;
  const centro = (await db.select().from(centrosCustosGerenciais).where(and(
    eq(centrosCustosGerenciais.id, centroCustoId),
    eq(centrosCustosGerenciais.empresaId, empresaId),
    eq(centrosCustosGerenciais.ativo, true),
  )).limit(1))[0];
  if (!centro) throw new Error("Centro de Custo ativo não encontrado.");
  return centro;
}

async function gerarCodigoDisponivel(database: DatabaseLike, empresaId: number, nome: string): Promise<string> {
  const base = normalizarCodigoCentroCusto(nome);
  for (let tentativa = 1; tentativa <= 999; tentativa += 1) {
    const sufixo = tentativa === 1 ? "" : `_${tentativa}`;
    const codigo = `${base.slice(0, 80 - sufixo.length)}${sufixo}`;
    const existente = (await database.select({ id: centrosCustosGerenciais.id }).from(centrosCustosGerenciais).where(and(
      eq(centrosCustosGerenciais.empresaId, empresaId),
      eq(centrosCustosGerenciais.codigo, codigo),
    )).limit(1))[0];
    if (!existente) return codigo;
  }
  throw new Error("Não foi possível gerar um código disponível para o centro de custo.");
}

export async function criarCentroCusto(input: { nome: string; tipo: TipoCentroCusto; observacoes?: string | null; criadoPor: number }) {
  validarTipoCentroCusto(input.tipo);
  const nome = validarNomeCentroCusto(input.nome);
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const codigo = await gerarCodigoDisponivel(database, empresaId, nome);
  const resultado = await database.insert(centrosCustosGerenciais).values({
    empresaId,
    codigo,
    nome,
    tipo: input.tipo,
    observacoes: input.observacoes?.trim() || null,
    ativo: true,
    criadoPor: input.criadoPor,
  });
  const id = Number(resultado[0]?.insertId ?? 0);
  if (!id) throw new Error("Não foi possível criar o Centro de Custo.");
  return { id, codigo };
}

export async function atualizarCentroCusto(input: { id: number; nome?: string; tipo?: TipoCentroCusto; observacoes?: string | null; ativo?: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const atualizacao: { nome?: string; tipo?: TipoCentroCusto; observacoes?: string | null; ativo?: boolean } = {};
  if (input.nome !== undefined) atualizacao.nome = validarNomeCentroCusto(input.nome);
  if (input.tipo !== undefined) {
    validarTipoCentroCusto(input.tipo);
    atualizacao.tipo = input.tipo;
  }
  if (input.observacoes !== undefined) atualizacao.observacoes = input.observacoes?.trim() || null;
  if (input.ativo !== undefined) atualizacao.ativo = input.ativo;
  if (!Object.keys(atualizacao).length) throw new Error("Informe ao menos um campo para atualizar.");
  const resultado = await database.update(centrosCustosGerenciais).set(atualizacao).where(and(
    eq(centrosCustosGerenciais.id, input.id),
    eq(centrosCustosGerenciais.empresaId, empresaId),
  ));
  if (!resultado[0]?.affectedRows) throw new Error("Centro de Custo não encontrado.");
  return { sucesso: true };
}
