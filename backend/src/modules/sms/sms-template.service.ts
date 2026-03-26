import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsTemplate, SmsTemplateType } from './entities/sms-template.entity';

export const DEFAULT_SMS_TEMPLATES: Array<{
  name: string;
  content: string;
  type: SmsTemplateType;
  variables: string[];
}> = [
  {
    name: 'EMERGENCY_MEDICAL',
    content:
      'URGENT: {petName} requires immediate medical attention. {message}. Contact: {contactNumber}',
    type: SmsTemplateType.EMERGENCY,
    variables: ['petName', 'message', 'contactNumber'],
  },
  {
    name: 'EMERGENCY_LOST_PET',
    content:
      'ALERT: {petName} has been reported lost. Last seen: {location}. Contact: {contactNumber}',
    type: SmsTemplateType.EMERGENCY,
    variables: ['petName', 'location', 'contactNumber'],
  },
  {
    name: 'REMINDER_OVERDUE',
    content:
      "{petName}'s {vaccineName} vaccination is overdue by {days} days. Schedule now.",
    type: SmsTemplateType.REMINDER,
    variables: ['petName', 'vaccineName', 'days'],
  },
  {
    name: 'CRITICAL_HEALTH',
    content:
      'CRITICAL: {petName} health alert - {message}. Seek veterinary care immediately.',
    type: SmsTemplateType.ALERT,
    variables: ['petName', 'message'],
  },
];

@Injectable()
export class SmsTemplateService implements OnModuleInit {
  constructor(
    @InjectRepository(SmsTemplate)
    private readonly templateRepository: Repository<SmsTemplate>,
  ) {}

  async getByName(name: string): Promise<SmsTemplate> {
    const template = await this.templateRepository.findOne({
      where: { name, isActive: true },
    });
    if (!template) {
      throw new NotFoundException(`SMS template not found: ${name}`);
    }
    return template;
  }

  async getById(id: string): Promise<SmsTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, isActive: true },
    });
    if (!template) {
      throw new NotFoundException(`SMS template not found: ${id}`);
    }
    return template;
  }

  render(template: SmsTemplate, variables: Record<string, string | number>): string {
    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
    }
    return content;
  }

  async renderByName(
    name: string,
    variables: Record<string, string | number>,
  ): Promise<{ message: string; templateId: string }> {
    const template = await this.getByName(name);
    const message = this.render(template, variables);
    return { message, templateId: template.id };
  }

  async seedDefaultTemplates(): Promise<void> {
    for (const def of DEFAULT_SMS_TEMPLATES) {
      const existing = await this.templateRepository.findOne({
        where: { name: def.name },
      });
      if (!existing) {
        await this.templateRepository.save(
          this.templateRepository.create({
            name: def.name,
            content: def.content,
            type: def.type,
            variables: def.variables,
            isActive: true,
          }),
        );
      }
    }
  }

  async findAll(): Promise<SmsTemplate[]> {
    return this.templateRepository.find({
      where: { isActive: true },
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.seedDefaultTemplates();
  }
}
