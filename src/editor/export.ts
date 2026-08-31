// Pure DOM export without external lib: serialize HTML via SVG foreignObject -> canvas -> PNG
// Works for HTML overlay templates (no external canvas lib). Fallback for feed raster.

export async function exportTemplatePng(element: HTMLElement, fileName: string = "template.png"): Promise<void> {
  const dataUrl = await htmlToPngDataUrl(element);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

export async function htmlToPngDataUrl(element: HTMLElement): Promise<string> {
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  // Clone with inline styles
  const clone = element.cloneNode(true) as HTMLElement;
  // Need to inline computed styles for foreignObject to render correctly
  // Simplified: just use outerHTML with styles already via style attrs.

  const html = clone.outerHTML;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
      </foreignObject>
    </svg>
  `.trim();

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2; // 2x for retina
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
