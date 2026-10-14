import type { AttachedFile } from "../types";

export const acceptedExtensions = [
  "pdf",
  "csv",
  "xlsx",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "webp",
];

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toAttachedFile(file: File): AttachedFile {
  const type = file.name.split(".").pop()?.toUpperCase() || "ARQUIVO";
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type,
    size: formatFileSize(file.size),
    file,
    status: "Processando",
  };
}