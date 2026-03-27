import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);
  private readonly minSupportedAppVersion: string;

  constructor(private configService: ConfigService) {
    this.minSupportedAppVersion = this.configService.get<string>('app.minVersion') || '1.0.0';
  }

  /**
   * Compares two semantic version strings (e.g., "1.2.3" vs "1.2.4")
   * Returns:
   * 1 if v1 > v2
   * -1 if v1 < v2
   * 0 if v1 == v2
   */
  compare(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  /**
   * Checks if the provided version meets the minimum supported version requirement.
   */
  isSupported(clientVersion: string): boolean {
    try {
      return this.compare(clientVersion, this.minSupportedAppVersion) >= 0;
    } catch (error) {
      this.logger.error(`Invalid version format: ${clientVersion}`);
      return false;
    }
  }

  /**
   * Validates that a string follows the x.y.z semantic versioning format.
   */
  validateFormat(version: string): void {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(version)) {
      throw new BadRequestException(`Invalid version format: ${version}. Expected x.y.z`);
    }
  }

  /**
   * Checks if a breaking change exists between two versions (Major version mismatch)
   */
  isBreakingChange(oldVersion: string, newVersion: string): boolean {
    const majorOld = parseInt(oldVersion.split('.')[0], 10);
    const majorNew = parseInt(newVersion.split('.')[0], 10);
    return majorNew > majorOld;
  }
}
