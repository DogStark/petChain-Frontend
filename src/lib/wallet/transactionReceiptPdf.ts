import type { Transaction } from '@/lib/api/transactionAPI';

export type ReceiptNetwork = 'TESTNET' | 'PUBLIC';

export function isReceiptEligibleTransaction(transaction: Transaction): boolean {
  return (
    transaction.status === 'confirmed' &&
    typeof transaction.hash === 'string' &&
    Boolean(transaction.hash.trim())
  );
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

function formatTimestamp(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitPdfLine(value: string, maxLength = 84): string[] {
  const safeValue = value.replace(/[^\x20-\x7E]/g, '?');
  const lines: string[] = [];
  for (let offset = 0; offset < safeValue.length; offset += maxLength) {
    lines.push(escapePdfText(safeValue.slice(offset, offset + maxLength)));
  }
  return lines.length ? lines : [''];
}

function metadataForReceipt(metadata?: Record<string, unknown>): string {
  if (!metadata) return 'Not provided';
  return JSON.stringify(metadata, (key, value: unknown) =>
    /secret|password|private.?key|seed|pin|token/i.test(key) ? undefined : value
  ) ?? 'Not provided';
}

export function createTransactionReceiptPdf(
  transaction: Transaction,
  network: ReceiptNetwork
): Uint8Array {
  if (!isReceiptEligibleTransaction(transaction)) {
    throw new Error('A receipt is available only for confirmed transactions with a hash.');
  }

  const networkLabel = network === 'TESTNET' ? 'Stellar Testnet' : 'Stellar Mainnet';
  const fields: Array<[string, string]> = [
    ['Transaction ID', transaction.id],
    ['Transaction hash', transaction.hash],
    ['Status', transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)],
    ['Type', transaction.type],
    ['From address', transaction.fromAddress],
    ['To address', transaction.toAddress ?? 'Not provided'],
    ['Amount', transaction.amount ?? 'Not provided'],
    ['Fee', transaction.fee],
    ['Transaction time', formatTimestamp(transaction.timestamp) ?? transaction.timestamp],
    ['Ledger', transaction.blockNumber == null ? 'Not provided' : String(transaction.blockNumber)],
    ['Confirmations', String(transaction.confirmations)],
    ['Metadata', metadataForReceipt(transaction.metadata)],
    ['Error message', transaction.errorMessage ?? 'None'],
  ];
  const lines = [
    'PetChain Wallet Transaction Receipt',
    `Network: ${networkLabel}`,
    ...fields.flatMap(([label, value]) => splitPdfLine(`${label}: ${value}`)),
  ];
  const linesPerPage = 30;
  const pages: string[][] = [];
  for (let offset = 0; offset < lines.length; offset += linesPerPage) {
    pages.push(lines.slice(offset, offset + linesPerPage));
  }

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((pageLines, pageIndex) => {
    const textCommands = pageLines
      .map((line, lineIndex) => {
        const title = pageIndex === 0 && lineIndex === 0;
        const fontSize = title ? 18 : 10;
        const y = title ? 750 : 720 - (lineIndex - (pageIndex === 0 ? 1 : 0)) * 20;
        return `/F1 ${fontSize} Tf 1 0 0 1 50 ${y} Tm (${line}) Tj`;
      })
      .join('\n');
    const content = `BT\n${textCommands}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + pageIndex * 2} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export function downloadTransactionReceiptPdf(
  transaction: Transaction,
  network: ReceiptNetwork
): void {
  const pdf = createTransactionReceiptPdf(transaction, network);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeId = transaction.id.replace(/[^a-zA-Z0-9_-]/g, '') || 'transaction';
  link.href = url;
  link.download = `petchain-receipt-${safeId}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
