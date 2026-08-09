import { config } from "../config";
import { MediaAsset } from "../models";

export interface StoredMedia {
  url: string;
  publicId: string;
  provider: "cloudinary" | "local";
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

export class LocalMediaService implements MediaService {
  async upload({ buffer, mimeType, kind, userId }: UploadInput): Promise<StoredMedia> {
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
    return { url: dataUri, publicId: String(asset._id), provider: "local" };
  }

  async remove(_publicId: string): Promise<void> {
    return;
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
    const crypto = await import("crypto");
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
    body.append("file", new Blob([buffer], { type: mimeType }));
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
    await MediaAsset.create({
      kind,
      url: json.secure_url,
      publicId: json.public_id,
      mimeType,
      size: buffer.length,
      uploadedBy: userId,
      ownerId: userId,
      provider: "cloudinary",
    });
    return { url: json.secure_url, publicId: json.public_id, provider: "cloudinary" };
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