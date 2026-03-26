import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create, KuboRPCClient } from 'kubo-rpc-client';

@Injectable()
export class IPFSService {
  private readonly client: KuboRPCClient;
  private readonly logger = new Logger(IPFSService.name);

  constructor(private configService: ConfigService) {
    const ipfsUrl = this.configService.get<string>('blockchain.ipfs.url');
    this.client = create({ url: ipfsUrl });
  }

  async upload(data: string | Buffer): Promise<string> {
    try {
      const result = await this.client.add(data);
      return result.path;
    } catch (error) {
      this.logger.error(`IPFS Upload failed: ${error.message}`);
      throw error;
    }
  }

  async retrieve(cid: string): Promise<string> {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString();
    } catch (error) {
      this.logger.error(`IPFS Retrieval failed: ${error.message}`);
      throw error;
    }
  }
}
