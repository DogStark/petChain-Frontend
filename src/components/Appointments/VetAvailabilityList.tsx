import React, { useState, useEffect } from 'react';
import { Clock, Check, X, ShieldAlert, Save, Loader2 } from 'lucide-react';
import { clinicsAPI } from '@/lib/api/clinicsAPI';

const STORAGE_KEY = 'petchain-vet-availability';

const DEFAULT_AVAILABILITY = [
  { day: 'Monday', slots: '09:00 - 17:00', active: true },
  { day: 'Tuesday', slots: '09:00 - 17:00', active: true },
  { day: 'Wednesday', slots: '10:00 - 15:00', active: true },
  { day: 'Thursday', slots: '09:00 - 17:00', active: true },
  { day: 'Friday', slots: '09:00 - 16:00', active: true },
  { day: 'Saturday', slots: 'Closed', active: false },
  { day: 'Sunday', slots: 'Closed', active: false },
];

interface Props {
  clinicId?: string;
}

export default function VetAvailabilityList({ clinicId }: Props) {
  const [availability, setAvailability] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch {
        // fall through to defaults
      }
    }
    return DEFAULT_AVAILABILITY;
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(availability));
    } catch {
      // localStorage unavailable
    }
  }, [availability]);

  const toggleDay = (index: number) => {
    const newAvail = [...availability];
    newAvail[index] = { ...newAvail[index], active: !newAvail[index].active };
    setAvailability(newAvail);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(availability));
      if (clinicId) {
        await clinicsAPI.saveAvailability(clinicId, availability);
      }
      setFeedback({ type: 'success', message: 'Availability saved successfully.' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save availability. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-white/40">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-800">My Availability</h2>
        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <Clock className="w-3 h-3" />
          UTC+1
        </div>
      </div>

      <div className="space-y-3">
        {availability.map((day: { day: string; slots: string; active: boolean }, idx: number) => (
          <div
            key={day.day}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
              day.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${day.active ? 'bg-green-500' : 'bg-gray-300'}`}
              ></div>
              <div>
                <p className="text-sm font-bold text-gray-800">{day.day}</p>
                <p className="text-[10px] text-gray-500">{day.slots}</p>
              </div>
            </div>

            <button
              onClick={() => toggleDay(idx)}
              className={`p-2 rounded-xl transition-all ${
                day.active
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : 'bg-green-50 text-green-500 hover:bg-green-100'
              }`}
            >
              {day.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      {feedback && (
        <div
          className={`mt-4 p-3 rounded-2xl text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Save className="w-4 h-4" /> Save Availability
          </>
        )}
      </button>

      <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border border-yellow-100 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-yellow-600 shrink-0" />
        <p className="text-[10px] text-yellow-700 leading-relaxed">
          Changes to your availability will not affect already scheduled appointments. Please manage
          those manually.
        </p>
      </div>
    </div>
  );
}
