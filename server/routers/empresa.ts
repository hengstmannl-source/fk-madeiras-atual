import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { storagePut } from "../storage";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_BASE64_LENGTH = 2_800_000;

export function isValidLogoImage(buffer: Buffer, mimeType: "image/png" | "image/jpeg") {
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return mimeType === "image/png" ? isPng : isJpeg;
}

export const empresaRouter = router({
  get: protectedProcedure.query(async () => db.getEmpresaConfiguracao()),

  uploadLogo: protectedProcedure
    .input(z.object({
      nomeFicheiro: z.string().min(1).max(150),
      mimeType: z.enum(["image/png", "image/jpeg"]),
      base64: z.string().min(1).max(MAX_LOGO_BASE64_LENGTH),
    }))
    .mutation(async ({ input }) => {
      const image = Buffer.from(input.base64, "base64");
      if (!image.length || image.length > MAX_LOGO_BYTES || !isValidLogoImage(image, input.mimeType)) {
        throw new Error("Envie uma imagem PNG ou JPG válida de até 2 MB");
      }

      const extension = input.mimeType === "image/png" ? "png" : "jpg";
      const empresaId = (await db.getEmpresaUnica()).id;
      const upload = await storagePut(`empresa/${empresaId}/logotipo-${Date.now()}.${extension}`, image, input.mimeType);
      const configuracao = await db.saveEmpresaLogo({
        key: upload.key,
        url: upload.url,
        mimeType: input.mimeType,
      });

      return { success: true, configuracao };
    }),

  removeLogo: protectedProcedure.mutation(async () => {
    const configuracao = await db.clearEmpresaLogo();
    return { success: true, configuracao };
  }),
});
