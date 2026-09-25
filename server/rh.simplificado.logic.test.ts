import { describe, expect, it } from "vitest";
import {
  calcularResumoRhSimplificado,
  validarFechamentoRhSimplificado,
  validarLimiteAdiantamentoRhSimplificado,
} from "./rh.simplificado.logic";
import { NovoAdiantamentoRhSimplificadoSchema } from "./routers/rh.controle";
import { ColaboradorRhSchema } from "./routers/rh";

describe("controle simplificado de RH", () => {
  const competencia = new Date(2026, 7, 1, 12);
  const colaboradores = [
    { id: 1, nome: "Ana", salarioAtual: "2500.00", situacao: "ativo" as const, cargoNome: "Auxiliar" },
    { id: 2, nome: "Bruno", salarioAtual: "4000.00", situacao: "ativo" as const },
    { id: 3, nome: "Carla", salarioAtual: "3000.00", situacao: "desligado" as const },
  ];

  it("calcula o saldo da competência somente para funcionários ativos e adiantamentos não cancelados", () => {
    const resumo = calcularResumoRhSimplificado({
      competencia,
      colaboradores,
      adiantamentos: [
        { id: 1, colaboradorId: 1, competencia, dataAdiantamento: competencia, valor: "400", estado: "aberto" as const },
        { id: 2, colaboradorId: 1, competencia, dataAdiantamento: competencia, valor: "100", estado: "cancelado" as const },
        { id: 3, colaboradorId: 2, competencia: new Date(2026, 6, 1, 12), dataAdiantamento: competencia, valor: "250", estado: "aberto" as const },
        { id: 4, colaboradorId: 3, competencia, dataAdiantamento: competencia, valor: "900", estado: "aberto" as const },
      ],
    });

    expect(resumo.linhas).toEqual([
      expect.objectContaining({ id: 1, salario: 2500, adiantado: 400, saldoPagar: 2100 }),
      expect.objectContaining({ id: 2, salario: 4000, adiantado: 0, saldoPagar: 4000 }),
    ]);
    expect(resumo.totais).toEqual({ funcionariosAtivos: 2, salarios: 6500, adiantamentos: 400, saldoPagar: 6100 });
  });

  it("bloqueia adiantamento acima do salário, exceto quando a exceção é autorizada pelo router", () => {
    expect(validarLimiteAdiantamentoRhSimplificado({ salario: "2000", totalExistente: 500, valorNovo: "1500" })).toEqual({ salario: 2000, totalProjetado: 2000, excede: false });
    expect(validarLimiteAdiantamentoRhSimplificado({ salario: "2000", totalExistente: 500, valorNovo: "1500.01" })).toEqual({ salario: 2000, totalProjetado: 2000.01, excede: true });
  });

  it("não permite fechar competência com saldo negativo e identifica somente os saldos que viram títulos", () => {
    expect(validarFechamentoRhSimplificado([
      { id: 1, saldoPagar: 2100 },
      { id: 2, saldoPagar: 0 },
      { id: 3, saldoPagar: -55 },
    ])).toEqual({ saldosNegativos: [3], bloqueado: true, titulosNecessarios: [1] });
  });

  it("aceita o cadastro essencial de um funcionário na experiência simplificada", () => {
    expect(ColaboradorRhSchema.parse({
      nome: "Davi Santos", cpf: "123.456.789-00", dataAdmissao: "2026-08-01", salarioAtual: "2800,00",
      tipoContrato: "clt", situacao: "ativo", departamentoId: null, cargoId: null, usuarioId: null,
      rg: null, pis: null, email: null, telefone: null, dataNascimento: null, dataDesligamento: null,
      banco: null, agencia: null, contaBancaria: null, chavePix: null, observacoes: null,
    })).toMatchObject({ nome: "Davi Santos", salarioAtual: "2800.00", cargaHorariaSemanal: "44" });
  });

  it("rejeita adiantamento sem funcionário, competência, data ou valor positivo", () => {
    const valido = { colaboradorId: 1, competencia: "2026-08", dataAdiantamento: "2026-08-10", valor: "450", observacoes: null, permitirExcesso: false };
    expect(NovoAdiantamentoRhSimplificadoSchema.parse(valido)).toMatchObject({ colaboradorId: 1, valor: "450" });
    expect(() => NovoAdiantamentoRhSimplificadoSchema.parse({ ...valido, colaboradorId: 0 })).toThrow();
    expect(() => NovoAdiantamentoRhSimplificadoSchema.parse({ ...valido, competencia: "agosto" })).toThrow();
    expect(() => NovoAdiantamentoRhSimplificadoSchema.parse({ ...valido, dataAdiantamento: "2026/08/10" })).toThrow();
    expect(() => NovoAdiantamentoRhSimplificadoSchema.parse({ ...valido, valor: "0" })).toThrow();
  });
});
