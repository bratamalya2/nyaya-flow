import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export function storageRoot() {
  return path.resolve(process.env.DOCUMENT_STORAGE_ROOT || "/var/lib/nyayaflow/documents");
}

export function resolveStoragePath(relativePath: string) {
  if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\/original$/i.test(relativePath)) throw new Error("Invalid storage path.");
  const root = storageRoot();
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Storage path escaped its root.");
  return resolved;
}

export async function storeRequestBody(request: Request, relativePath: string, expectedBytes: number, expectedSha256: string) {
  if (!request.body) throw new Error("Upload body is empty.");
  const target = resolveStoragePath(relativePath);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  const temporary = `${target}.upload-${crypto.randomUUID()}`;
  let bytes = 0;
  const hash = createHash("sha256");
  const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > expectedBytes || bytes > 100 * 1024 * 1024) return callback(new Error("Upload exceeded its declared size."));
    hash.update(chunk); callback(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(request.body as never), meter, createWriteStream(temporary, { flags: "wx", mode: 0o640 }));
    const digest = hash.digest("hex");
    if (bytes !== expectedBytes || digest.toLowerCase() !== expectedSha256.toLowerCase()) throw new Error("Upload integrity validation failed.");
    await rename(temporary, target);
    return { bytes, sha256: digest };
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
