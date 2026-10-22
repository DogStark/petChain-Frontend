import {
  AttachmentQueueManager,
  type AttachmentQueueStore,
  type AttachmentUploader,
  type QueuedAttachmentRecord,
} from './attachmentQueue';

class MemoryAttachmentStore implements AttachmentQueueStore {
  private records = new Map<number, QueuedAttachmentRecord>();
  private nextId = 1;

  async add(record: Omit<QueuedAttachmentRecord, 'id'>): Promise<number> {
    const id = this.nextId++;
    this.records.set(id, { ...record, id });
    return id;
  }

  async getAll(): Promise<QueuedAttachmentRecord[]> {
    return Array.from(this.records.values()).map((record) => ({ ...record }));
  }

  async get(id: number): Promise<QueuedAttachmentRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async put(record: QueuedAttachmentRecord): Promise<void> {
    this.records.set(record.id, { ...record });
  }

  async delete(id: number): Promise<void> {
    this.records.delete(id);
  }
}

function pdfFile(name = 'report.pdf', size = 11): File {
  return new File(['%PDF-1.4\n'.padEnd(size, 'x')], name, { type: 'application/pdf' });
}

function createQueue(
  store: MemoryAttachmentStore,
  uploader: AttachmentUploader,
  options: { isOnline?: () => boolean; maxAttempts?: number } = {},
) {
  return new AttachmentQueueManager(store, uploader, {
    isOnline: options.isOnline ?? (() => true),
    maxAttempts: options.maxAttempts ?? 3,
    now: () => 1_000,
  });
}

describe('AttachmentQueueManager', () => {
  it('returns an empty list when nothing is queued', async () => {
    const store = new MemoryAttachmentStore();
    const queue = createQueue(store, jest.fn());

    await expect(queue.list('pet-1')).resolves.toEqual([]);
  });

  it('queues a valid PDF with its name, size and initial retry state', async () => {
    const store = new MemoryAttachmentStore();
    const queue = createQueue(store, jest.fn());

    const queued = await queue.enqueue(pdfFile('bloodwork.pdf', 2048), 'pet-1');

    expect(queued).toEqual(
      expect.objectContaining({
        petId: 'pet-1',
        name: 'bloodwork.pdf',
        size: 2048,
        status: 'queued',
        progress: 0,
        attempts: 0,
        maxAttempts: 3,
        canRetry: false,
      }),
    );
    expect(await queue.list('pet-1')).toHaveLength(1);
    // The blob must never be handed to the UI layer.
    expect(queued).not.toHaveProperty('blob');
  });

  it('rejects non-PDF, oversized and unsafe filenames before storing anything', async () => {
    const store = new MemoryAttachmentStore();
    const queue = createQueue(store, jest.fn());

    await expect(
      queue.enqueue(new File(['hello'], 'notes.txt', { type: 'text/plain' }), 'pet-1'),
    ).rejects.toThrow(/Only PDF files/i);
    await expect(
      queue.enqueue(new File(['%PDF-1.4'], '<script>.pdf', { type: 'application/pdf' }), 'pet-1'),
    ).rejects.toThrow(/Invalid filename/i);

    const oversized = {
      name: 'huge.pdf',
      size: 11 * 1024 * 1024,
      type: 'application/pdf',
    } as unknown as File;
    await expect(queue.enqueue(oversized, 'pet-1')).rejects.toThrow(/too large/i);

    expect(await queue.list()).toEqual([]);
  });

  it('scopes listed attachments to the requested pet', async () => {
    const store = new MemoryAttachmentStore();
    const queue = createQueue(store, jest.fn());

    await queue.enqueue(pdfFile('one.pdf'), 'pet-1');
    await queue.enqueue(pdfFile('two.pdf'), 'pet-2');

    expect((await queue.list('pet-1')).map((item) => item.name)).toEqual(['one.pdf']);
    expect(await queue.list()).toHaveLength(2);
  });

  it('uploads queued attachments, reports progress and deletes the local file on success', async () => {
    const store = new MemoryAttachmentStore();
    const progress: number[] = [];
    const snapshots: number[][] = [];
    const uploader = jest.fn<Promise<void>, Parameters<AttachmentUploader>>(
      async (_record, onProgress) => {
        onProgress(35);
        progress.push(35);
        onProgress(80);
        progress.push(80);
        onProgress(100);
        progress.push(100);
      },
    );
    const queue = createQueue(store, uploader);

    const queued = await queue.enqueue(pdfFile('report.pdf'), 'pet-1');
    const result = await queue.process('pet-1', (items) => {
      snapshots.push(items.map((item) => item.progress));
    });

    expect(result).toEqual({ uploaded: 1, failed: 0 });
    expect(progress).toEqual([35, 80, 100]);
    expect(snapshots.flat()).toContain(80);
    // Success removes both the metadata and the retained blob.
    expect(await store.get(queued.id)).toBeNull();
    expect(await queue.list('pet-1')).toEqual([]);
  });

  it('persists retry state after a failure and skips automatic retries once exhausted', async () => {
    const store = new MemoryAttachmentStore();
    const uploader = jest.fn<Promise<void>, Parameters<AttachmentUploader>>(async () => {
      throw new Error('Network unavailable');
    });
    const queue = createQueue(store, uploader, { maxAttempts: 2 });

    const queued = await queue.enqueue(pdfFile('report.pdf'), 'pet-1');

    await expect(queue.process('pet-1')).resolves.toEqual({ uploaded: 0, failed: 1 });
    let failed = (await queue.list('pet-1'))[0];
    expect(failed).toEqual(
      expect.objectContaining({
        status: 'failed',
        attempts: 1,
        lastError: 'Network unavailable',
        canRetry: true,
      }),
    );

    await queue.process('pet-1');
    failed = (await queue.list('pet-1'))[0];
    expect(failed.attempts).toBe(2);

    // The retry budget is exhausted: a third run leaves the record untouched.
    await expect(queue.process('pet-1')).resolves.toEqual({ uploaded: 0, failed: 0 });
    expect(uploader).toHaveBeenCalledTimes(2);
    expect((await queue.list('pet-1'))[0].attempts).toBe(2);
  });

  it('retry resets the attempt budget so the attachment uploads on the next run', async () => {
    const store = new MemoryAttachmentStore();
    let shouldFail = true;
    const uploader = jest.fn<Promise<void>, Parameters<AttachmentUploader>>(async () => {
      if (shouldFail) throw new Error('Server error');
    });
    const queue = createQueue(store, uploader, { maxAttempts: 1 });

    const queued = await queue.enqueue(pdfFile('report.pdf'), 'pet-1');
    await queue.process('pet-1');
    expect((await queue.list('pet-1'))[0].status).toBe('failed');

    shouldFail = false;
    await queue.retry(queued.id, 'pet-1');
    expect((await queue.list('pet-1'))[0]).toEqual(
      expect.objectContaining({ status: 'queued', attempts: 0, progress: 0 }),
    );

    await expect(queue.process('pet-1')).resolves.toEqual({ uploaded: 1, failed: 0 });
    expect(await queue.list('pet-1')).toEqual([]);
  });

  it('removes a queued attachment and its local file', async () => {
    const store = new MemoryAttachmentStore();
    const queue = createQueue(store, jest.fn());

    const queued = await queue.enqueue(pdfFile('report.pdf'), 'pet-1');
    await queue.remove(queued.id, 'pet-1');

    expect(await store.get(queued.id)).toBeNull();
    expect(await queue.list('pet-1')).toEqual([]);
  });

  it('refuses to remove another pet\u2019s attachment', async () => {
    const store = new MemoryAttachmentStore();
    const queue = createQueue(store, jest.fn());

    const queued = await queue.enqueue(pdfFile('report.pdf'), 'pet-1');
    await expect(queue.remove(queued.id, 'pet-2')).rejects.toThrow(/no longer in the queue/i);
    expect(await store.get(queued.id)).not.toBeNull();
  });

  it('does not remove an attachment while its upload is in flight', async () => {
    const store = new MemoryAttachmentStore();
    let finishUpload: (() => void) | undefined;
    const uploader = jest.fn<Promise<void>, Parameters<AttachmentUploader>>(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const queue = createQueue(store, uploader);

    const queued = await queue.enqueue(pdfFile('report.pdf'), 'pet-1');
    const processing = queue.process('pet-1');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(queue.remove(queued.id, 'pet-1')).rejects.toThrow(/current upload/i);

    finishUpload?.();
    await processing;
  });

  it('does nothing while offline', async () => {
    const store = new MemoryAttachmentStore();
    const uploader = jest.fn();
    const queue = createQueue(store, uploader, { isOnline: () => false });

    await queue.enqueue(pdfFile('report.pdf'), 'pet-1');

    await expect(queue.process('pet-1')).resolves.toEqual({ uploaded: 0, failed: 0 });
    expect(uploader).not.toHaveBeenCalled();
    expect(await queue.list('pet-1')).toHaveLength(1);
  });
});
