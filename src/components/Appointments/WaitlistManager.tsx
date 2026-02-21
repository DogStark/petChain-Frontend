import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function WaitlistManager() {
  const waitlist = [
    { id: "1", pet: "Charlie", type: "Surgery", joined: "2h ago" },
    { id: "2", pet: "Luna", type: "Checkup", joined: "5h ago" },
  ];

  return (
    <div className="space-y-3">
      {waitlist.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
              {entry.pet[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{entry.pet}</p>
              <p className="text-[10px] text-gray-500">
                {entry.type} • {entry.joined}
              </p>
            </div>
          </div>
          <button
            className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors"
            title="Schedule"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>
      ))}
      <button className="w-full py-2 text-xs font-bold text-blue-600 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">
        + Add to Waitlist
      </button>
    </div>
  );
}
