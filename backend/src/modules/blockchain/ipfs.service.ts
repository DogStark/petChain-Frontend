import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type KuboRPCClient = {
  add(data: string | Buffer): Promise<{ path: string }>;
  cat(cid: string): AsyncIterable<Uint8Array>;
};

@Injectable()
export class IPFSService {
  private readonly clientPromise: Promise<KuboRPCClient>;
  private readonly logger = new Logger(IPFSService.name);

  constructor(private configService: ConfigService) {
    this.clientPromise = this.createClient();
  }

  private async createClient(): Promise<KuboRPCClient> {
    const ipfsUrl = this.configService.get<string>('blockchain.ipfs.url');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicImport = new Function(
      'modulePath',
      'return import(modulePath)',
    ) as (
      modulePath: string,
    ) => Promise<{ create: (options: { url?: string }) => KuboRPCClient }>;
    const kubo = await dynamicImport('kubo-rpc-client');
    return kubo.create({ url: ipfsUrl });
  }

  private async getClient(): Promise<KuboRPCClient> {
    return this.clientPromise;
  }

  async upload(data: string | Buffer): Promise<string> {
    try {
      const client = await this.getClient();
      const result = await client.add(data);
      return result.path;
    } catch (error) {
      this.logger.error(`IPFS Upload failed: ${error.message}`);
      throw error;
    }
  }

  async retrieve(cid: string): Promise<string> {
    try {
      const client = await this.getClient();
      const chunks: Uint8Array[] = [];
      for await (const chunk of client.cat(cid)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString();
    } catch (error) {
      this.logger.error(`IPFS Retrieval failed: ${error.message}`);
      throw error;
    }
  }
}
