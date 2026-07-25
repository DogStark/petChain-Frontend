import React, { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import {
  MapPin,
  Phone,
  Mail,
  Star,
  Clock,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import HeaderComponent from '@/components/Header';
import ServiceList from '@/components/Clinics/ServiceList';
import StaffList from '@/components/Clinics/StaffList';
import ReviewSection from '@/components/Clinics/ReviewSection';
import BookingModal from '@/components/Appointments/BookingModal';
import SafeImage from '@/components/SafeImage';
import { Clinic, ClinicService } from '@/types/clinic';
import { AppointmentType } from '@/types/appointments';
import { clinicsAPI } from '@/lib/api/clinicsAPI';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort mapping from a service name to one of the fixed AppointmentType
 * values. Falls back to 'Consultation' so the modal always opens with
 * something sensible — the user can still change the type inside the modal.
 */
function serviceNameToAppointmentType(serviceName: string): AppointmentType {
  const name = serviceName.toLowerCase();
  if (name.includes('emergency')) return 'Emergency';
  if (name.includes('surg')) return 'Surgery';
  if (name.includes('vaccin') || name.includes('immuni')) return 'Vaccination';
  if (name.includes('dental') || name.includes('teeth')) return 'Dental';
  if (name.includes('checkup') || name.includes('check-up') || name.includes('wellness'))
    return 'Checkup';
  return 'Consultation';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ClinicDetailPageProps {
  clinicId: string;
}

export default function ClinicDetailPage({ clinicId }: ClinicDetailPageProps) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking modal state
  const [bookingService, setBookingService] = useState<ClinicService | null>(null);

  // Active tab for the detail sections
  const [activeTab, setActiveTab] = useState<'services' | 'staff' | 'reviews'>('services');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const loadClinic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clinicsAPI.getClinicById(clinicId);
      setClinic(data);
    } catch {
      setError('Could not load clinic details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadClinic();
  }, [loadClinic]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleBook = (service: ClinicService) => {
    setBookingService(service);
  };

  const handleCloseModal = () => {
    setBookingService(null);
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const primaryLocation = clinic?.locations[0];

  const tabs: { id: 'services' | 'staff' | 'reviews'; label: string }[] = [
    { id: 'services', label: 'Services' },
    { id: 'staff', label: 'Staff' },
    { id: 'reviews', label: 'Reviews' },
  ];

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>{clinic ? `${clinic.name} | PetChain` : 'Clinic | PetChain'}</title>
        <meta
          name="description"
          content={
            clinic
              ? `Book a veterinary appointment at ${clinic.name}. ${clinic.description}`
              : 'Veterinary clinic details on PetChain.'
          }
        />
      </Head>

      <HeaderComponent />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        {/* Back link */}
        <Link
          href="/clinics"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to clinics
        </Link>

        {/* ------------------------------------------------------------------ */}
        {/* Loading state                                                       */}
        {/* ------------------------------------------------------------------ */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p>Loading clinic details…</p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Error state                                                         */}
        {/* ------------------------------------------------------------------ */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadClinic}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition-colors shadow-lg"
            >
              Retry
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Clinic content                                                      */}
        {/* ------------------------------------------------------------------ */}
        {!loading && !error && clinic && (
          <>
            {/* Hero card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 overflow-hidden mb-8">
              {/* Cover image */}
              <div className="relative h-52 md:h-64 w-full bg-blue-100">
                {clinic.mainImage ? (
                  <SafeImage
                    src={clinic.mainImage}
                    alt={`${clinic.name} clinic`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 896px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-16 h-16 text-blue-300" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Clinic meta */}
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-extrabold text-blue-900 mb-1">{clinic.name}</h1>
                    <p className="text-gray-600 max-w-2xl leading-relaxed">{clinic.description}</p>
                  </div>

                  {/* Rating badge */}
                  <div className="shrink-0 flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-2xl shadow-sm self-start">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" aria-hidden="true" />
                    <span className="font-black text-yellow-700 text-lg">
                      {clinic.rating > 0 ? clinic.rating.toFixed(1) : 'N/A'}
                    </span>
                    {clinic.reviewCount > 0 && (
                      <span className="text-xs text-yellow-600 font-semibold">
                        ({clinic.reviewCount})
                      </span>
                    )}
                  </div>
                </div>

                {/* Location / contact chips */}
                {primaryLocation && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                      <MapPin className="w-4 h-4 text-pink-500 shrink-0" aria-hidden="true" />
                      {primaryLocation.address}, {primaryLocation.city}
                    </span>
                    {primaryLocation.phone && (
                      <a
                        href={`tel:${primaryLocation.phone}`}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:text-blue-600 transition-colors"
                      >
                        <Phone className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
                        {primaryLocation.phone}
                      </a>
                    )}
                    {primaryLocation.email && (
                      <a
                        href={`mailto:${primaryLocation.email}`}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:text-blue-600 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
                        {primaryLocation.email}
                      </a>
                    )}
                    {clinic.hours.some((h) => !h.isClosed) && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
                        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Open Now
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/60 p-1 rounded-2xl border border-white/40 shadow-sm mb-8 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                  aria-pressed={activeTab === tab.id}
                >
                  {tab.label}
                  {tab.id === 'services' && clinic.services.length > 0 && (
                    <span
                      className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        activeTab === 'services'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-500'
                      }`}
                    >
                      {clinic.services.length}
                    </span>
                  )}
                  {tab.id === 'staff' && clinic.staff.length > 0 && (
                    <span
                      className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        activeTab === 'staff'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-500'
                      }`}
                    >
                      {clinic.staff.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab panels */}
            {activeTab === 'services' && (
              <section aria-labelledby="services-heading">
                <h2 id="services-heading" className="sr-only">
                  Services offered by {clinic.name}
                </h2>
                {clinic.services.length > 0 ? (
                  <ServiceList services={clinic.services} onBook={handleBook} />
                ) : (
                  <p className="text-center text-gray-500 py-12">
                    No services listed for this clinic yet.
                  </p>
                )}
              </section>
            )}

            {activeTab === 'staff' && (
              <section aria-labelledby="staff-heading">
                <h2 id="staff-heading" className="sr-only">
                  Staff at {clinic.name}
                </h2>
                {clinic.staff.length > 0 ? (
                  <StaffList staff={clinic.staff} />
                ) : (
                  <p className="text-center text-gray-500 py-12">
                    Staff profiles coming soon.
                  </p>
                )}
              </section>
            )}

            {activeTab === 'reviews' && (
              <section aria-labelledby="reviews-heading">
                <h2 id="reviews-heading" className="sr-only">
                  Reviews for {clinic.name}
                </h2>
                {clinic.reviews && clinic.reviews.length > 0 ? (
                  <ReviewSection reviews={clinic.reviews} averageRating={clinic.rating} />
                ) : (
                  <p className="text-center text-gray-500 py-12">
                    No reviews yet. Be the first to review this clinic!
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-gray-500 py-10 bg-white/40 border-t border-white/60 mt-auto">
        <span>© 2024 PetChain Clinic Directory. Premium Care for Every Pet.</span>
      </footer>

      {/* -------------------------------------------------------------------- */}
      {/* Booking modal — rendered outside the main layout so it sits on top    */}
      {/* -------------------------------------------------------------------- */}
      {bookingService !== null && (
        <BookingModal
          onClose={handleCloseModal}
          initialAppointmentType={serviceNameToAppointmentType(bookingService.name)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side props — just forwards the dynamic segment to the page
// ---------------------------------------------------------------------------
export const getServerSideProps: GetServerSideProps<ClinicDetailPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  return {
    props: { clinicId: id },
  };
};
