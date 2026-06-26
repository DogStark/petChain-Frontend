import React, { useState, useEffect, useCallback } from "react";
import { GetServerSideProps } from 'next';
import Head from "next/head";
import HeaderComponent from "@/components/Header";
import CalendarView from "@/components/Appointments/CalendarView";
import BookingModal from "@/components/Appointments/BookingModal";
import AppointmentCard from "@/components/Appointments/AppointmentCard";
import WaitlistManager from "@/components/Appointments/WaitlistManager";
import VetAvailabilityList from "@/components/Appointments/VetAvailabilityList";
import { Plus, Users, Loader2 } from "lucide-react";
import {
  appointmentsAPI,
  UpcomingAppointmentView,
} from "@/lib/api/appointmentsAPI";

export default function AppointmentsPage() {
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "availability">(
    "calendar",
  );
  const [upcoming, setUpcoming] = useState<UpcomingAppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUpcoming = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsAPI.getUpcomingAppointments();
      setUpcoming(data);
    } catch {
      setError("Failed to load upcoming appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);

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
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm">Loading upcoming appointments...</p>
                </div>
              ) : error ? (
                <div className="text-center py-6">
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                  <button
                    onClick={loadUpcoming}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No upcoming appointments. Book a visit when you are ready.
                </p>
              ) : (
                <div className="space-y-4">
                  {upcoming.map((item) => (
                    <AppointmentCard
                      key={item.appointment.id}
                      appointment={item.appointment}
                      petName={item.petName}
                      vetName={item.vetName}
                    />
                  ))}
                </div>
              )}
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

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
