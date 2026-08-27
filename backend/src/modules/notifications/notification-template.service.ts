import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationTemplate,
  TemplateChannel,
} from './entities/notification-template.entity';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/template.dto';

@Injectable()
export class NotificationTemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
  ) {}

  async create(dto: CreateTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.templateRepo.findOne({
      where: { name: dto.name, channel: dto.channel },
    });
    if (existing) throw new ConflictException(`Template "${dto.name}" for channel ${dto.channel} already exists`);

    const template = this.templateRepo.create(dto);
    return this.templateRepo.save(template);
  }

  async findAll(): Promise<NotificationTemplate[]> {
    return this.templateRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<NotificationTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<NotificationTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, dto);
    return this.templateRepo.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepo.remove(template);
  }

  /**
   * Render a template by name+channel, substituting {{key}} placeholders.
   */
  async render(
    name: string,
    channel: TemplateChannel,
    variables: Record<string, string> = {},
  ): Promise<{ subject: string; body: string } | null> {
    const template = await this.templateRepo.findOne({
      where: { name, channel, isActive: true },
    });
    if (!template) return null;

    const interpolate = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');

    return {
      subject: interpolate(template.subject),
      body: interpolate(template.body),
    };
  }
}
