import { google, type drive_v3 } from "googleapis";
import crypto from "node:crypto";
import type { AppConfig } from "../config.js";
import { exportedFileName, googleExportSpec, isJunkPath } from "../services/drive-sync-policy.js";
import { prisma } from "./prisma.js";

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export class DriveNotConnectedError extends Error {
  statusCode = 400;
  constructor(message = "Google Drive is not connected") {
    super(message);
    this.name = "DriveNotConnectedError";
  }
}

export type ListedDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: Date;
  sizeBytes: number | null;
  webViewLink?: string;
  path: string;
};

function encKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string, secret: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function oauthConfigured(config: AppConfig): boolean {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI);
}

export function oauth2Client(config: AppConfig) {
  if (!oauthConfigured(config)) {
    throw new DriveNotConnectedError(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be set on the API",
    );
  }
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI,
  );
}

export function googleAuthUrl(config: AppConfig, state: string): string {
  return oauth2Client(config).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(config: AppConfig, code: string) {
  const client = oauth2Client(config);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  return {
    refreshToken: tokens.refresh_token ?? null,
    email: me.data.email ?? null,
  };
}

async function authFromConnection(config: AppConfig) {
  const row = await prisma.driveConnection.findUnique({ where: { id: "default" } });
  const refresh =
    (row?.refreshTokenEnc ? decryptSecret(row.refreshTokenEnc, config.JWT_SECRET) : null) ||
    config.GOOGLE_REFRESH_TOKEN ||
    null;
  if (refresh && oauthConfigured(config)) {
    const client = oauth2Client(config);
    client.setCredentials({ refresh_token: refresh });
    return { auth: client, email: row?.googleEmail ?? null, folderId: row?.folderId ?? config.GOOGLE_DRIVE_FOLDER_ID };
  }
  if (config.GOOGLE_SERVICE_ACCOUNT_JSON) {
    let credentials: object;
    try {
      credentials = JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON) as object;
    } catch {
      throw new DriveNotConnectedError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    return { auth, email: row?.googleEmail ?? "service-account", folderId: row?.folderId ?? config.GOOGLE_DRIVE_FOLDER_ID };
  }
  throw new DriveNotConnectedError(
    "Connect Google Drive in Settings, or set GOOGLE_REFRESH_TOKEN / GOOGLE_SERVICE_ACCOUNT_JSON on Railway",
  );
}

export async function driveAuthStatus(config: AppConfig) {
  const row = await prisma.driveConnection.findUnique({ where: { id: "default" } });
  let connected = false;
  let mode: "oauth" | "refresh_token" | "service_account" | "none" = "none";
  try {
    if (row?.refreshTokenEnc) {
      connected = true;
      mode = "oauth";
    } else if (config.GOOGLE_REFRESH_TOKEN) {
      connected = true;
      mode = "refresh_token";
    } else if (config.GOOGLE_SERVICE_ACCOUNT_JSON) {
      connected = true;
      mode = "service_account";
    }
  } catch {
    connected = false;
  }
  return {
    connected,
    mode,
    oauthConfigured: oauthConfigured(config),
    googleEmail: row?.googleEmail ?? null,
    folderId: row?.folderId ?? config.GOOGLE_DRIVE_FOLDER_ID,
    lastSyncAt: row?.lastSyncAt ?? null,
    lastError: row?.lastError ?? null,
    connectedAt: row?.connectedAt ?? null,
  };
}

export async function getDrive(config: AppConfig) {
  const { auth, email, folderId } = await authFromConnection(config);
  const drive = google.drive({ version: "v3", auth });
  return { drive, email, folderId };
}

export async function listDriveTree(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<ListedDriveFile[]> {
  const out: ListedDriveFile[] = [];
  const queue: Array<{ id: string; path: string }> = [{ id: folderId, path: "" }];

  while (queue.length) {
    const parent = queue.shift()!;
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${parent.id.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, md5Checksum)",
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id || !f.name) continue;
        const path = parent.path ? `${parent.path}/${f.name}` : f.name;
        if (isJunkPath(path)) continue;
        if (f.mimeType === "application/vnd.google-apps.folder") {
          queue.push({ id: f.id, path });
          continue;
        }
        out.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType ?? "application/octet-stream",
          modifiedTime: f.modifiedTime ? new Date(f.modifiedTime) : new Date(0),
          sizeBytes: f.size ? Number(f.size) : null,
          webViewLink: f.webViewLink ?? undefined,
          path,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  return out;
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("Unexpected Drive download payload");
}

export async function downloadDriveFile(
  drive: drive_v3.Drive,
  file: Pick<ListedDriveFile, "id" | "name" | "mimeType">,
): Promise<{ buffer: Buffer; fileName: string; mime: string }> {
  const spec = googleExportSpec(file.mimeType);
  if (spec) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: spec.mime },
      { responseType: "arraybuffer" },
    );
    return {
      buffer: toBuffer(res.data),
      fileName: exportedFileName(file.name, file.mimeType),
      mime: spec.mime,
    };
  }
  const res = await drive.files.get(
    { fileId: file.id, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return {
    buffer: toBuffer(res.data),
    fileName: file.name,
    mime: file.mimeType,
  };
}

export async function saveDriveConnection(opts: {
  config: AppConfig;
  refreshToken?: string | null;
  email?: string | null;
  folderId: string;
}) {
  const existing = await prisma.driveConnection.findUnique({ where: { id: "default" } });
  const refreshTokenEnc =
    opts.refreshToken != null
      ? encryptSecret(opts.refreshToken, opts.config.JWT_SECRET)
      : existing?.refreshTokenEnc;
  return prisma.driveConnection.upsert({
    where: { id: "default" },
    update: {
      googleEmail: opts.email ?? existing?.googleEmail,
      folderId: opts.folderId,
      refreshTokenEnc,
      lastError: null,
    },
    create: {
      id: "default",
      googleEmail: opts.email ?? undefined,
      folderId: opts.folderId,
      refreshTokenEnc,
    },
  });
}
