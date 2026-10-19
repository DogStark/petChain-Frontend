import { useCallback, useRef, useState } from 'react';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 4096;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const HEIC_TYPES = ['image/heic', 'image/heif'];

interface PetPhotoUploadProps {
  onUpload?: (file: File) => void;
  onError?: (message: string) => void;
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (HEIC_TYPES.includes(type)) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'photo';
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100);
  return cleaned || 'photo';
}

async function normalizeOrientation(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = bitmap;
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
      bitmap.close?.();
      return file;
    }
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) return file;
    return new File([blob], sanitizeFilename(file.name), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function PetPhotoUpload({ onUpload, onError }: PetPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fail = useCallback(
    (message: string) => {
      setStatus(message);
      onError?.(message);
    },
    [onError],
  );

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_BYTES) {
        fail('That photo is too large. Please choose an image under 10 MB.');
        input.value = '';
        return;
      }

      if (isHeic(file)) {
        fail(
          'HEIC/HEIF photos are not supported in this browser. Please convert to JPEG or PNG and try again.',
        );
        input.value = '';
        return;
      }

      if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
        fail('Unsupported image format. Please upload a JPEG, PNG, WebP, or GIF.');
        input.value = '';
        return;
      }

      const normalized = await normalizeOrientation(file);
      const safeName = sanitizeFilename(normalized.name);
      const safeFile = new File([normalized], safeName, { type: normalized.type });

      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(safeFile));
      setStatus(null);
      onUpload?.(safeFile);
      input.value = '';
    },
    [fail, onUpload, preview],
  );

  return (
    <div className="pet-photo-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleChange}
        aria-label="Upload pet photo"
      />
      {preview && (
        <img src={preview} alt="Pet photo preview" className="pet-photo-upload__preview" />
      )}
      {status && (
        <p role="alert" className="pet-photo-upload__status">
          {status}
        </p>
      )}
    </div>
  );
}
