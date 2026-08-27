import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { ContractManagementService } from './contract-management.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ContractEventMonitorService implements OnModuleInit {
  private readonly logger = new Logger(ContractEventMonitorService.name);

  constructor(
    private stellarService: StellarService,
    private manageService: ContractManagementService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting contract event monitor...');
    this.startMonitoring().catch((err) => {
      this.logger.error(`Event monitoring failed to start: ${err.message}`);
    });
  }

  private async startMonitoring() {
    // Monitor AccessControl contract
    const accessContractId =
      await this.manageService.getContractId('AccessControl');
    if (accessContractId) {
      this.monitorContract(accessContractId, 'AccessControl');
    }

    // Monitor Registry contract
    const registryContractId =
      await this.manageService.getContractId('Registry');
    if (registryContractId) {
      this.monitorContract(registryContractId, 'Registry');
    }

    // Monitor Token contract
    const tokenContractId = await this.manageService.getContractId('Token');
    if (tokenContractId) {
      this.monitorContract(tokenContractId, 'Token');
    }
  }

  private async monitorContract(contractId: string, name: string) {
    this.logger.log(`Monitoring events for ${name} (${contractId})`);

    await this.stellarService.listenToEvents(contractId, (event) => {
      this.handleContractEvent(name, event);
    });
  }

  private handleContractEvent(contractName: string, event: any) {
    this.logger.log(`Event from ${contractName}: ${JSON.stringify(event)}`);

    // Emit internal event for other modules to consume
    this.eventEmitter.emit(`blockchain.event.${contractName}`, {
      contractId: event.contractId,
      topics: event.topic,
      value: event.value,
      ledger: event.ledger,
    });

    // Handle specific event types
    if (contractName === 'AccessControl') {
      this.processAccessControlEvent(event);
    } else if (contractName === 'Token') {
      this.processTokenEvent(event);
    }
  }

  private processAccessControlEvent(event: any) {
    // Logic to update local cache or trigger notifications
    this.logger.debug(
      `Processing AccessControl event: ${JSON.stringify(event.value)}`,
    );
  }

  private processTokenEvent(event: any) {
    // Logic to confirm payments in DB
    this.logger.debug(`Processing Token event: ${JSON.stringify(event.value)}`);
  }
}
