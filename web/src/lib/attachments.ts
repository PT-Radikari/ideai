import type { AttachmentKind, AttachmentRecord } from "@/types/domain";

const IMAGE_PREVIEW_CAP_BYTES = 900_000;

export async function normalizeAttachments(files: File[]): Promise<AttachmentRecord[]> {
  return Promise.all(
    files.filter((file) => file.size > 0).map(normalizeAttachment),
  );
}

async function normalizeAttachment(file: File): Promise<AttachmentRecord> {
  const kind: AttachmentKind = file.type.startsWith("image/")
    ? "image"
    : /\.(csv|xlsx|xls|ods)$/i.test(file.name)
      ? "spreadsheet"
      : "file";

  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    kind,
    previewDataUrl:
      kind === "image" && file.size < IMAGE_PREVIEW_CAP_BYTES
        ? await readFileAsDataUrl(file)
        : "",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
