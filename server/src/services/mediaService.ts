import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Types } from "mongoose";
import { config } from "../config";
import { MediaAsset } from "../models";
import { ApiError } from "../utils/helpers";

export interface StoredMedia {
  url: string;
  publicId: string;
  provider: "cloudinary" | "local";
  assetId?: string;
}

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  kind: string;
  filename: string;
  userId: string;
}

export interface MediaService {
  upload(input: UploadInput): Promise<StoredMedia>;
  remove(publicId: string): Promise<void>;
}

function extFor(filename: string, mimeType: string): string {
  const fromName = path.extname(filename || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (/^\.[a-z0-9]{1,6}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/x-aac": ".aac",
    "audio/ogg": ".ogg",
  };
  return map[mimeType] || ".bin";
}

function audioDir(): string {
  const dir = path.resolve(process.cwd(), config.uploadsDir, "audio");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function localAudioPath(publicId: string): string {
  const filename = path.basename(publicId);
  return path.join(audioDir(), filename);
}

const AUTHED_AUDIO_SIGNATURES: Array<{ name: string; match: (b: Buffer) => boolean }> = [
  { name: "mpeg-id3", match: (b) => b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 },
  { name: "mpeg-frames", match: (b) => b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 },
  { name: "wav", match: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE" },
  { name: "webm", match: (b) => b.length >= 4 && b.subarray(0, 4).toString("hex") === "1a45dfa3" },
  { name: "m4a/mp4", match: (b) => b.length >= 12 && b.subarray(4, 8).toString("ascii") === "ftyp" },
  { name: "aac-adts", match: (b) => b.length >= 2 && b[0] === 0xff && (b[1] & 0xf6) === 0xf0 },
  { name: "ogg", match: (b) => b.length >= 4 && b.subarray(0, 4).toString("ascii") === "OggS" },
];

export function isLikelyAudio(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return AUTHED_AUDIO_SIGNATURES.some((sig) => sig.match(buffer));
}

export class LocalMediaService implements MediaService {
  async upload({ buffer, mimeType, kind, filename, userId }: UploadInput): Promise<StoredMedia> {
    if (kind === "AUDIO") {
      const formatOk = isLikelyAudio(buffer);
      if (mimeType.startsWith("audio/") && !formatOk) {
        throw new ApiError(400, "Uploaded file is not a recognised audio file. Use MP3, WAV, M4A or AAC.");
      }
      const id = new Types.ObjectId();
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const ext = extFor(safeName, mimeType);
      const storedName = `${id.toHexString()}${ext}`;
      fs.writeFileSync(localAudioPath(storedName), buffer);
      const asset = await MediaAsset.create({
        _id: id,
        kind,
        url: `/media/audio/${id.toHexString()}/file`,
        publicId: storedName,
        mimeType,
        size: buffer.length,
        uploadedBy: userId,
        ownerId: userId,
        provider: "local",
      });
      return { url: `/media/audio/${id.toHexString()}/file`, publicId: storedName, provider: "local", assetId: String(asset._id) };
    }
    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const asset = await MediaAsset.create({
      kind,
      url: dataUri,
      mimeType,
      size: buffer.length,
      uploadedBy: userId,
      ownerId: userId,
      provider: "local",
    });
    return { url: dataUri, publicId: String(asset._id), provider: "local", assetId: String(asset._id) };
  }

  async remove(publicId: string): Promise<void> {
    const filename = path.basename(publicId || "");
    if (!filename || filename.includes("..")) return;
    try {
      fs.unlinkSync(localAudioPath(filename));
    } catch {
      // file already gone
    }
  }
}

export class CloudinaryMediaService implements MediaService {
  private async getSignature(params: Record<string, string>): Promise<{
    signature: string;
    timestamp: string;
  }> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const toSign: Record<string, string> = { timestamp, ...params };
    const sorted = Object.keys(toSign)
      .sort()
      .map((k) => `${k}=${toSign[k]}`)
      .join("&");
    const signature = crypto
      .createHash("sha1")
      .update(sorted + config.cloudinary.apiSecret)
      .digest("hex");
    return { signature, timestamp };
  }

  async upload({ buffer, mimeType, kind, filename, userId }: UploadInput): Promise<StoredMedia> {
    const cloudName = config.cloudinary.cloudName;
    if (!cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      return new LocalMediaService().upload({ buffer, mimeType, kind, filename, userId });
    }
    const publicId = `${kind.toLowerCase()}/${filename}-${Date.now()}`;
    const { signature, timestamp } = await this.getSignature({ public_id: publicId });
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }));
    body.append("public_id", publicId);
    body.append("timestamp", timestamp);
    body.append("signature", signature);
    body.append("api_key", config.cloudinary.apiKey);
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body,
    });
    if (!resp.ok) {
      throw new Error(`Cloudinary upload failed: ${resp.statusText}`);
    }
    const json = (await resp.json()) as { secure_url: string; public_id: string };
    const asset = await MediaAsset.create({
      kind,
      url: json.secure_url,
      publicId: json.public_id,
      mimeType,
      size: buffer.length,
      uploadedBy: userId,
      ownerId: userId,
      provider: "cloudinary",
    });
    return { url: json.secure_url, publicId: json.public_id, provider: "cloudinary", assetId: String(asset._id) };
  }

  async remove(_publicId: string): Promise<void> {
    return;
  }
}

export function getMediaService(): MediaService {
  if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    return new CloudinaryMediaService();
  }
  return new LocalMediaService();
}