import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IVirusScanner,
  VirusScanResult,
  ScannerInfo,
} from './interfaces/virus-scanner.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

/**
 * ClamAV Scanner Service
 *
 * Integrates with ClamAV daemon for virus scanning.
 * Falls back to mock scanning in development if ClamAV is unavailable.
 */
@Injectable()
export class VirusScannerService implements IVirusScanner, OnModuleInit {
  private readonly logger = new Logger(VirusScannerService.name);
  private clamavAvailable = false;
  private clamavHost: string;
  private clamavPort: number;

  constructor(private readonly configService: ConfigService) {
    this.clamavHost =
      this.configService.get<string>('CLAMAV_HOST') || 'localhost';
    this.clamavPort = this.configService.get<number>('CLAMAV_PORT') || 3310;
  }

  async onModuleInit(): Promise<void> {
    this.clamavAvailable = await this.isAvailable();
    if (this.clamavAvailable) {
      this.logger.log('ClamAV scanner connected successfully');
    } else {
      this.logger.warn(
        'ClamAV not available. Virus scanning will use fallback mode.',
      );
    }
  }

  /**
   * Scan a buffer for viruses
   */
  async scan(buffer: Buffer): Promise<VirusScanResult> {
    const startTime = Date.now();

    if (!this.clamavAvailable) {
      return this.fallbackScan(buffer, startTime);
    }

    try {
      // Write buffer to temp file for scanning
      const tempPath = path.join(os.tmpdir(), `scan-${randomUUID()}`);
      await fs.promises.writeFile(tempPath, buffer);

      try {
        const result = await this.scanFile(tempPath);
        return result;
      } finally {
        // Clean up temp file
        await fs.promises.unlink(tempPath).catch(() => {});
      }
    } catch (error) {
      this.logger.error('Virus scan failed:', error);
      return {
        clean: false,
        scanned: false,
        error: error instanceof Error ? error.message : 'Scan failed',
      };
    }
  }

  /**
   * Scan a file by path using ClamAV
   */
  async scanFile(filePath: string): Promise<VirusScanResult> {
    const startTime = Date.now();

    if (!this.clamavAvailable) {
      // Read file and use fallback
      const buffer = await fs.promises.readFile(filePath);
      return this.fallbackScan(buffer, startTime);
    }

    try {
      const result = await this.scanWithClamav(filePath);
      return {
        ...result,
        details: {
          ...result.details,
          scanTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to scan file ${filePath}:`, error);
      return {
        clean: false,
        scanned: false,
        error: error instanceof Error ? error.message : 'Scan failed',
      };
    }
  }

  /**
   * Check if ClamAV is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to connect to ClamAV daemon
      const net = await import('net');

      return new Promise((resolve) => {
        const socket = net.createConnection(
          { host: this.clamavHost, port: this.clamavPort },
          () => {
            socket.end();
            resolve(true);
          },
        );

        socket.on('error', () => {
          resolve(false);
        });

        socket.setTimeout(3000, () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Get scanner information
   */
  async getInfo(): Promise<ScannerInfo> {
    if (!this.clamavAvailable) {
      return {
        name: 'Fallback Scanner',
        version: '1.0.0',
        available: false,
      };
    }

    try {
      const version = await this.getClamavVersion();
      return {
        name: 'ClamAV',
        version: version || 'unknown',
        available: true,
      };
    } catch {
      return {
        name: 'ClamAV',
        version: 'unknown',
        available: false,
      };
    }
  }

  /**
   * Scan using ClamAV daemon via TCP
   */
  private async scanWithClamav(filePath: string): Promise<VirusScanResult> {
    const net = await import('net');

    return new Promise((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.clamavHost, port: this.clamavPort },
        async () => {
          // Send SCAN command
          socket.write(`SCAN ${filePath}\n`);
        },
      );

      let response = '';

      socket.on('data', (data) => {
        response += data.toString();
      });

      socket.on('end', () => {
        // Parse ClamAV response
        // Format: /path/to/file: OK or /path/to/file: VirusName FOUND
        if (response.includes(' OK')) {
          resolve({
            clean: true,
            scanned: true,
          });
        } else if (response.includes(' FOUND')) {
          const match = response.match(/: (.+) FOUND/);
          resolve({
            clean: false,
            scanned: true,
            threat: match ? match[1] : 'Unknown threat',
          });
        } else if (response.includes(' ERROR')) {
          resolve({
            clean: false,
            scanned: false,
            error: response,
          });
        } else {
          resolve({
            clean: false,
            scanned: false,
            error: `Unexpected response: ${response}`,
          });
        }
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.setTimeout(30000, () => {
        socket.destroy();
        reject(new Error('Scan timeout'));
      });
    });
  }

  /**
   * Get ClamAV version
   */
  private async getClamavVersion(): Promise<string | null> {
    const net = await import('net');

    return new Promise((resolve) => {
      const socket = net.createConnection(
        { host: this.clamavHost, port: this.clamavPort },
        () => {
          socket.write('VERSION\n');
        },
      );

      let response = '';

      socket.on('data', (data) => {
        response += data.toString();
      });

      socket.on('end', () => {
        resolve(response.trim());
      });

      socket.on('error', () => {
        resolve(null);
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Fallback scan when ClamAV is not available
   * Performs basic heuristic checks
   */
  private fallbackScan(buffer: Buffer, startTime: number): VirusScanResult {
    this.logger.debug('Using fallback virus scan');

    // Basic heuristic checks
    const suspicious = this.checkSuspiciousPatterns(buffer);

    if (suspicious) {
      return {
        clean: false,
        scanned: true,
        threat: 'Suspicious.Pattern.Generic',
        details: {
          scanTime: Date.now() - startTime,
        },
      };
    }

    return {
      clean: true,
      scanned: true,
      details: {
        scanTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Basic pattern checks for fallback mode
   */
  private checkSuspiciousPatterns(buffer: Buffer): boolean {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));

    // Check for common malicious patterns
    const suspiciousPatterns = [
      /<script[^>]*>.*?eval\s*\(/is,
      /document\.write\s*\(\s*unescape/i,
      /fromCharCode.*?fromCharCode.*?fromCharCode/i,
      /ActiveXObject/i,
      /WScript\.Shell/i,
      /powershell\s+-[eE]nc/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        this.logger.warn(`Suspicious pattern detected: ${pattern.source}`);
        return true;
      }
    }

    return false;
  }
}
