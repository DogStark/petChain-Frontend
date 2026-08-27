import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Condition, ConditionStatus, ConditionSeverity } from './entities/condition.entity';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/entities/notification.entity';

@Injectable()
export class ConditionsService {
  constructor(
    @InjectRepository(Condition)
    private readonly conditionRepository: Repository<Condition>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createConditionDto: CreateConditionDto): Promise<Condition> {
    const condition = this.conditionRepository.create(createConditionDto);
    const savedCondition = await this.conditionRepository.save(condition);

    // Load pet with owner for notifications
    const conditionWithPet = await this.conditionRepository.findOne({
      where: { id: savedCondition.id },
      relations: ['pet', 'pet.owner'],
    });

    // Alert on critical condition creation
    if (createConditionDto.severity === ConditionSeverity.CRITICAL && conditionWithPet?.pet?.owner) {
      await this.notificationsService.create({
        userId: conditionWithPet.pet.owner.id,
        title: 'Critical Condition Diagnosed',
        message: `${conditionWithPet.pet.name} has been diagnosed with a critical condition: ${createConditionDto.conditionName}`,
        category: NotificationCategory.ALERT,
        metadata: {
          petId: conditionWithPet.pet.id,
          conditionId: savedCondition.id,
          severity: createConditionDto.severity,
        },
      });
    }

    return savedCondition;
  }

  async findAll(petId?: string): Promise<Condition[]> {
    const where: any = {};
    if (petId) {
      where.petId = petId;
    }

    return await this.conditionRepository.find({
      where,
      relations: ['pet'],
      order: { diagnosedDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Condition> {
    const condition = await this.conditionRepository.findOne({
      where: { id },
      relations: ['pet'],
    });

    if (!condition) {
      throw new NotFoundException(`Condition with ID ${id} not found`);
    }

    return condition;
  }

  async findByPet(petId: string): Promise<Condition[]> {
    return await this.conditionRepository.find({
      where: { petId },
      relations: ['pet'],
      order: { severity: 'DESC', diagnosedDate: 'DESC' },
    });
  }

  async findChronicConditions(petId: string): Promise<Condition[]> {
    return await this.conditionRepository.find({
      where: { petId, isChronicCondition: true },
      relations: ['pet'],
      order: { severity: 'DESC' },
    });
  }

  async findActiveConditions(petId: string): Promise<Condition[]> {
    return await this.conditionRepository.find({
      where: { petId, status: ConditionStatus.ACTIVE },
      relations: ['pet'],
      order: { severity: 'DESC' },
    });
  }

  async update(
    id: string,
    updateConditionDto: UpdateConditionDto,
  ): Promise<Condition> {
    const condition = await this.conditionRepository.findOne({
      where: { id },
      relations: ['pet', 'pet.owner'],
    });

    if (!condition) {
      throw new NotFoundException(`Condition with ID ${id} not found`);
    }

    const oldSeverity = condition.severity;
    Object.assign(condition, updateConditionDto);
    const updatedCondition = await this.conditionRepository.save(condition);

    // Alert on severity escalation to CRITICAL
    if (
      updateConditionDto.severity === ConditionSeverity.CRITICAL &&
      oldSeverity !== ConditionSeverity.CRITICAL &&
      condition.pet?.owner
    ) {
      await this.notificationsService.create({
        userId: condition.pet.owner.id,
        title: 'Condition Severity Escalated',
        message: `${condition.pet.name}'s condition "${condition.conditionName}" has been escalated to critical severity`,
        category: NotificationCategory.ALERT,
        metadata: {
          petId: condition.pet.id,
          conditionId: condition.id,
          oldSeverity,
          newSeverity: updateConditionDto.severity,
        },
      });
    }

    // Alert on resolution of critical condition
    if (
      oldSeverity === ConditionSeverity.CRITICAL &&
      updateConditionDto.severity &&
      updateConditionDto.severity !== ConditionSeverity.CRITICAL &&
      condition.pet?.owner
    ) {
      await this.notificationsService.create({
        userId: condition.pet.owner.id,
        title: 'Critical Condition Resolved',
        message: `${condition.pet.name}'s critical condition "${condition.conditionName}" has been resolved`,
        category: NotificationCategory.MEDICAL_RECORD,
        metadata: {
          petId: condition.pet.id,
          conditionId: condition.id,
          oldSeverity,
          newSeverity: updateConditionDto.severity,
        },
      });
    }

    return updatedCondition;
  }

  async remove(id: string): Promise<void> {
    const condition = await this.findOne(id);
    await this.conditionRepository.remove(condition);
  }

  async getConditionSummary(petId: string): Promise<{
    total: number;
    active: number;
    chronic: number;
    requiresOngoingCare: number;
  }> {
    const conditions = await this.findByPet(petId);

    return {
      total: conditions.length,
      active: conditions.filter((c) => c.status === ConditionStatus.ACTIVE)
        .length,
      chronic: conditions.filter((c) => c.isChronicCondition).length,
      requiresOngoingCare: conditions.filter((c) => c.requiresOngoingCare)
        .length,
    };
  }
}
