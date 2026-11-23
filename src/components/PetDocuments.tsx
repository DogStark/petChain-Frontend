import { useCallback, useMemo, useRef, useState } from 'react';

export type PetDocumentCategory = 'insurance' | 'records' | 'certificates';

export interface PetDocument {
  id: string;
  name: string;
  category: PetDocumentCategory;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

interface PetDocumentsProps {
  petId: string;
  documents?: PetDocument[];
  onUpload?: (doc: PetDocument) => void;
  onDelete?: (id: string) => void;
}

const CATEGORY_LABELS: Record<PetDocumentCategory, string> = {
  insurance: 'Insurance',
  records: 'Records',
  certificates: 'Certificates',
};

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return 'Only PDF and image files (JPEG, PNG, WEBP, GIF) are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File must be 10 MB or smaller.';
  }
  return null;
}

export default function PetDocuments({
  petId,
  documents = [],
  onUpload,
  onDelete,
}: PetDocumentsProps) {
  const [category, setCategory] = useState<PetDocumentCategory>('records');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    return documents.reduce<Record<PetDocumentCategory, PetDocument[]>>(
      (acc, doc) => {
        acc[doc.category].push(doc);
        return acc;
      },
      { insurance: [], records: [], certificates: [] },
    );
  }, [documents]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        event.target.value = '';
        return;
      }

      setError(null);
      setUploading(true);
      try {
        const url = URL.createObjectURL(file);
        const doc: PetDocument = {
          id: `${petId}-${Date.now()}`,
          name: file.name,
          category,
          mimeType: file.type,
          size: file.size,
          url,
          uploadedAt: new Date().toISOString(),
        };
        onUpload?.(doc);
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [category, onUpload, petId],
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Documents</h2>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col text-sm text-gray-700">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PetDocumentCategory)}
            className="mt-1 rounded border border-gray-300 px-3 py-2"
          >
            {(Object.keys(CATEGORY_LABELS) as PetDocumentCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload document'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {(Object.keys(CATEGORY_LABELS) as PetDocumentCategory[]).map((key) =>
            grouped[key].length === 0 ? null : (
              <div key={key}>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  {CATEGORY_LABELS[key]}
                </h3>
                <ul className="divide-y divide-gray-100 rounded border border-gray-100">
                  {grouped[key].map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <a
                          href={doc.url}
                          download={doc.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm font-medium text-blue-600 hover:underline"
                        >
                          {doc.name}
                        </a>
                        <span className="text-xs text-gray-500">
                          {formatSize(doc.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDelete?.(doc.id)}
                        className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                        aria-label={`Delete ${doc.name}`}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
