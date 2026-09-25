import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title: string;
  description?: string;
  downloadFileName?: string;
  onClose?: () => void;
};

function urlDeDownload(url: string) {
  if (url.startsWith("blob:")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

function urlDePreVisualizacao(url: string) {
  // O navegador controla o PDF com zoom pela largura e sem painel de navegação lateral.
  return `${url}#view=FitH&zoom=page-width&toolbar=0&navpanes=0`;
}

/** Exibe o documento em área quase integral usando o leitor nativo, que preserva fontes, vetores e impressão. */
export function PdfPreviewDialog({ open, onOpenChange, url, title, description, downloadFileName, onClose }: PdfPreviewDialogProps) {
  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
    if (!aberto) onClose?.();
  };

  const confirmarDownload = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = urlDeDownload(url);
    if (downloadFileName) link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const abrirEmTelaCheia = () => {
    if (!url) return;
    window.open(urlDePreVisualizacao(url), "_blank", "noopener,noreferrer");
  };

  return <Dialog open={open} onOpenChange={fechar}>
    <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(99vh,1180px)] sm:w-[min(99vw,1440px)] sm:max-w-[1440px] sm:rounded-xl sm:border">
      <DialogHeader className="shrink-0 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText className="h-5 w-5 shrink-0 text-primary" />{title}</DialogTitle>
        <DialogDescription className="text-sm">{description ?? "Confira o documento antes de confirmar o download."}</DialogDescription>
      </DialogHeader>
	      <div className="min-h-0 flex-1 bg-zinc-900 p-0 sm:p-2">
	        {url && <iframe
	          key={url}
	          title={`Pré-visualização: ${title}`}
	          aria-label={`Pré-visualização: ${title}`}
	          src={urlDePreVisualizacao(url)}
	          className="h-full w-full border-0 bg-white"
	        />}
      </div>
      <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
        <Button type="button" variant="outline" onClick={() => fechar(false)}>Voltar</Button>
        <Button type="button" variant="secondary" onClick={abrirEmTelaCheia} disabled={!url}><ExternalLink className="mr-2 h-4 w-4" />Abrir em tela cheia</Button>
        <Button type="button" onClick={confirmarDownload} disabled={!url}><Download className="mr-2 h-4 w-4" />Confirmar download</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
