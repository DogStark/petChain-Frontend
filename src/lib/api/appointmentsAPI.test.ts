import axios from 'axios';

jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockInstance),
      isAxiosError: jest.fn(() => false),
    },
  };
});

import { appointmentsAPI, AppointmentBookingError } from './appointmentsAPI';

const mockPost = (axios.create as jest.Mock).mock.results[0].value.post as jest.Mock;

describe('AppointmentsAPI.createAppointment', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts the backend vet-clinic contract and maps a successful response', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'appointment-1',
        petId: '550e8400-e29b-41d4-a716-446655440000',
        vetClinicId: '550e8400-e29b-41d4-a716-446655440001',
        scheduledDate: '2026-11-21T09:00:00.000Z',
        duration: 30,
        status: 'SCHEDULED',
        type: 'CHECKUP',
        notes: 'Routine wellness visit',
        createdAt: '2026-11-21T08:00:00.000Z',
        updatedAt: '2026-11-21T08:00:00.000Z',
      },
    });

    const result = await appointmentsAPI.createAppointment({
      petId: '550e8400-e29b-41d4-a716-446655440000',
      vetId: '550e8400-e29b-41d4-a716-446655440001',
      appointmentType: 'Checkup',
      date: '2026-11-21',
      time: '09:00',
      notes: 'Routine wellness visit',
    });

    expect(mockPost).toHaveBeenCalledWith('/', {
      petId: '550e8400-e29b-41d4-a716-446655440000',
      vetClinicId: '550e8400-e29b-41d4-a716-446655440001',
      scheduledDate: '2026-11-21T09:00:00.000',
      duration: 30,
      type: 'CHECKUP',
      reason: 'Routine wellness visit',
      notes: 'Routine wellness visit',
    });
    expect(result).toMatchObject({
      id: 'appointment-1',
      petId: '550e8400-e29b-41d4-a716-446655440000',
      vetId: '550e8400-e29b-41d4-a716-446655440001',
      appointmentType: 'Checkup',
      status: 'Scheduled',
      notes: 'Routine wellness visit',
    });
  });

  it('maps Dental and Surgery types to backend-supported enum values', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'appointment-2', petId: 'pet-1', vetClinicId: 'clinic-1',
        scheduledDate: '2026-11-21T10:00:00.000Z', status: 'SCHEDULED',
        type: 'GROOMING', createdAt: '2026-11-21T08:00:00.000Z', updatedAt: '2026-11-21T08:00:00.000Z',
      },
    });

    await appointmentsAPI.createAppointment({
      petId: 'pet-1', vetId: 'clinic-1', appointmentType: 'Dental',
      date: '2026-11-21', time: '10:00',
    });

    expect(mockPost.mock.calls[0][1]).toMatchObject({ type: 'GROOMING', duration: 30 });
  });

  it('normalizes a rejected conflict with status and validated alternate slots', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'APPOINTMENT_CONFLICT',
          availableSlots: ['10:30', 'invalid', '11:00'],
        },
      },
    });

    await expect(appointmentsAPI.createAppointment({
      petId: 'pet-1', vetId: 'clinic-1', appointmentType: 'Checkup',
      date: '2026-11-21', time: '09:00',
    })).rejects.toMatchObject({
      name: 'AppointmentBookingError',
      status: 409,
      code: 'APPOINTMENT_CONFLICT',
      availableSlots: ['10:30', '11:00'],
    });
  });

  it('normalizes a backend 400 rejection without exposing an untrusted server message', async () => {
    mockPost.mockRejectedValue({
      response: { status: 400, data: { message: 'Private internal detail', code: 'VET_ID_REQUIRED' } },
    });

    await expect(appointmentsAPI.createAppointment({
      petId: 'pet-1', vetId: '', appointmentType: 'Checkup',
      date: '2026-11-21', time: '09:00',
    })).rejects.toBeInstanceOf(AppointmentBookingError);
  });
});
