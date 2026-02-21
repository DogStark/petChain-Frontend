import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Condition, ConditionStatus } from './entities/condition.entity';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';

@Injectable()
export class ConditionsService {
  constructor(
    @InjectRepository(Condition)
    private readonly conditionRepository: Repository<Condition>,
  ) {}

  async create(createConditionDto: CreateConditionDto): Promise<Condition> {
    const condition = this.conditionRepository.create(createConditionDto);
    return await this.conditionRepository.save(condition);
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
    const condition = await this.findOne(id);
    Object.assign(condition, updateConditionDto);
    return await this.conditionRepository.save(condition);
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
