import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { ContractManagementService } from './contract-management.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { xdr } from '@stellar/stellar-sdk';

@Injectable()
export class PaymentAutomationService {
  private readonly logger = new Logger(PaymentAutomationService.name);

  constructor(
    private stellarService: StellarService,
    private manageService: ContractManagementService,
  ) {}

  async processAutomatedPayment(
    from: string,
    to: string,
    amount: bigint,
    tokenContractId?: string,
  ): Promise<string> {
    const contractId =
      tokenContractId || (await this.manageService.getContractId('Token'));
    if (!contractId) throw new Error('Token contract not found');

    this.logger.log(
      `Processing automated payment from ${from} to ${to} of ${amount} tokens`,
    );

    try {
      const params = [
        xdr.ScVal.scvAddress(StellarSdk.Address.fromString(from).toScAddress()),
        xdr.ScVal.scvAddress(StellarSdk.Address.fromString(to).toScAddress()),
        (xdr.ScVal.scvI128 as any)(amount),
      ];

      const result = await this.stellarService.invokeContract(
        contractId,
        'transfer',
        params,
      );
      this.logger.log(`Payment processed successfully: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process automated payment: ${error.message}`,
      );
      throw error;
    }
  }

  async checkBalance(
    accountAddress: string,
    tokenContractId?: string,
  ): Promise<bigint> {
    const contractId =
      tokenContractId || (await this.manageService.getContractId('Token'));
    if (!contractId) throw new Error('Token contract not found');

    const params = [
      xdr.ScVal.scvAddress(
        StellarSdk.Address.fromString(accountAddress).toScAddress(),
      ),
    ];

    const result = await this.stellarService.invokeContract(
      contractId,
      'balance',
      params,
    );
    return result as bigint;
  }

  async authorizeOperator(
    operatorAddress: string,
    tokenContractId?: string,
  ): Promise<any> {
    // Authorize this backend to spend tokens on behalf of users if needed
    const contractId =
      tokenContractId || (await this.manageService.getContractId('Token'));
    if (!contractId) throw new Error('Token contract not found');

    const params = [
      xdr.ScVal.scvAddress(
        StellarSdk.Address.fromString(operatorAddress).toScAddress(),
      ),
      xdr.ScVal.scvBool(true),
    ];

    return this.stellarService.invokeContract(
      contractId,
      'set_authorized',
      params,
    );
  }
}
