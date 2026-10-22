import { apiClient } from './client';

export type FollowUpTaskStatus = 'pending' | 'confirmed' | 'dismissed';

export interface FollowUpTask {
  id: string;
  dischargeSummaryId: string;
  petId: string;
  title: string;
  instructions: string;
  dueDate: string | null;
  status: FollowUpTaskStatus;
  createdAt: string;
}

export interface FollowUpTaskListResponse {
  tasks: FollowUpTask[];
  /** Backend-owned decision: whether the caller may view follow-up tasks. */
  canView: boolean;
  /** Backend-owned decision: whether the caller may confirm reminders. */
  canConfirm: boolean;
}

export interface ConfirmFollowUpTaskInput {
  taskId: string;
  /** Explicit user confirmation before any notification or calendar event is created. */
  confirmed: boolean;
  createNotification?: boolean;
  createCalendarEvent?: boolean;
}

export interface ConfirmFollowUpTaskResponse {
  task: FollowUpTask;
  notificationCreated: boolean;
  calendarEventCreated: boolean;
}

/**
 * Fetch the reviewable follow-up task list derived from a discharge summary.
 * Authorization and consent are decided by the backend; the frontend only
 * renders what the backend allows.
 */
export async function getFollowUpTasks(
  dischargeSummaryId: string,
): Promise<FollowUpTaskListResponse> {
  const response = await apiClient.get<FollowUpTaskListResponse>(
    `/discharge-summaries/${encodeURIComponent(dischargeSummaryId)}/follow-up-tasks`,
  );
  return response.data;
}

/**
 * Confirm a follow-up task. This is the only path that may create a
 * notification or calendar event, and it requires explicit confirmation.
 * The backend remains the source of truth for consent and authorization.
 */
export async function confirmFollowUpTask(
  input: ConfirmFollowUpTaskInput,
): Promise<ConfirmFollowUpTaskResponse> {
  if (!input.confirmed) {
    throw new Error('Follow-up task confirmation is required before creating reminders.');
  }

  const response = await apiClient.post<ConfirmFollowUpTaskResponse>(
    `/follow-up-tasks/${encodeURIComponent(input.taskId)}/confirm`,
    {
      confirmed: input.confirmed,
      createNotification: input.createNotification ?? false,
      createCalendarEvent: input.createCalendarEvent ?? false,
    },
  );
  return response.data;
}

/**
 * Dismiss a follow-up task so it is no longer surfaced as a reminder.
 */
export async function dismissFollowUpTask(taskId: string): Promise<FollowUpTask> {
  const response = await apiClient.post<FollowUpTask>(
    `/follow-up-tasks/${encodeURIComponent(taskId)}/dismiss`,
  );
  return response.data;
}
