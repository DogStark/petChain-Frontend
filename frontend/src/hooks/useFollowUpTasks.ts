import { useCallback, useMemo, useState } from 'react';

export interface DischargeFollowUpInstruction {
  id: string;
  label: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface FollowUpTask {
  id: string;
  label: string;
  dueDate: string | null;
  notes: string | null;
  confirmed: boolean;
}

export type FollowUpTaskStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

export interface CreateFollowUpReminderInput {
  taskId: string;
  channel: 'notification' | 'calendar';
}

export interface FollowUpTasksClient {
  createReminder: (input: CreateFollowUpReminderInput) => Promise<void>;
}

export interface UseFollowUpTasksOptions {
  instructions?: DischargeFollowUpInstruction[] | null;
  client?: FollowUpTasksClient | null;
  status?: FollowUpTaskStatus;
}

export interface UseFollowUpTasksResult {
  tasks: FollowUpTask[];
  status: FollowUpTaskStatus;
  isEmpty: boolean;
  isDenied: boolean;
  pendingTaskId: string | null;
  error: string | null;
  confirmTask: (taskId: string) => void;
  unconfirmTask: (taskId: string) => void;
  createReminder: (taskId: string, channel: CreateFollowUpReminderInput['channel']) => Promise<boolean>;
}

function normalizeInstructions(
  instructions?: DischargeFollowUpInstruction[] | null,
): FollowUpTask[] {
  if (!instructions || instructions.length === 0) {
    return [];
  }

  return instructions
    .filter((instruction) => instruction && instruction.id && instruction.label)
    .map((instruction) => ({
      id: instruction.id,
      label: instruction.label,
      dueDate: instruction.dueDate ?? null,
      notes: instruction.notes ?? null,
      confirmed: false,
    }));
}

/**
 * Turns structured discharge follow-up instructions into reviewable tasks.
 * Reminders (notifications / calendar events) are only created after the user
 * explicitly confirms a task. Authorization and consent are decided by the
 * backend; this hook only surfaces the resulting status.
 */
export function useFollowUpTasks({
  instructions,
  client,
  status = 'ready',
}: UseFollowUpTasksOptions = {}): UseFollowUpTasksResult {
  const [tasks, setTasks] = useState<FollowUpTask[]>(() => normalizeInstructions(instructions));
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmTask = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, confirmed: true } : task)),
    );
  }, []);

  const unconfirmTask = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, confirmed: false } : task)),
    );
  }, []);

  const createReminder = useCallback(
    async (taskId: string, channel: CreateFollowUpReminderInput['channel']) => {
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task || !task.confirmed) {
        setError('Confirm this follow-up task before creating a reminder.');
        return false;
      }
      if (!client) {
        setError('Reminders are unavailable right now.');
        return false;
      }

      setError(null);
      setPendingTaskId(taskId);
      try {
        await client.createReminder({ taskId, channel });
        return true;
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Unable to create the reminder. Please try again.',
        );
        return false;
      } finally {
        setPendingTaskId(null);
      }
    },
    [client, tasks],
  );

  const isEmpty = tasks.length === 0;
  const isDenied = status === 'denied';

  return useMemo(
    () => ({
      tasks,
      status,
      isEmpty,
      isDenied,
      pendingTaskId,
      error,
      confirmTask,
      unconfirmTask,
      createReminder,
    }),
    [tasks, status, isEmpty, isDenied, pendingTaskId, error, confirmTask, unconfirmTask, createReminder],
  );
}

export default useFollowUpTasks;
