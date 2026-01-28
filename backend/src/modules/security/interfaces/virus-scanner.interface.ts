/**
 * Virus Scanner Interface
 *
 * Abstract interface for virus scanning providers.
 * Implementations can use ClamAV, VirusTotal API, etc.
 */
export interface IVirusScanner {
  /**
   * Scan a file buffer for viruses
   */
  scan(buffer: Buffer): Promise<VirusScanResult>;

  /**
   * Scan a file by path
   */
  scanFile(filePath: string): Promise<VirusScanResult>;

  /**
   * Check if the scanner is available and healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get scanner information
   */
  getInfo(): Promise<ScannerInfo>;
}

/**
 * Result of a virus scan
 */
export interface VirusScanResult {
  /** Whether the file is clean (no threats detected) */
  clean: boolean;

  /** Whether the scan completed successfully */
  scanned: boolean;

  /** Name of detected threat (if any) */
  threat?: string;

  /** Additional details about the scan */
  details?: {
    scanTime?: number; // Scan duration in ms
    engineVersion?: string;
    definitionDate?: string;
  };

  /** Error message if scan failed */
  error?: string;
}

/**
 * Scanner information
 */
export interface ScannerInfo {
  name: string;
  version: string;
  definitionVersion?: string;
  lastUpdate?: Date;
  available: boolean;
}

/**
 * Injection token for virus scanner
 */
export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');
