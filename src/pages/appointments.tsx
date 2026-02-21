import React, { useState } from "react";
import Head from "next/head";
import HeaderComponent from "@/components/Header";
import CalendarView from "@/components/Appointments/CalendarView";
import BookingModal from "@/components/Appointments/BookingModal";
import AppointmentCard from "@/components/Appointments/AppointmentCard";
import WaitlistManager from "@/components/Appointments/WaitlistManager";
import VetAvailabilityList from "@/components/Appointments/VetAvailabilityList";
import { Plus, Users } from "lucide-react";
import { Appointment } from "@/types/appointments";

const MOCK_UPCOMING: Appointment[] = [
  {
    id: "1",
    pet_id: "1",
    vet_id: "1",
    appointment_type: "Checkup",
    scheduled_at: "2023-11-15T10:00:00Z",
    duration: 30,
    status: "Scheduled",
    notes: "Regular checkup for Bella",
    reminder_sent: false,
    created_at: "2023-11-01T00:00:00Z",
    updated_at: "2023-11-01T00:00:00Z",
  },
  {
    id: "2",
    pet_id: "2",
    vet_id: "2",
    appointment_type: "Surgery",
    scheduled_at: "2023-11-22T14:00:00Z",
    duration: 120,
    status: "Scheduled",
    notes: "Dental cleaning for Max",
    reminder_sent: false,
    created_at: "2023-11-05T00:00:00Z",
    updated_at: "2023-11-05T00:00:00Z",
  },
];

export default function AppointmentsPage() {
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "availability">(
    "calendar",
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>Appointments | PetChain</title>
        <meta
          name="description"
          content="Manage your pet's veterinary appointments."
        />
      </Head>

      <HeaderComponent />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Appointments</h1>
            <p className="text-gray-600 mt-2">
              Schedule and manage veterinary visits for your pets.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/60 p-1 rounded-full border border-white/40 flex">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${viewMode === "calendar" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:text-blue-600"}`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode("availability")}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${viewMode === "availability" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:text-blue-600"}`}
              >
                Availability
              </button>
            </div>
            <button
              onClick={() => setBookingModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 shadow-lg transition-all transform hover:scale-105"
            >
              <Plus className="w-5 h-5" /> Book
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            {viewMode === "calendar" ? (
              <CalendarView />
            ) : (
              <VetAvailabilityList />
            )}
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/40">
              <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" /> Upcoming
              </h2>
              <div className="space-y-4">
                <AppointmentCard
                  appointment={MOCK_UPCOMING[0]}
                  petName="Bella"
                  vetName="Dr. Sarah Miller"
                />
                <AppointmentCard
                  appointment={MOCK_UPCOMING[1]}
                  petName="Max"
                  vetName="Dr. James Wilson"
                />
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/40">
              <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-500" /> Waitlist
              </h2>
              <WaitlistManager />
            </div>
          </div>
        </div>
      </main>

      {isBookingModalOpen && (
        <BookingModal onClose={() => setBookingModalOpen(false)} />
      )}

      <footer className="text-center text-gray-500 py-6 mt-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <span>© 2024 PetChain. MIT License.</span>
        </div>
      </footer>
    </div>
  );
}
