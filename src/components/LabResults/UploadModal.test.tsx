/**
 * UploadModal – attachment validation tests
 *
 * RED suite: exercises validation rules that were absent in the original
 * implementation. These tests will fail against the unmodified component
 * and pass once the fix lands.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import UploadModal from './UploadModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a synthetic File without triggering real I/O. */
function makeFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

const PDF_1MB = makeFile('report.pdf', 1 * 1024 * 1024, 'application/pdf');
const PDF_OVER_LIMIT = makeFile('big.pdf', 11 * 1024 * 1024, 'application/pdf');
const PDF_EXACT_LIMIT = makeFile('exact.pdf', 10 * 1024 * 1024, 'application/pdf');
const PNG_FILE = makeFile('image.png', 500 * 1024, 'image/png');
const EXEC_FILE = makeFile('malware.exe', 100, 'application/octet-stream');
const DISGUISED_FILE = makeFile('report.pdf', 100, 'application/x-executable');
const DIRTY_FILENAME = makeFile('../../../etc/passwd', 1024, 'application/pdf');
const LONG_FILENAME = makeFile('a'.repeat(256) + '.pdf', 1024, 'application/pdf');
const SCRIPT_FILENAME = makeFile('<script>alert(1)</script>.pdf', 1024, 'application/pdf');

function getFileInput(): HTMLInputElement {
  // The hidden file input is identified by its id
  return document.getElementById('file-upload') as HTMLInputElement;
}

// ---------------------------------------------------------------------------
// Rendering helper
// ---------------------------------------------------------------------------
function renderModal() {
  const onClose = jest.fn();
  const utils = render(<UploadModal onClose={onClose} />);
  return { onClose, ...utils };
}

// ---------------------------------------------------------------------------
// RED tests – these characterise MISSING behaviour
// ---------------------------------------------------------------------------

describe('UploadModal – file type validation', () => {
  it('rejects a PNG file with an accessible error message', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [PNG_FILE] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/pdf/i);
    // File must NOT be accepted
    expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
  });

  it('rejects an executable disguised as PDF based on MIME type', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [EXEC_FILE] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('rejects a file whose MIME type is not in the allowlist even if extension is .pdf', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [DISGUISED_FILE] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('UploadModal – file size validation', () => {
  it('rejects a PDF exceeding the 10 MB limit', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [PDF_OVER_LIMIT] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/10\s*mb|size|too large/i);
  });

  it('accepts a PDF that is exactly 10 MB', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [PDF_EXACT_LIMIT] } });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    // Confirm & Analyse button should now be enabled
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled();
  });

  it('accepts a valid 1 MB PDF', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [PDF_1MB] } });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled();
  });
});

describe('UploadModal – filename sanitization', () => {
  it('rejects a path-traversal filename', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [DIRTY_FILENAME] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/filename|invalid/i);
  });

  it('rejects a filename that is excessively long', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [LONG_FILENAME] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('rejects a filename containing HTML/script injection characters', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [SCRIPT_FILENAME] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('UploadModal – accessible error UI', () => {
  it('error container has role="alert" so screen readers announce it', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [PNG_FILE] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  it('error container is aria-live="assertive" or role="alert" (implicit assertive)', async () => {
    renderModal();
    fireEvent.change(getFileInput(), { target: { files: [PNG_FILE] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      // role="alert" implies aria-live="assertive"; both are acceptable
      const live = alert.getAttribute('aria-live');
      expect(live === null || live === 'assertive' || live === 'polite').toBe(true);
    });
  });

  it('clears error when a valid file replaces an invalid one', async () => {
    renderModal();

    // First trigger an error
    fireEvent.change(getFileInput(), { target: { files: [PNG_FILE] } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // Then pick a valid file
    fireEvent.change(getFileInput(), { target: { files: [PDF_1MB] } });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('UploadModal – drag-and-drop validation', () => {
  it('rejects a PNG dropped onto the drop zone', async () => {
    renderModal();

    // Use the container div (parent of the input)
    const dropArea = document
      .querySelector('.border-dashed') as HTMLElement;

    fireEvent.drop(dropArea, {
      dataTransfer: { files: [PNG_FILE] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('rejects an oversized PDF dropped onto the drop zone', async () => {
    renderModal();
    const dropArea = document.querySelector('.border-dashed') as HTMLElement;

    fireEvent.drop(dropArea, {
      dataTransfer: { files: [PDF_OVER_LIMIT] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/10\s*mb|size|too large/i);
  });
});

describe('UploadModal – loading / empty state', () => {
  it('shows the upload area when no file is selected', () => {
    renderModal();
    expect(screen.getByText(/drag & drop your pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });
});
