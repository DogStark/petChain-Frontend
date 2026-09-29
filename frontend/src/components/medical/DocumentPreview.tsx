import React, { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Content sniffing guard for medical document previews.
 *
 * A response with a misleading content type must never be rendered as active
 * HTML/script inside an authenticated page. We validate magic bytes against an
 * allowlist of safe formats before previewing, sandbox the preview, and fall
 * back to a safe download (attachment disposition) for anything unsupported.
 */

export type DocumentPreviewStatus =
  | 'idle'
  | 'loading'
  | 'previewable'
  | 'unsupported'
  | 'error';

export interface DocumentPreviewProps {
  /** URL of the medical document to preview. */
  src: string;
  /** Optional filename used for the download fallback. */
  fileName?: string;
  /** Optional MIME type hint from the server (never trusted on its own). */
  mimeType?: string;
  /** Optional accessible title for the preview region. */
  title?: string;
}

interface SniffResult {
  /** Allowlisted format detected from magic bytes, or null when unsupported. */
  format: 'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | null;
  /** MIME type to use for the sandboxed preview. */
  mimeType: string | null;
}

const MAX_SNIFF_BYTES = 512;

/**
 * Inspect the leading bytes of a response and return an allowlisted format.
 * Anything that is not a known-safe binary format (including HTML/script) is
 * treated as unsupported so it can never be embedded as a document.
 */
export function sniffDocumentFormat(bytes: Uint8Array): SniffResult {
  const unsupported: SniffResult = { format: null, mimeType: null };
  if (!bytes || bytes.length < 4) {
    return unsupported;
  }

  // PDF: %PDF
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { format: 'pdf', mimeType: 'application/pdf' };
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { format: 'png', mimeType: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }

  // GIF: GIF8
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return { format: 'gif', mimeType: 'image/gif' };
  }

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { format: 'webp', mimeType: 'image/webp' };
  }

  return unsupported;
}

/**
 * Detect HTML/script content so it is explicitly rejected rather than embedded.
 */
export function looksLikeActiveContent(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length === 0) {
    return false;
  }
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, MAX_SNIFF_BYTES))
    .trimStart()
    .toLowerCase();
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<script') ||
    head.startsWith('<?xml') ||
    head.startsWith('<svg')
  );
}

function buildDownloadUrl(src: string, fileName?: string): string {
  if (!fileName) {
    return src;
  }
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}download=${encodeURIComponent(fileName)}`;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  src,
  fileName,
  mimeType,
  title = 'Medical document preview',
}) => {
  const [status, setStatus] = useState<DocumentPreviewStatus>('idle');
  const [detectedMime, setDetectedMime] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const downloadUrl = useMemo(() => buildDownloadUrl(src, fileName), [src, fileName]);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    const run = async () => {
      setStatus('loading');
      setDetectedMime(null);
      try {
        const response = await fetch(src, {
          credentials: 'include',
          headers: { Accept: 'application/pdf,image/*' },
        });
        if (!response.ok) {
          // Never surface the response body on error.
          throw new Error(`Request failed with status ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        if (looksLikeActiveContent(bytes)) {
          if (!cancelled) {
            setStatus('unsupported');
          }
          return;
        }

        const sniffed = sniffDocumentFormat(bytes);
        if (!sniffed.format || !sniffed.mimeType) {
          if (!cancelled) {
            setStatus('unsupported');
          }
          return;
        }

        // Rebuild the blob with the sniffed MIME type so the browser cannot be
        // tricked into rendering it as HTML via a misleading content type.
        const blob = new Blob([bytes], { type: sniffed.mimeType });
        createdUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setDetectedMime(sniffed.mimeType);
          setObjectUrl(createdUrl);
          setStatus('previewable');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.rel = 'noopener noreferrer';
    // Safe download disposition: never navigate the authenticated page.
    link.setAttribute('download', fileName ?? 'medical-document');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadUrl, fileName]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="document-preview document-preview--loading" role="status">
        Loading document…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="document-preview document-preview--error" role="alert">
        <p>Unable to load this document.</p>
        <button type="button" onClick={handleDownload}>
          Download document
        </button>
      </div>
    );
  }

  if (status === 'unsupported' || !objectUrl) {
    return (
      <div className="document-preview document-preview--unsupported" role="alert">
        <p>This document format cannot be previewed safely.</p>
        <button type="button" onClick={handleDownload}>
          Download document
        </button>
      </div>
    );
  }

  const isPdf = detectedMime === 'application/pdf';

  return (
    <div className="document-preview" data-mime={detectedMime ?? mimeType ?? ''}>
      {isPdf ? (
        <object
          data={objectUrl}
          type="application/pdf"
          title={title}
          className="document-preview__frame"
        >
          <button type="button" onClick={handleDownload}>
            Download document
          </button>
        </object>
      ) : (
        <img
          src={objectUrl}
          alt={title}
          className="document-preview__image"
        />
      )}
      <button type="button" onClick={handleDownload}>
        Download document
      </button>
    </div>
  );
};

export default DocumentPreview;
