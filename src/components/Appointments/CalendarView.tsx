import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  // Padding for previous month
  for (let i = 0; i < startOffset; i++) {
    days.push(
      <div
        key={`prev-${i}`}
        className="h-24 md:h-32 border border-gray-100 bg-gray-50/50"
      ></div>,
    );
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const isToday =
      new Date().toDateString() === new Date(year, month, d).toDateString();
    days.push(
      <div
        key={d}
        className={`h-24 md:h-32 border border-gray-100 p-2 transition-all hover:bg-blue-50/50 cursor-pointer relative group ${isToday ? "bg-blue-50/30" : "bg-white"}`}
      >
        <span
          className={`text-sm font-semibold ${isToday ? "bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full" : "text-gray-700"}`}
        >
          {d}
        </span>

        {/* Mock appointment indicator */}
        {d === 15 && (
          <div className="mt-2 p-1 bg-pink-100 text-pink-700 text-[10px] md:text-xs rounded border border-pink-200 truncate">
            Checkup: Bella
          </div>
        )}
        {d === 22 && (
          <div className="mt-2 p-1 bg-blue-100 text-blue-700 text-[10px] md:text-xs rounded border border-blue-200 truncate">
            Surgery: Max
          </div>
        )}
      </div>,
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/40 backdrop-blur-sm">
      <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900">
            {monthNames[month]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">{days}</div>
    </div>
  );
}
