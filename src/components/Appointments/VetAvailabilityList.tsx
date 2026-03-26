import React, { useState } from "react";
import { Clock, Check, X, ShieldAlert } from "lucide-react";

export default function VetAvailabilityList() {
  const [availability, setAvailability] = useState([
    { day: "Monday", slots: "09:00 - 17:00", active: true },
    { day: "Tuesday", slots: "09:00 - 17:00", active: true },
    { day: "Wednesday", slots: "10:00 - 15:00", active: true },
    { day: "Thursday", slots: "09:00 - 17:00", active: true },
    { day: "Friday", slots: "09:00 - 16:00", active: true },
    { day: "Saturday", slots: "Closed", active: false },
    { day: "Sunday", slots: "Closed", active: false },
  ]);

  const toggleDay = (index: number) => {
    const newAvail = [...availability];
    newAvail[index].active = !newAvail[index].active;
    setAvailability(newAvail);
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
        {availability.map((day, idx) => (
          <div
            key={day.day}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
              day.active
                ? "bg-white border-gray-100"
                : "bg-gray-50 border-gray-50 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${day.active ? "bg-green-500" : "bg-gray-300"}`}
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
                  ? "bg-red-50 text-red-500 hover:bg-red-100"
                  : "bg-green-50 text-green-500 hover:bg-green-100"
              }`}
            >
              {day.active ? (
                <X className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border border-yellow-100 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-yellow-600 shrink-0" />
        <p className="text-[10px] text-yellow-700 leading-relaxed">
          Changes to your availability will not affect already scheduled
          appointments. Please manage those manually.
        </p>
      </div>
    </div>
  );
}
