import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { appointmentsAPI, UpcomingAppointmentView } from '@/lib/api/appointmentsAPI';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<UpcomingAppointmentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appointmentsAPI
      .getUpcomingAppointments()
      .then(setAppointments)
      .catch(() => {/* show empty calendar on error */})
      .finally(() => setLoading(false));
  }, []);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build a map: "YYYY-MM-DD" -> appointments
  const apptByDay = new Map<string, UpcomingAppointmentView[]>();
  for (const view of appointments) {
    const d = new Date(view.appointment.scheduledAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    apptByDay.set(key, [...(apptByDay.get(key) ?? []), view]);
  }

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`prev-${i}`} className="h-24 md:h-32 border border-gray-100 bg-gray-50/50" />);
  }

  for (let d = 1; d <= totalDays; d++) {
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
    const key = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayAppts = apptByDay.get(key) ?? [];

    days.push(
      <div
        key={d}
        className={`h-24 md:h-32 border border-gray-100 p-2 transition-all hover:bg-blue-50/50 cursor-pointer relative group ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}
      >
        <span className={`text-sm font-semibold ${isToday ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
          {d}
        </span>
        <div className="mt-1 space-y-0.5 overflow-hidden">
          {dayAppts.slice(0, 2).map((view) => (
            <div
              key={view.appointment.id}
              className="p-1 bg-pink-100 text-pink-700 text-[10px] md:text-xs rounded border border-pink-200 truncate"
            >
              {view.appointment.appointmentType}: {view.petName}
            </div>
          ))}
          {dayAppts.length > 2 && (
            <div className="text-[10px] text-gray-400 pl-1">+{dayAppts.length - 2} more</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/40 backdrop-blur-sm">
      <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900">{monthNames[month]} {year}</h2>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
            Today
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => (
          <div key={day} className="py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">{days}</div>
    </div>
  );
}
