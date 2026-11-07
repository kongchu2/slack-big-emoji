import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const FILE_PATTERN = /^[a-f0-9]{32}\.(png|gif)$/;

export async function upscale(source, scale) {
  const meta = await sharp(source, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1 || meta.format === 'gif';
  const width = meta.width * scale;
  const image = sharp(source, { animated: true }).resize({
    width,
    kernel: animated ? sharp.kernel.nearest : sharp.kernel.lanczos3,
  });
  const output = animated ? await image.gif({ reuse: true, effort: 7 }).toBuffer() : await image.png().toBuffer();
  return { buffer: output, ext: animated ? 'gif' : 'png' };
}

export function createScaler({ dir, publicUrl }) {
  const base = publicUrl.replace(/\/$/, '');
  const pending = new Map();

  async function exists(path) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async function build(emoji, scale, key) {
    for (const ext of ['png', 'gif']) {
      if (await exists(join(dir, `${key}.${ext}`))) return `${base}/img/${key}.${ext}`;
    }
    const response = await fetch(emoji.url);
    if (!response.ok) throw new Error(`이모지 이미지를 받지 못했습니다 (${response.status})`);
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) throw new Error('이모지 이미지가 너무 큽니다');
    const { buffer, ext } = await upscale(source, scale);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${key}.${ext}`);
    await writeFile(`${path}.tmp`, buffer);
    await rename(`${path}.tmp`, path);
    return `${base}/img/${key}.${ext}`;
  }

  async function scaledUrl(emoji, scale) {
    const key = createHash('sha256').update(`${emoji.url}@${scale}`).digest('hex').slice(0, 32);
    if (!pending.has(key)) {
      pending.set(
        key,
        build(emoji, scale, key).finally(() => pending.delete(key)),
      );
    }
    return pending.get(key);
  }

  async function serve(req, res) {
    const file = req.params?.file ?? '';
    if (!FILE_PATTERN.test(file)) {
      res.writeHead(404);
      return res.end();
    }
    try {
      const body = await readFile(join(dir, file));
      res.writeHead(200, {
        'Content-Type': file.endsWith('.gif') ? 'image/gif' : 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  }

  return { scaledUrl, serve };
}
