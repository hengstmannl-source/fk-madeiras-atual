import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ put: vi.fn(), title: vi.fn(), create: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: mocks.put }));
vi.mock("./db", () => ({ getTituloFinanceiroById: mocks.title, createAnexoFinanceiro: mocks.create }));
vi.mock("./repositories/core", () => ({ getDb: async () => ({ select: () => ({ from: () => ({ where: async () => [{ id: 10 }] }) }) }) }));
import { financeiroRouter } from "./routers/financeiro";
describe("uploads financeiros", () => {
  const ctx = { user: { id: 1, papel: "financeiro", role: "user" }, configuracaoEmpresa: { id: 7 } } as any;
  const pdf = Buffer.from("%PDF-1.4\nconteudo");
  const base = { tituloId: 10, nomeArquivo: "documento.pdf", mimeType: "application/pdf", tamanhoBytes: pdf.length, tipo: "outro" as const, base64: pdf.toString("base64") };
  beforeEach(() => { vi.clearAllMocks(); mocks.title.mockResolvedValue({ id: 10, empresaId: 7 }); mocks.put.mockResolvedValue({ key: "key", url: "/manus-storage/key" }); });
  it.each([
    ["MIME falso", { mimeType: "image/png" }],
    ["magic bytes inválidos", { base64: Buffer.alloc(pdf.length, 65).toString("base64") }],
    ["acima de 8 MiB", { tamanhoBytes: 8 * 1024 * 1024 + 1 }],
    ["tipo não permitido", { mimeType: "text/html" }],
  ])("rejeita %s antes de gravar", async (_name, override) => {
    await expect(financeiroRouter.createCaller(ctx).anexos.upload({ ...base, ...override })).rejects.toThrow();
    expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("valida o título antes do upload e preserva arquivo permitido", async () => {
    await financeiroRouter.createCaller(ctx).anexos.upload(base);
    expect(mocks.title).toHaveBeenCalledWith(10); expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ criadoPor: 1, tituloId: 10 }));
  });
  it("não cria objeto para título ausente", async () => {
    mocks.title.mockResolvedValue(undefined);
    await expect(financeiroRouter.createCaller(ctx).anexos.upload(base)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
