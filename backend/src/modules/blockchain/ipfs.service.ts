import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';

type KuboRPCClient = {
  add(data: string | Buffer): Promise<{ path: string }>;
  cat(cid: string): AsyncIterable<Uint8Array>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class IPFSService {
  private readonly clientPromise: Promise<KuboRPCClient>;
  private readonly logger = new Logger(IPFSService.name);

  constructor(private configService: ConfigService) {
    this.clientPromise = this.createClient();
  }

  private async createClient(): Promise<KuboRPCClient> {
    const ipfsUrl = this.configService.get<string>('blockchain.ipfs.url');
    const kubo = await import('kubo-rpc-client') as unknown as { create: (options: { url?: string }) => KuboRPCClient };
    return kubo.create({ url: ipfsUrl });
  }

  private async primaryUpload(data: string | Buffer): Promise<string> {
    const client = await this.clientPromise;
    const result = await client.add(data);
    return result.path;
  }

  private async fallbackUpload(data: string | Buffer): Promise<string> {
    const apiKey = this.configService.get<string>('blockchain.ipfs.pinataApiKey');
    const secretKey = this.configService.get<string>('blockchain.ipfs.pinataSecretKey');
    const form = new FormData();
    form.append('file', Buffer.isBuffer(data) ? data : Buffer.from(data), 'upload');
    const response = await axios.post<{ IpfsHash: string }>(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      form,
      { headers: { ...form.getHeaders(), pinata_api_key: apiKey, pinata_secret_api_key: secretKey } },
    );
    this.logger.log(`Uploaded via Pinata fallback: ${response.data.IpfsHash}`);
    return response.data.IpfsHash;
  }

  async upload(data: string | Buffer, retries = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const cid = await this.primaryUpload(data);
        this.logger.log(`Uploaded via primary Kubo (attempt ${attempt}): ${cid}`);
        return cid;
      } catch (err) {
        this.logger.warn(`Primary upload attempt ${attempt} failed: ${(err as Error).message}`);
        if (attempt < retries) await sleep(500 * 2 ** attempt);
      }
    }
    return this.fallbackUpload(data);
  }

  async retrieve(cid: string): Promise<string> {
    try {
      const client = await this.clientPromise;
      const chunks: Uint8Array[] = [];
      for await (const chunk of client.cat(cid)) {
        chunks.push(chunk);
      }
      this.logger.log(`Retrieved via primary Kubo: ${cid}`);
      return Buffer.concat(chunks).toString();
    } catch (err) {
      this.logger.warn(`Primary retrieve failed for ${cid}, trying Pinata gateway`);
      const gateway = this.configService.get<string>('blockchain.ipfs.pinataGateway');
      const response = await axios.get<string>(`${gateway}${cid}`);
      this.logger.log(`Retrieved via Pinata gateway: ${cid}`);
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    }
  }

  async health(): Promise<{ status: 'ok' | 'degraded' | 'down'; provider: 'kubo' | 'pinata' }> {
    try {
      await this.primaryUpload(Buffer.from('health-check'));
      return { status: 'ok', provider: 'kubo' };
    } catch {
      const apiKey = this.configService.get<string>('blockchain.ipfs.pinataApiKey');
      if (apiKey) {
        try {
          await axios.get('https://api.pinata.cloud/data/testAuthentication', {
            headers: {
              pinata_api_key: apiKey,
              pinata_secret_api_key: this.configService.get<string>('blockchain.ipfs.pinataSecretKey'),
            },
          });
          return { status: 'degraded', provider: 'pinata' };
        } catch {
          // fall through
        }
      }
      return { status: 'down', provider: 'kubo' };
    }
  }
}
