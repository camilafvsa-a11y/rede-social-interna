import { api } from "./api";

export type MediaType = "image" | "video" | "pdf";

export interface UploadResult {
  url: string;
  mediaType: MediaType;
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function guessMediaType(filename: string): MediaType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "image";
}

export async function uploadMedia(
  uri: string,
  filename: string,
): Promise<UploadResult> {
  const base64 = await uriToBase64(uri);
  const result = await api.post("/upload", { base64, filename });
  if (!result?.url) throw new Error("Falha no upload");
  return {
    url: result.url,
    mediaType: guessMediaType(filename),
  };
}
