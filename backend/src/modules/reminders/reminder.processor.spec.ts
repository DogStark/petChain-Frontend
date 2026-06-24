import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { ReminderProcessor } from './reminder.processor';
import { ReminderScheduler } from './reminder.scheduler';
import { ReminderService } from './reminder.service';
import { Reminder, ReminderStatus, ReminderType } from './entities/reminder.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/entities/notification.entity';

const mockReminder = (overrides: Partial<Reminder> = {}): Reminder =>
  ({
    id: 'rem-1',
    userId: 'user-1',
    petId: 'pet-1',
    title: 'Rabies Vaccine',
    description: 'Annual rabies vaccination',
    status: ReminderStatus.PENDING,
    type: ReminderType.VACCINATION,
    dueDate: new Date(Date.now() + 3600 * 1000),
    ...overrides,
  }) as Reminder;

const makeJob = (data: { reminderId: string }, opts: Partial<Job> = {}): Job =>
  ({
    id: 'job-1',
    data,
    opts: { attempts: 3 },
    attemptsMade: 0,
    ...opts,
  }) as unknown as Job;

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;
  let reminderService: jest.Mocked<ReminderService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderProcessor,
        {
          provide: ReminderService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get(ReminderProcessor);
    reminderService = module.get(ReminderService);
    notificationsService = module.get(NotificationsService);
  });

  it('dispatches notification and marks SENT_DAY_OF for a PENDING reminder', async () => {
    const reminder = mockReminder();
    reminderService.findOne.mockResolvedValue(reminder);
    notificationsService.create.mockResolvedValue({} as any);
    reminderService.update.mockResolvedValue({ ...reminder, status: ReminderStatus.SENT_DAY_OF } as any);

    await processor.process(makeJob({ reminderId: 'rem-1' }));

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.VACCINATION,
        metadata: { reminderId: 'rem-1', petId: 'pet-1' },
      }),
    );
    expect(reminderService.update).toHaveBeenCalledWith('rem-1', {
      status: ReminderStatus.SENT_DAY_OF,
    });
  });

  it('skips dispatch when reminder is not PENDING', async () => {
    reminderService.findOne.mockResolvedValue(mockReminder({ status: ReminderStatus.COMPLETED }));

    await processor.process(makeJob({ reminderId: 'rem-1' }));

    expect(notificationsService.create).not.toHaveBeenCalled();
    expect(reminderService.update).not.toHaveBeenCalled();
  });

  it('marks FAILED and re-throws on final attempt failure', async () => {
    reminderService.findOne.mockResolvedValue(mockReminder());
    notificationsService.create.mockRejectedValue(new Error('FCM error'));
    reminderService.update.mockResolvedValue({} as any);

    const job = makeJob({ reminderId: 'rem-1' }, { attemptsMade: 2, opts: { attempts: 3 } } as any);

    await expect(processor.process(job)).rejects.toThrow('FCM error');

    expect(reminderService.update).toHaveBeenCalledWith('rem-1', {
      status: ReminderStatus.FAILED,
    });
  });

  it('re-throws without marking FAILED on non-final attempt', async () => {
    reminderService.findOne.mockResolvedValue(mockReminder());
    notificationsService.create.mockRejectedValue(new Error('transient'));
    reminderService.update.mockResolvedValue({} as any);

    const job = makeJob({ reminderId: 'rem-1' }, { attemptsMade: 0, opts: { attempts: 3 } } as any);

    await expect(processor.process(job)).rejects.toThrow('transient');

    expect(reminderService.update).not.toHaveBeenCalled();
  });
});

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler;
  let reminderRepo: { find: jest.Mock };
  let remindersQueue: { add: jest.Mock; getJob: jest.Mock };

  beforeEach(async () => {
    reminderRepo = { find: jest.fn() };
    remindersQueue = { add: jest.fn(), getJob: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderScheduler,
        {
          provide: getQueueToken('reminders'),
          useValue: remindersQueue,
        },
        {
          provide: getRepositoryToken(Reminder),
          useValue: reminderRepo,
        },
      ],
    }).compile();

    scheduler = module.get(ReminderScheduler);
  });

  it('enqueues PENDING reminders due within 24 hours', async () => {
    const reminder = mockReminder();
    reminderRepo.find.mockResolvedValue([reminder]);
    remindersQueue.getJob.mockResolvedValue(null);
    remindersQueue.add.mockResolvedValue({});

    await scheduler.scheduleUpcomingReminders();

    expect(remindersQueue.add).toHaveBeenCalledWith(
      'dispatch',
      { reminderId: 'rem-1' },
      expect.objectContaining({
        jobId: 'reminder:rem-1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
  });

  it('skips reminders that are already enqueued', async () => {
    reminderRepo.find.mockResolvedValue([mockReminder()]);
    remindersQueue.getJob.mockResolvedValue({ id: 'reminder:rem-1' }); // already exists

    await scheduler.scheduleUpcomingReminders();

    expect(remindersQueue.add).not.toHaveBeenCalled();
  });

  it('does nothing when no reminders are due', async () => {
    reminderRepo.find.mockResolvedValue([]);

    await scheduler.scheduleUpcomingReminders();

    expect(remindersQueue.add).not.toHaveBeenCalled();
  });
});
