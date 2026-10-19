import React, { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Secure file-name handling for medical uploads.
 *
 * Display names are escaped/normalized separately from storage identifiers.
 * Path traversal, control characters (incl. bidi controls), and excessive
 * lengths are rejected or safely rewritten. Downloads use safe
 * Content-Disposition values and keep the original name only as metadata.
 */

const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_STORAGE_ID_LENGTH = 80;

// Bidi / directional formatting controls and other invisible formatting chars.
const BIDI_AND_FORMAT_CONTROLS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
// C0/C1 control characters.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
// Path separators and traversal markers.
const PATH_SEPARATORS = /[\\/]+/g;
const TRAVERSAL = /(^|[^a-zA-Z0-9])\.\.([^a-zA-Z0-9]|$)/g;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a string for safe rendering in HTML contexts. */
export function escapeDisplayName(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Normalize a user-controlled file name into a safe display name.
 * Strips path components, control/bidi characters, and enforces a max length.
 */
export function normalizeDisplayName(rawName: string): string {
  if (!rawName) return 'unnamed-file';

  // Take only the final path segment to defeat traversal / directory injection.
  const segments = rawName.split(/[\\/]+/).filter(Boolean);
  let name = segments.length > 0 ? segments[segments.length - 1] : rawName;

  name = name
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_AND_FORMAT_CONTROLS, '')
    .replace(TRAVERSAL, '')
    .replace(PATH_SEPARATORS, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove leading dots so hidden/relative names cannot be produced.
  name = name.replace(/^\.+/, '');

  if (!name) return 'unnamed-file';

  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot) : '';
    const base = dot > 0 ? name.slice(0, dot) : name;
    const keep = Math.max(1, MAX_DISPLAY_NAME_LENGTH - ext.length);
    name = base.slice(0, keep) + ext;
  }

  return name;
}

/**
 * Build a storage identifier that is independent from the display name.
 * Only a conservative ASCII subset is allowed; everything else is rewritten.
 */
export function toStorageId(rawName: string, index = 0): string {
  const normalized = normalizeDisplayName(rawName);
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_STORAGE_ID_LENGTH);

  const safeSlug = slug || 'file';
  return `${index}-${safeSlug}`;
}

/** Build a safe Content-Disposition header value for downloads. */
export function buildContentDisposition(rawName: string): string {
  const display = normalizeDisplayName(rawName);
  // ASCII fallback: strip anything outside printable ASCII.
  const asciiFallback = display.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'") || 'download';
  const encoded = encodeURIComponent(display);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export interface UploadedFile {
  /** Safe, escaped name for display. */
  displayName: string;
  /** Escaped display name for direct HTML rendering. */
  escapedDisplayName: string;
  /** Storage identifier, independent from the display name. */
  storageId: string;
  /** Original user-provided name, kept only as metadata. */
  originalName: string;
  /** Safe Content-Disposition value for downloads. */
  contentDisposition: string;
  size: number;
  type: string;
}

interface FileUploadProps {
  onFilesSelected?: (files: UploadedFile[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024;

function toUploadedFile(file: File, index: number): UploadedFile {
  const displayName = normalizeDisplayName(file.name);
  return {
    displayName,
    escapedDisplayName: escapeDisplayName(displayName),
    storageId: toStorageId(file.name, index),
    originalName: file.name,
    contentDisposition: buildContentDisposition(file.name),
    size: file.size,
    type: file.type,
  };
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept,
  multiple = true,
  maxSizeBytes = DEFAULT_MAX_SIZE,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? []);
      const accepted: UploadedFile[] = [];
      let rejected = 0;

      selected.forEach((file, index) => {
        if (file.size > maxSizeBytes) {
          rejected += 1;
          return;
        }
        accepted.push(toUploadedFile(file, index));
      });

      setError(rejected > 0 ? `${rejected} file(s) exceeded the size limit.` : null);
      setFiles((prev) => (multiple ? [...prev, ...accepted] : accepted));
      onFilesSelected?.(accepted);

      if (inputRef.current) inputRef.current.value = '';
    },
    [maxSizeBytes, multiple, onFilesSelected],
  );

  const handleRemove = useCallback((storageId: string) => {
    setFiles((prev) => prev.filter((f) => f.storageId !== storageId));
  }, []);

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files],
  );

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        aria-label="Upload medical files"
      />

      {error && (
        <p className="file-upload__error" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="file-upload__list">
          {files.map((file) => (
            <li key={file.storageId} className="file-upload__item">
              {/* Render the escaped display name; never the raw user input. */}
              <span
                className="file-upload__name"
                title={file.displayName}
                dangerouslySetInnerHTML={{ __html: file.escapedDisplayName }}
              />
              <span className="file-upload__size">{file.size} bytes</span>
              <button
                type="button"
                onClick={() => handleRemove(file.storageId)}
                aria-label={`Remove ${file.displayName}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <p className="file-upload__total">Total: {totalSize} bytes</p>
      )}
    </div>
  );
};

export default FileUpload;
