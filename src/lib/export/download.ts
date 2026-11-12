import type { ExportFile } from "../zones/types";

export function downloadFile(file: ExportFile): void {
  const blob = new Blob([file.content], { type: `${file.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
