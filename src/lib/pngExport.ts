import html2canvas from "html2canvas";

/**
 * Renders a DOM node into a high-resolution PNG and either opens the native
 * share sheet (mobile) or downloads the file (desktop).
 */
export async function exportNodeAsPng(node: HTMLElement, fileName: string, title?: string): Promise<void> {
  const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
  const canvas = await html2canvas(node, {
    backgroundColor: bg,
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("PNG render failed");

  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch {
      /* user cancelled or share unavailable — fall back to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
