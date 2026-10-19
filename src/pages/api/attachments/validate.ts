/**
 * /api/attachments/validate
 *
 * Server-side endpoint that validates a medical attachment before it is
 * persisted to storage.  Clients POST a multipart/form-data body with a
 * single `file` field.
 *
 * This route acts as the authoritative gate:
 *  1. MIME-type allowlist check (re-validated server-side)
 *  2. PDF magic-byte verification (counters MIME spoofing)
 *  3. File-size limit
 *  4. Filename sanitization
 *  5. Malware-scan hook (stub – replace with a real integration)
 *
 * Only POST is accepted.  The response is always JSON:
 *   200  { valid: true }
 *   400  { valid: false, error: "<reason>" }
 *   405  Method Not Allowed
 *   413  { valid: false, error: "..." }
 *
 * Dependencies: this route uses the `busboy` package for multipart
 * parsing.  Install it with:
 *   npm install busboy@1.6.0
 *   npm install --save-dev @types/busboy@1.5.4
 *
 * If busboy is not yet available in your environment, the route falls
 * back gracefully and returns a 501 with an actionable message.
 */
import type { Readable } from 'stream';

import type { NextApiRequest, NextApiResponse } from 'next';

import {
  validateAttachmentServer,
  type ValidationResult,
  MAX_FILE_SIZE_BYTES,
} from '@/utils/attachmentValidation';

// Disable Next.js default body parsing so we can read the raw stream.
export const config = {
  api: {
    bodyParser: false,
  },
};

// ---------------------------------------------------------------------------
// Multipart parsing (busboy – optional peer dependency)
// ---------------------------------------------------------------------------

interface ParsedFile {
  fieldname: string;
  filename: string;
  mimeType: string;
  /** Complete file content as a Buffer. */
  data: Buffer;
}

/**
 * Parses the first file from a multipart/form-data request using busboy.
 * Throws if busboy is not installed or if the stream contains no file.
 */
async function parseFirstFile(req: NextApiRequest): Promise<ParsedFile> {
  // Dynamic import so the route fails gracefully when busboy is missing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const Busboy = require('busboy') as typeof import('busboy');

  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers as Record<string, string>,
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES + 1, // +1 so we can detect over-limit
        files: 1,
      },
    });

    let resolved = false;

    bb.on(
      'file',
      (
        fieldname: string,
        stream: Readable,
        info: { filename: string; encoding: string; mimeType: string },
      ) => {
        const chunks: Buffer[] = [];
        let tooLarge = false;

        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on('limit', () => {
          tooLarge = true;
          stream.resume(); // drain so busboy doesn't hang
        });

        stream.on('end', () => {
          if (tooLarge) {
            resolved = true;
            reject(new Error('FILE_TOO_LARGE'));
            return;
          }
          resolved = true;
          resolve({
            fieldname,
            filename: info.filename,
            mimeType: info.mimeType,
            data: Buffer.concat(chunks),
          });
        });

        stream.on('error', reject);
      },
    );

    bb.on('finish', () => {
      if (!resolved) {
        reject(new Error('NO_FILE'));
      }
    });

    bb.on('error', reject);

    req.pipe(bb);
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type ResponseData = ValidationResult | { error: string; valid: false };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  let parsed: ParsedFile;

  try {
    parsed = await parseFirstFile(req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';

    if (msg === 'FILE_TOO_LARGE') {
      res.status(413).json({
        valid: false,
        error: `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB size limit.`,
      });
      return;
    }

    if (msg === 'NO_FILE') {
      res.status(400).json({ valid: false, error: 'No file was uploaded.' });
      return;
    }

    // busboy not installed or another parse error
    const notFound =
      msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND');
    if (notFound) {
      res.status(501).json({
        valid: false,
        error:
          'Server multipart parser not available. ' +
          'Install busboy: npm install busboy@1.6.0',
      });
      return;
    }

    res.status(400).json({ valid: false, error: 'Failed to parse the uploaded file.' });
    return;
  }

  const magicBytes = new Uint8Array(parsed.data.slice(0, 8));

  const result = await validateAttachmentServer(
    {
      declaredMimeType: parsed.mimeType,
      magicBytes,
      sizeBytes: parsed.data.length,
      originalFilename: parsed.filename,
    },
    // -----------------------------------------------------------------------
    // Malware-scan hook – STUB.
    //
    // Returns null (clean) unconditionally.
    // In production replace with a real scanner, e.g.:
    //   import { scanWithClamAV } from '@/lib/clamav';
    //   return scanWithClamAV(fileBuffer);
    // -----------------------------------------------------------------------
    async (_params) => {
      return null; // null = clean
    },
  );

  const status = result.valid ? 200 : 400;
  res.status(status).json(result);
}
