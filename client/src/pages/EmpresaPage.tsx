import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1];
      if (!base64) return reject(new Error("Formato de ficheiro inválido"));
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export default function EmpresaPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const configuracao = trpc.empresa.get.useQuery();
  const uploadLogo = trpc.empresa.uploadLogo.useMutation();
  const removeLogo = trpc.empresa.removeLogo.useMutation();

  const refreshConfiguracao = async () => {
    await utils.empresa.get.invalidate();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Use uma imagem PNG ou JPG");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("O logótipo deve ter no máximo 2 MB");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      uploadLogo.mutate({ nomeFicheiro: file.name, mimeType: file.type as "image/png" | "image/jpeg", base64 }, {
        onSuccess: async () => {
          await refreshConfiguracao();
          toast.success("Logótipo atualizado. Os próximos PDFs já o incluirão.");
        },
        onError: (error) => toast.error(error.message || "Não foi possível enviar o logótipo"),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar o ficheiro");
    }
  };

  const handleRemove = () => {
    removeLogo.mutate(undefined, {
      onSuccess: async () => {
        await refreshConfiguracao();
        toast.success("Logótipo removido");
      },
      onError: (error) => toast.error(error.message || "Não foi possível remover o logótipo"),
    });
  };

  const logoUrl = configuracao.data?.logoUrl;
  const uploading = uploadLogo.isPending || removeLogo.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize a identidade visual aplicada às suas vendas.</p>
      </div>

      <Card className="border border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 border-b border-border/50 bg-muted/20">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ImagePlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Logótipo no PDF</h2>
                <p className="text-sm text-muted-foreground mt-1">Envie uma imagem PNG ou JPG de até 2 MB. Ela será exibida automaticamente no cabeçalho dos novos PDFs de venda.</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_220px] items-start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo-upload">Ficheiro do logótipo</Label>
                <Input
                  ref={inputRef}
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="sr-only"
                />
                <p className="text-xs text-muted-foreground">Formatos aceites: PNG e JPG. Tamanho máximo: 2 MB.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploadLogo.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Selecionar logótipo
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleRemove} disabled={uploading}>
                    {removeLogo.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Remover
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/20 min-h-40 flex items-center justify-center overflow-hidden p-4">
              {configuracao.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : logoUrl ? (
                <img src={logoUrl} alt="Pré-visualização do logótipo da empresa" className="max-h-32 max-w-full object-contain" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImagePlus className="h-7 w-7 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium">Nenhum logótipo enviado</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
