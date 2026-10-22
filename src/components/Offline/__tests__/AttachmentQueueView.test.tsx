import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AttachmentQueueView from '../AttachmentQueueView';
import { useAttachmentQueue, type AttachmentQueueState } from '@/hooks/useAttachmentQueue';
import type { QueuedAttachment } from '@/lib/offline/attachmentQueue';

jest.mock('@/hooks/useAttachmentQueue', () => ({
  useAttachmentQueue: jest.fn(),
}));

const mockedUseAttachmentQueue = useAttachmentQueue as jest.MockedFunction<
  typeof useAttachmentQueue
>;

function queueItem(overrides: Partial<QueuedAttachment> = {}): QueuedAttachment {
  return {
    id: 1,
    petId: 'pet-1',
    name: 'bloodwork.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    status: 'queued',
    progress: 0,
    attempts: 0,
    maxAttempts: 3,
    canRetry: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function state(overrides: Partial<AttachmentQueueState> = {}): AttachmentQueueState {
  return {
    attachments: [],
    isOnline: true,
    isProcessing: false,
    error: null,
    clearError: jest.fn(),
    addFiles: jest.fn().mockResolvedValue(undefined),
    removeAttachment: jest.fn().mockResolvedValue(undefined),
    retryAttachment: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AttachmentQueueView', () => {
  it('renders an empty state before anything is queued', () => {
    mockedUseAttachmentQueue.mockReturnValue(state());

    render(<AttachmentQueueView petId="pet-1" />);

    expect(screen.getByRole('heading', { name: /lab report attachments/i })).toBeInTheDocument();
    expect(screen.getByText(/nothing queued/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add attachments/i })).toBeEnabled();
  });

  it('shows the attachment name, size, upload progress and retry state', () => {
    mockedUseAttachmentQueue.mockReturnValue(
      state({ attachments: [queueItem({ status: 'uploading', progress: 42 })] }),
    );

    render(<AttachmentQueueView petId="pet-1" />);

    expect(screen.getByText('bloodwork.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/uploading… 42%/i)).toBeInTheDocument();

    const progress = screen.getByRole('progressbar', {
      name: /upload progress for bloodwork\.pdf/i,
    });
    expect(progress).toHaveAttribute('aria-valuenow', '42');
    expect(progress).toHaveAttribute('aria-valuetext', '42% uploaded');

    // Removal is unavailable while bytes are in flight.
    expect(
      screen.getByRole('button', { name: /remove bloodwork\.pdf from the upload queue/i }),
    ).toBeDisabled();
  });

  it('removes a queued attachment before upload starts', () => {
    const removeAttachment = jest.fn().mockResolvedValue(undefined);
    mockedUseAttachmentQueue.mockReturnValue(
      state({ attachments: [queueItem()], removeAttachment }),
    );

    render(<AttachmentQueueView petId="pet-1" />);

    fireEvent.click(
      screen.getByRole('button', { name: /remove bloodwork\.pdf from the upload queue/i }),
    );

    expect(removeAttachment).toHaveBeenCalledWith(1);
  });

  it('offers a retry with its failure state when an upload fails', () => {
    const retryAttachment = jest.fn().mockResolvedValue(undefined);
    mockedUseAttachmentQueue.mockReturnValue(
      state({
        attachments: [
          queueItem({
            status: 'failed',
            attempts: 1,
            lastError: 'Network unavailable',
            canRetry: true,
          }),
        ],
        retryAttachment,
      }),
    );

    render(<AttachmentQueueView petId="pet-1" />);

    expect(screen.getByText(/upload failed \(attempt 1 of 3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/network unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry uploading bloodwork\.pdf/i }));
    expect(retryAttachment).toHaveBeenCalledWith(1);
  });

  it('disables retry while offline and announces the offline state', () => {
    mockedUseAttachmentQueue.mockReturnValue(
      state({
        isOnline: false,
        attachments: [queueItem({ status: 'failed', attempts: 1 })],
      }),
    );

    render(<AttachmentQueueView petId="pet-1" />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry uploading bloodwork\.pdf/i }),
    ).toBeDisabled();
  });

  it('queues selected files through the hook', () => {
    const addFiles = jest.fn().mockResolvedValue(undefined);
    mockedUseAttachmentQueue.mockReturnValue(state({ addFiles }));

    render(<AttachmentQueueView petId="pet-1" />);

    const input = screen.getByLabelText(/select PDF attachments to queue/i) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    fireEvent.change(input);

    expect(addFiles).toHaveBeenCalledWith([file]);
  });

  it('surfaces hook errors in an alert that can be dismissed', () => {
    const clearError = jest.fn();
    mockedUseAttachmentQueue.mockReturnValue(
      state({ error: 'Only PDF files are accepted.', clearError }),
    );

    render(<AttachmentQueueView petId="pet-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Only PDF files are accepted.');
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
    expect(clearError).toHaveBeenCalled();
  });

  it('asks the user to open a pet profile when no pet is selected', () => {
    mockedUseAttachmentQueue.mockReturnValue(state());

    render(<AttachmentQueueView />);

    expect(screen.getByText(/open a pet profile to queue attachments/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add attachments/i })).toBeDisabled();
  });
});
