import React from "react";
import { Clock, User, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Appointment } from "@/types/appointments";

interface AppointmentCardProps {
  appointment: Appointment;
  vetName: string;
  petName: string;
}

export default function AppointmentCard({
  appointment,
  vetName,
  petName,
}: AppointmentCardProps) {
  const statusColors = {
    Scheduled: "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-700",
    "No-Show": "bg-gray-100 text-gray-700",
  };

  const StatusIcon = {
    Scheduled: Clock,
    Completed: CheckCircle2,
    Cancelled: XCircle,
    "No-Show": AlertCircle,
  }[appointment.status];

  return (
    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-blue-900 group-hover:text-blue-600 transition-colors uppercase text-xs tracking-wider">
            {appointment.appointment_type}
          </h3>
          <p className="text-sm font-semibold text-gray-800">{petName}</p>
        </div>
        <div
          className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${statusColors[appointment.status]}`}
        >
          <StatusIcon className="w-3 h-3" />
          {appointment.status}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          {new Date(appointment.scheduled_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          ({appointment.duration} min)
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <User className="w-3.5 h-3.5" />
          {vetName}
        </div>
      </div>

      {appointment.notes && (
        <p className="mt-3 text-[10px] text-gray-400 italic bg-gray-50 p-2 rounded-lg">
          &quot;{appointment.notes}&quot;
        </p>
      )}
    </div>
  );
}
