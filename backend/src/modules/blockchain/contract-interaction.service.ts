import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { ContractManagementService } from './contract-management.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { xdr } from '@stellar/stellar-sdk';

@Injectable()
export class ContractInteractionService {
  private readonly logger = new Logger(ContractInteractionService.name);

  constructor(
    private stellarService: StellarService,
    private manageService: ContractManagementService,
  ) {}

  async checkAccess(
    recordId: string,
    accessorPublicKey: string,
  ): Promise<boolean> {
    const contractId = await this.manageService.getContractId('AccessControl');
    if (!contractId) {
      this.logger.warn('AccessControl contract not deployed');
      return false;
    }

    try {
      const params = [
        xdr.ScVal.scvString(recordId),
        xdr.ScVal.scvAddress(
          StellarSdk.Address.fromString(accessorPublicKey).toScAddress(),
        ),
      ];

      const result = await this.stellarService.invokeContract(
        contractId,
        'has_access',
        params,
      );
      return !!result;
    } catch (error) {
      this.logger.error(`Error checking access on-chain: ${error.message}`);
      return false;
    }
  }

  async grantAccess(
    recordId: string,
    accessorPublicKey: string,
    expiresAt: number,
  ): Promise<any> {
    const contractId = await this.manageService.getContractId('AccessControl');
    if (!contractId) throw new Error('AccessControl contract not deployed');

    const params = [
      xdr.ScVal.scvString(recordId),
      xdr.ScVal.scvAddress(
        StellarSdk.Address.fromString(accessorPublicKey).toScAddress(),
      ),
      (xdr.ScVal.scvU64 as any)(BigInt(expiresAt)),
    ];

    return this.stellarService.invokeContract(
      contractId,
      'grant_access',
      params,
    );
  }

  async revokeAccess(
    recordId: string,
    accessorPublicKey: string,
  ): Promise<any> {
    const contractId = await this.manageService.getContractId('AccessControl');
    if (!contractId) throw new Error('AccessControl contract not deployed');

    const params = [
      xdr.ScVal.scvString(recordId),
      xdr.ScVal.scvAddress(
        StellarSdk.Address.fromString(accessorPublicKey).toScAddress(),
      ),
    ];

    return this.stellarService.invokeContract(
      contractId,
      'revoke_access',
      params,
    );
  }

  async recordMetadata(recordId: string, metadataHash: string): Promise<any> {
    const contractId = await this.manageService.getContractId('Registry');
    if (!contractId) throw new Error('Registry contract not deployed');

    const params = [
      xdr.ScVal.scvString(recordId),
      xdr.ScVal.scvBytes(Buffer.from(metadataHash, 'hex')),
    ];

    return this.stellarService.invokeContract(
      contractId,
      'register_record',
      params,
    );
  }
}
