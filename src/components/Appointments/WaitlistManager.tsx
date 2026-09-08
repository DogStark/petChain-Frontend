import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { appointmentsAPI } from '@/lib/api/appointmentsAPI';

interface WaitlistEntry {
  id: string;
  petName: string;
  type: string;
  joinedAt: string;
}

export default function WaitlistManager() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsAPI.getWaitlist();
      setWaitlist(data);
    } catch {
      setError('Failed to load waitlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWaitlist(); }, [fetchWaitlist]);

  const handleSchedule = async (id: string) => {
    setActionId(id);
    try {
      await appointmentsAPI.scheduleFromWaitlist(id);
      setWaitlist((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to schedule appointment.');
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setActionId(id);
    try {
      await appointmentsAPI.removeFromWaitlist(id);
      setWaitlist((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to remove from waitlist.');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading waitlist...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {waitlist.length === 0 && !error ? (
        <p className="text-center text-sm text-gray-400 py-4">No pets on the waitlist.</p>
      ) : (
        waitlist.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                {entry.petName[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{entry.petName}</p>
                <p className="text-[10px] text-gray-500">{entry.type} • {entry.joinedAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSchedule(entry.id)}
                disabled={actionId === entry.id}
                className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors disabled:opacity-50"
                aria-label={`Schedule appointment for ${entry.petName}`}
              >
                {actionId === entry.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => handleRemove(entry.id)}
                disabled={actionId === entry.id}
                className="p-2 hover:bg-red-100 text-red-400 rounded-full transition-colors disabled:opacity-50"
                aria-label={`Remove ${entry.petName} from waitlist`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={fetchWaitlist}
        className="w-full py-2 text-xs font-bold text-blue-600 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
      >
        + Add to Waitlist
      </button>
    </div>
  );
}
