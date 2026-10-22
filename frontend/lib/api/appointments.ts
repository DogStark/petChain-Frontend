import { apiClient } from './client';

export interface Appointment {
  id: string;
  petId: string;
  clinicId: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  seriesId?: string;
  recurrenceRule?: string;
  isSeriesException?: boolean;
}

export interface AppointmentSeriesExceptionInput {
  /** The single occurrence being changed. */
  occurrenceId: string;
  /** New start time when rescheduling; omit when cancelling. */
  startsAt?: string;
  /** New end time when rescheduling; omit when cancelling. */
  endsAt?: string;
  /** Set to true to cancel just this occurrence. */
  cancel?: boolean;
}

/**
 * Edit a single occurrence of a recurring appointment series without
 * affecting the rest of the series. Authorization and consent decisions
 * are owned by the backend; the frontend only forwards the request.
 */
export async function updateAppointmentSeriesException(
  appointmentId: string,
  input: AppointmentSeriesExceptionInput,
): Promise<Appointment> {
  const response = await apiClient.patch<Appointment>(
    `/appointments/${encodeURIComponent(appointmentId)}/series-exception`,
    {
      occurrenceId: input.occurrenceId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      cancel: input.cancel ?? false,
    },
  );
  return response.data;
}
