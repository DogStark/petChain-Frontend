import type { Transaction } from '@/lib/api/transactionAPI';

export type ReceiptNetwork = 'TESTNET' | 'PUBLIC';

export function isReceiptEligibleTransaction(transaction: Transaction): boolean {
  return (
    transaction.type === 'transfer' &&
    transaction.status === 'confirmed' &&
    typeof transaction.hash === 'string' &&
    Boolean(transaction.hash.trim()) &&
    Number.isSafeInteger(transaction.blockNumber) &&
    (transaction.blockNumber ?? 0) > 0
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

export function createTransactionReceiptPdf(
  transaction: Transaction,
  network: ReceiptNetwork
): Uint8Array {
  if (!isReceiptEligibleTransaction(transaction)) {
    throw new Error('A receipt is available only for confirmed transactions with a ledger and hash.');
  }

  const networkLabel = network === 'TESTNET' ? 'Stellar Testnet' : 'Stellar Mainnet';
  const timestamp = formatTimestamp(transaction.timestamp);
  const lines = [
    'PetChain Wallet Transaction Receipt',
    'Status: Confirmed',
    `Network: ${networkLabel}`,
    `Transaction hash: ${transaction.hash}`,
    `Ledger: ${transaction.blockNumber}`,
    `Confirmations: ${transaction.confirmations}`,
    ...(timestamp ? [`Transaction time: ${timestamp}`] : []),
  ];

  const textCommands = lines
    .map((line, index) => {
      const fontSize = index === 0 ? 18 : 11;
      const y = index === 0 ? 750 : 710 - (index - 1) * 24;
      return `/F1 ${fontSize} Tf 1 0 0 1 50 ${y} Tm (${escapePdfText(line)}) Tj`;
    })
    .join('\n');
  const content = `BT\n${textCommands}\nET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

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
  const safeHash = transaction.hash.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  link.href = url;
  link.download = `petchain-receipt-${safeHash}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
