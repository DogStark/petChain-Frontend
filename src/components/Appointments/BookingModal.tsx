import React, { useState } from "react";
import { X, Calendar, Clock, User, Heart } from "lucide-react";
import { AppointmentType } from "@/types/appointments";

interface BookingModalProps {
  onClose: () => void;
}

export default function BookingModal({ onClose }: BookingModalProps) {
  const [formData, setFormData] = useState({
    pet_id: "",
    vet_id: "",
    appointment_type: "Checkup" as AppointmentType,
    scheduled_at: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    console.log("Booking appointment:", formData);
    onClose();
  };

  const types: { value: AppointmentType; color: string }[] = [
    { value: "Checkup", color: "bg-green-100 text-green-700 border-green-200" },
    { value: "Emergency", color: "bg-red-100 text-red-700 border-red-200" },
    { value: "Surgery", color: "bg-blue-100 text-blue-700 border-blue-200" },
    {
      value: "Vaccination",
      color: "bg-purple-100 text-purple-700 border-purple-200",
    },
    {
      value: "Dental",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    {
      value: "Consultation",
      color: "bg-pink-100 text-pink-700 border-pink-200",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-blue-900">Book Appointment</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            {/* Pet Selection */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" /> Select Pet
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                value={formData.pet_id}
                onChange={(e) =>
                  setFormData({ ...formData, pet_id: e.target.value })
                }
              >
                <option value="">Choose your pet</option>
                <option value="pet1">Bella (Golden Retriever)</option>
                <option value="pet2">Max (Siamese Cat)</option>
                <option value="pet3">Luna (Rabbit)</option>
              </select>
            </div>

            {/* Type Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Appointment Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {types.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, appointment_type: type.value })
                    }
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.appointment_type === type.value
                        ? type.color + " ring-2 ring-offset-1 ring-blue-500"
                        : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {type.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" /> Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                  value={formData.scheduled_at.split("T")[0]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scheduled_at: e.target.value + "T09:00",
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" /> Time
                </label>
                <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none">
                  <option>09:00 AM</option>
                  <option>10:00 AM</option>
                  <option>11:00 AM</option>
                  <option>02:00 PM</option>
                  <option>03:00 PM</option>
                </select>
              </div>
            </div>

            {/* Vet Selection */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" /> Veterinarian
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                value={formData.vet_id}
                onChange={(e) =>
                  setFormData({ ...formData, vet_id: e.target.value })
                }
              >
                <option value="">Select a vet</option>
                <option value="vet1">Dr. Sarah Miller (General)</option>
                <option value="vet2">Dr. James Wilson (Surgeon)</option>
                <option value="vet3">Dr. Emily Chen (Emergency)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-6 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-6 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
            >
              Confirm Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
