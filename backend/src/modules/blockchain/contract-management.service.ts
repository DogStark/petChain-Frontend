import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainSync } from './entities/blockchain-sync.entity';

@Injectable()
export class ContractManagementService {
  private readonly logger = new Logger(ContractManagementService.name);

  constructor(
    private stellarService: StellarService,
    @InjectRepository(BlockchainSync)
    private syncRepository: Repository<BlockchainSync>,
  ) {}

  async deployNewContract(wasmHash: string, name: string): Promise<string> {
    this.logger.log(`Deploying new contract: ${name} with WASM hash: ${wasmHash}`);
    
    try {
      const { contractId, txHash } = await this.stellarService.deployContract(wasmHash);
      
      // Store contract metadata in BlockchainSync entity (using it as a simple store for now)
      const contractMeta = this.syncRepository.create({
        txHash,
        status: 'COMPLETED',
        height: 0, // Not applicable for deployment but kept for schema
        data: {
          contractId,
          name,
          wasmHash,
          deployedAt: new Date().toISOString(),
        },
      });
      
      await this.syncRepository.save(contractMeta);
      this.logger.log(`Contract ${name} deployed with ID: ${contractId}`);
      return contractId;
    } catch (error) {
      this.logger.error(`Failed to deploy contract ${name}: ${error.message}`);
      throw error;
    }
  }

  async getContractId(name: string): Promise<string | null> {
    const records = await this.syncRepository.find({
      order: { createdAt: 'DESC' },
    });
    
    const record = records.find(r => r.data?.name === name);
    return record?.data?.contractId || null;
  }

  async upgradeContract(name: string, newWasmHash: string): Promise<string> {
    const contractId = await this.getContractId(name);
    if (!contractId) throw new Error(`Contract ${name} not found`);

    this.logger.log(`Upgrading contract ${name} (${contractId}) to new WASM hash: ${newWasmHash}`);
    const txHash = await this.stellarService.upgradeContract(contractId, newWasmHash);

    const upgradeMeta = this.syncRepository.create({
      txHash,
      status: 'COMPLETED',
      height: 0,
      data: {
        contractId,
        name,
        wasmHash: newWasmHash,
        upgradedAt: new Date().toISOString(),
        isUpgrade: true,
      },
    });

    await this.syncRepository.save(upgradeMeta);
    return txHash;
  }
}
