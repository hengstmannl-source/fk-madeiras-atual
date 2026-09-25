import { eq, and, asc, desc, gte, lte, ne, inArray, isNotNull, or, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, componentesPacoteOrcamento, taxasAdicionaisOrcamento, produtosComerciais, componentesProdutoComercial, modelosMedidaVenda, historicoAlteracoes, empresaConfiguracoes,
  empresas, credenciaisUsuarios, convitesEmpresa, recuperacoesSenha,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas, sequenciasDocumentos,
  baixasFinanceiras, chequesFinanceiros, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros, extratosBancarios, movimentosExtratoBancario, anexosFinanceiros,
  plaquetas, conferenciasVariacaoPlaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, aproveitamentosRomaneioProducao, aproveitamentosOrcamento, serragensTerceiros, itensSerragemToras, itensSerragemPecas, retiradasSerragemTerceiros, itensRetiradaSerragemTerceiros, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado, notasDiesel, abastecimentosDiesel,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento, type InsertComponentePacoteOrcamento, type InsertProdutoComercial, type InsertComponenteProdutoComercial, type InsertModeloMedidaVenda, type InsertFornecedor,
  type InsertCategoriaFinanceira, type InsertContaFinanceira,
  type InsertTituloFinanceiro, type InsertBaixaFinanceira, type InsertChequeFinanceiro, type InsertRecorrenciaFinanceira,
} from "../../drizzle/schema";
import { ENV } from '../_core/env';
import { calcularEstadoTitulo, calcularParcelas, calcularPrevisaoSemanal, calcularRelatorioFluxoCaixa, classificarAlertaCompensacaoCheque, decimalParaNumero, planejarAtualizacaoAlertas, podeCancelarTituloFinanceiro, podeEstornarBaixa, proximoVencimento, saldoAbertoTitulo, tipoAlertaAtualDoTitulo, validarDepositoCheque, validarDevolucaoCheque, validarEdicaoTituloFinanceiro, validarExclusaoTituloFinanceiro, validarValorDosCheques } from "../financeiro.logic";
import { criarModeloCsvLancamentos, exportarLancamentosCsv, prepararImportacaoLancamentos } from "../financeiro.intercambio";
import { criarModeloCsvFornecedores, prepararImportacaoFornecedores } from "../fornecedores.intercambio";
import { criarModeloCsvPlaquetasCarga, prepararImportacaoPlaquetasCarga } from "../estoque.intercambio";
import { alocarPecasPermitindoNegativo, agruparEstoquePecas, calcularItemRomaneio, calcularVolumeToraCilindrica, converterDimensoesVendaParaEstoque, normalizarCodigoPlaqueta, validarConfirmacaoRomaneio, validarExclusaoRomaneioProducao, validarRetiradaSerragemTerceiros, validarSerragemTerceiros, type ItemProducaoEntrada } from "../producao.logic";
import { calcularRelatorioInventarioSerrado } from "../inventario.logic";
import { calcularIndicadoresMargemVenda } from "../margemVendas.logic";
import { montarPerfilCliente } from "../clientePerfil.logic";
import { criarModeloCsvPecasProducao, criarModeloCsvTorasProducao, criarModeloCsvTorasSerragemTerceiros, prepararImportacaoTorasProducao, validarCsvPecasProducao, validarCsvTorasSerragemTerceiros } from "../producao.intercambio";
import { calcularCustoAbastecimentoDiesel, calcularResumoTanqueDiesel, validarExclusaoNotaDiesel } from "../diesel.logic";
import { criarModeloCsvExtratoBancario, prepararImportacaoExtrato } from "../conciliacao.intercambio";
import { sugerirConciliacoes } from "../conciliacao.logic";
import { numerarDuplicidadesPlaquetas } from "../../shared/plaquetas";

import { getDb } from "./core";
import { getInsertedId } from "./catalogo";

type MysqlInsertResult = readonly [{ insertId?: number | bigint }, unknown];
type DatabaseConnection = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type TituloFinanceiro = InferSelectModel<typeof titulosFinanceiros>;
type CategoriaFinanceira = InferSelectModel<typeof categoriasFinanceiras>;
type Fornecedor = InferSelectModel<typeof fornecedores>;
type AtualizacaoCabecalhoCarga = Partial<typeof romaneiosCargaToras.$inferInsert>;
type AtualizacaoCabecalhoSerragem = Partial<typeof serragensTerceiros.$inferInsert>;
type EstadoOrcamento = InferSelectModel<typeof orcamentos>["estado"];
type AtualizacaoCabecalhoProducao = Partial<typeof romaneiosProducao.$inferInsert>;

// ─── Users ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    };
    textFields.forEach(assignNullable);
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!user.lastSignedIn) values.lastSignedIn = new Date();
    if (!updateSet.lastSignedIn && !user.lastSignedIn) updateSet.lastSignedIn = new Date();
    if (user.lastSignedIn) updateSet.lastSignedIn = user.lastSignedIn;
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

/** Retorna a única empresa operacional, mantida como cadastro global do ERP. */
export async function getEmpresaUnica() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresasAtivas = await db.select().from(empresas).where(eq(empresas.ativa, true)).limit(2);
  if (empresasAtivas.length !== 1) throw new Error("CONFIGURACAO_EMPRESA_UNICA_INVALIDA");
  return empresasAtivas[0];
}

export async function getCredencialPorEmail(emailNormalizado: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ credencial: credenciaisUsuarios, usuario: users })
    .from(credenciaisUsuarios)
    .innerJoin(users, eq(users.id, credenciaisUsuarios.usuarioId))
    .where(eq(credenciaisUsuarios.emailNormalizado, emailNormalizado))
    .limit(1);
  return result[0];
}

export async function registrarFalhaAutenticacao(credencialId: number, bloqueadoAte: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(credenciaisUsuarios)
    .set({ tentativasFalhas: sql`${credenciaisUsuarios.tentativasFalhas} + 1`, bloqueadoAte })
    .where(eq(credenciaisUsuarios.id, credencialId));
}

export async function limparFalhasAutenticacao(credencialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(credenciaisUsuarios).set({ tentativasFalhas: 0, bloqueadoAte: null }).where(eq(credenciaisUsuarios.id, credencialId));
}

/** Lista os usuários internos com perfil operacional atribuído diretamente. */
export async function listarUsuariosDoSistema() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(isNotNull(users.papel)).orderBy(asc(users.name));
}

export async function criarConviteEmpresa(data: {
  emailNormalizado: string;
  papel: "administrador" | "financeiro" | "rh" | "vendas" | "producao" | "consulta";
  tokenHash: string;
  expiraEm: Date;
  convidadoPor: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresa = await getEmpresaUnica();
  const result = await db.insert(convitesEmpresa).values({ ...data, empresaId: empresa.id });
  return getInsertedId(result as MysqlInsertResult);
}

export async function getConviteValidoPorHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ convite: convitesEmpresa, empresa: empresas })
    .from(convitesEmpresa)
    .innerJoin(empresas, eq(empresas.id, convitesEmpresa.empresaId))
    .where(eq(convitesEmpresa.tokenHash, tokenHash))
    .limit(1);
  const encontrado = result[0];
  if (!encontrado || encontrado.convite.aceitoEm || encontrado.convite.canceladoEm || encontrado.convite.expiraEm <= new Date() || !encontrado.empresa.ativa) return undefined;
  return encontrado;
}

export async function aceitarConviteCriandoUsuario(data: {
  tokenHash: string;
  nome: string;
  senhaHash: string;
  openId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const resultadoConvite = await tx
      .select()
      .from(convitesEmpresa)
      .where(eq(convitesEmpresa.tokenHash, data.tokenHash))
      .limit(1);
    const convite = resultadoConvite[0];
    if (!convite || convite.aceitoEm || convite.canceladoEm || convite.expiraEm <= new Date()) {
      throw new Error("CONVITE_INVALIDO");
    }

    const credencialExistente = await tx
      .select()
      .from(credenciaisUsuarios)
      .where(eq(credenciaisUsuarios.emailNormalizado, convite.emailNormalizado))
      .limit(1);
    if (credencialExistente[0]) throw new Error("EMAIL_JA_CADASTRADO");

    const resultadoUsuario = await tx.insert(users).values({
      openId: data.openId,
      name: data.nome,
      email: convite.emailNormalizado,
      loginMethod: "senha",
      role: "user",
      papel: convite.papel,
      lastSignedIn: new Date(),
    });
    const usuarioId = Number((resultadoUsuario as MysqlInsertResult)[0]?.insertId ?? 0);
    if (!usuarioId) throw new Error("FALHA_AO_CRIAR_USUARIO");

    await tx.insert(credenciaisUsuarios).values({
      usuarioId,
      emailNormalizado: convite.emailNormalizado,
      senhaHash: data.senhaHash,
    });
    await tx.update(convitesEmpresa).set({ aceitoEm: new Date(), aceitoPor: usuarioId }).where(eq(convitesEmpresa.id, convite.id));
    return { usuarioId };
  });
}
