import React from "react";
import Avatar from "@/components/Avatar";
import { StaffMember } from "@/types/clinic";

interface StaffListProps {
  staff: StaffMember[];
}

export default function StaffList({ staff }: StaffListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {staff.map((member) => (
        <div
          key={member.id}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <Avatar
            src={member.avatar}
            name={member.name}
            type="staff"
            size={64}
            className="shrink-0 border-2 border-white shadow-sm"
          />
          <div>
            <h4 className="font-bold text-gray-900">{member.name}</h4>
            <p className="text-sm text-blue-600 font-semibold">{member.role}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {member.specialty.map((s) => (
                <span
                  key={s}
                  className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded border border-gray-100 uppercase"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
