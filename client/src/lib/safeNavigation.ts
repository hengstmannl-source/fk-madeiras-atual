const PDF_ENDPOINT_PATH = /^\/api\/pdf\/(?:orcamento|recibo|romaneio|romaneio-carga)\/\d+$/;

export function safeInternalRedirectPath(
  candidate: string,
  origin: string,
): string | null {
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, origin);
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function safePdfUrl(candidate: string, origin: string): string | null {
  try {
    const parsed = new URL(candidate, origin);

    if (parsed.protocol === "blob:") {
      return parsed.origin === origin ? candidate : null;
    }

    if (
      parsed.origin === origin &&
      parsed.protocol === new URL(origin).protocol &&
      candidate.startsWith("/") &&
      !candidate.startsWith("//") &&
      !candidate.includes("\\") &&
      !/[\u0000-\u001f\u007f]/.test(candidate) &&
      PDF_ENDPOINT_PATH.test(parsed.pathname)
    ) {
      return candidate;
    }
  } catch {
    return null;
  }

  return null;
}
