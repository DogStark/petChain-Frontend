import { isAxiosError } from "axios";
import {
  Calendar,
  Share2,
  Star,
  MapPin,
  Clock,
  Phone,
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState, useEffect, useCallback } from "react";

import BookingModal from "@/components/Appointments/BookingModal";
import LocationMap from "@/components/Clinics/LocationMap";
import ReviewSection from "@/components/Clinics/ReviewSection";
import ServiceList from "@/components/Clinics/ServiceList";
import StaffList from "@/components/Clinics/StaffList";
import HeaderComponent from "@/components/Header";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
import type { Clinic } from "@/types/clinic";

type Tab = "services" | "staff" | "reviews" | "location";

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "services", label: "Services" },
  { id: "staff", label: "Our Team" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
];

/** Returns the human-friendly "Open Now" or next-opening string for today. */
function getOpenStatus(clinic: Clinic): { isOpen: boolean; label: string } {
  const days: Clinic["hours"][0]["day"][] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = days[new Date().getDay()];
  const todayHours = clinic.hours.find((h) => h.day === today);

  if (!todayHours || todayHours.isClosed) {
    return { isOpen: false, label: "Closed today" };
  }

  const now = new Date();
  const [openH, openM] = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
    return { isOpen: true, label: `Open · Closes ${todayHours.close}` };
  }
  if (nowMinutes < openMinutes) {
    return { isOpen: false, label: `Opens ${todayHours.open}` };
  }
  return { isOpen: false, label: "Closed now" };
}

export default function ClinicProfile() {
  const router = useRouter();
  const { id } = router.query;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [isBookingOpen, setBookingOpen] = useState(false);
  const [shareConfirmed, setShareConfirmed] = useState(false);

  const loadClinic = useCallback(async (clinicId: string) => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await clinicsAPI.getClinicById(clinicId);
      setClinic(data);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError("Failed to load clinic details. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof id === "string") {
      loadClinic(id);
    }
  }, [router.isReady, id, loadClinic]);

  /** Web Share API with clipboard-copy fallback */
  const handleShare = useCallback(async () => {
    const url =
      typeof window !== "undefined" ? window.location.href : "";
    const title = clinic ? `${clinic.name} — PetChain` : "PetChain Clinic";
    const text = clinic
      ? `Check out ${clinic.name} on PetChain!`
      : "Check out this clinic on PetChain!";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard copy
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setShareConfirmed(true);
      setTimeout(() => setShareConfirmed(false), 2500);
    } catch {
      // Last-resort: prompt
      window.prompt("Copy this link:", url);
    }
  }, [clinic]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans">
        <Head>
          <title>Loading clinic details… | PetChain</title>
        </Head>
        <HeaderComponent />
        <main className="flex-grow flex flex-col items-center justify-center gap-4 text-gray-500">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
          <p className="font-medium">Loading clinic details…</p>
        </main>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans">
        <Head>
          <title>Clinic not found | PetChain</title>
        </Head>
        <HeaderComponent />
        <main className="flex-grow flex flex-col items-center justify-center gap-6 text-center px-4">
          <AlertCircle className="w-16 h-16 text-pink-400" />
          <h1 className="text-3xl font-black text-blue-900">Clinic not found</h1>
          <p className="text-gray-500 max-w-sm">
            The clinic you are looking for does not exist or may have been removed.
          </p>
          <Link
            href="/clinics"
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition-colors shadow-lg"
          >
            Browse all clinics
          </Link>
        </main>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans">
        <Head>
          <title>Error | PetChain</title>
        </Head>
        <HeaderComponent />
        <main className="flex-grow flex flex-col items-center justify-center gap-6 text-center px-4">
          <AlertCircle className="w-16 h-16 text-red-400" />
          <h1 className="text-2xl font-black text-blue-900">
            Something went wrong
          </h1>
          <p className="text-gray-500 max-w-sm">{error}</p>
          <button
            onClick={() => typeof id === "string" && loadClinic(id)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition-colors shadow-lg"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  // ── Clinic profile ─────────────────────────────────────────────────────────
  const primaryLocation = clinic.locations[0];
  const openStatus = getOpenStatus(clinic);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>{clinic.name} | PetChain</title>
        <meta
          name="description"
          content={clinic.description}
        />
      </Head>

      <HeaderComponent />

      {/* ── Back breadcrumb ── */}
      <div className="container mx-auto px-4 pt-6 max-w-7xl">
        <Link
          href="/clinics"
          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          All Clinics
        </Link>
      </div>

      {/* ── Hero section ── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white overflow-hidden mt-4">
        {/* Decorative blobs */}
        <div
          className="absolute inset-0 opacity-10"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="container mx-auto px-4 py-16 max-w-7xl relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — clinic info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-widest text-blue-200">
                  Verified Clinic
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    openStatus.isOpen
                      ? "bg-green-500/20 text-green-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {openStatus.label}
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                {clinic.name}
              </h1>

              <p className="text-blue-100 text-lg leading-relaxed mb-6 max-w-lg">
                {clinic.description}
              </p>

              {/* Rating */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-5 h-5 ${
                        s <= Math.round(clinic.rating)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-blue-800 fill-blue-800"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-black text-xl">{clinic.rating.toFixed(1)}</span>
                <span className="text-blue-300 text-sm">
                  ({clinic.reviewCount} reviews)
                </span>
              </div>

              {/* Quick location info */}
              {primaryLocation && (
                <div className="flex flex-wrap items-center gap-5 text-sm text-blue-200 mb-8">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-pink-400" />
                    {primaryLocation.city || primaryLocation.address}
                  </span>
                  {primaryLocation.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-blue-400" />
                      {primaryLocation.phone}
                    </span>
                  )}
                  {primaryLocation.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-blue-400" />
                      {primaryLocation.email}
                    </span>
                  )}
                </div>
              )}

              {/* ── Hero CTAs ── */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Book an Appointment — primary CTA */}
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="px-8 py-4 bg-white text-blue-900 font-black rounded-2xl shadow-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Calendar className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  Book an Appointment
                </button>

                {/* Share Clinic — Web Share API with clipboard fallback */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all flex items-center justify-center gap-3"
                  aria-live="polite"
                >
                  <Share2 className="w-5 h-5" aria-hidden="true" />
                  {shareConfirmed ? "Link copied!" : "Share Clinic"}
                </button>
              </div>
            </div>

            {/* Right — stats */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/10 text-center">
                <div className="text-4xl font-black mb-1">{clinic.services.length}</div>
                <div className="text-blue-300 text-sm font-bold uppercase tracking-wider">
                  Services
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/10 text-center">
                <div className="text-4xl font-black mb-1">{clinic.staff.length}</div>
                <div className="text-blue-300 text-sm font-bold uppercase tracking-wider">
                  Staff
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/10 text-center">
                <div className="text-4xl font-black mb-1">{clinic.locations.length}</div>
                <div className="text-blue-300 text-sm font-bold uppercase tracking-wider">
                  Locations
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/10 text-center">
                <div className="text-4xl font-black mb-1">{clinic.reviewCount}</div>
                <div className="text-blue-300 text-sm font-bold uppercase tracking-wider">
                  Reviews
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Info */}
      <main id="main-content" className="container mx-auto px-4 py-8 max-w-7xl -mt-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* Tabs Navigation */}
            <nav className="flex flex-wrap gap-2 p-1 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/40 shadow-sm overflow-x-auto">
      {/* ── Main content ── */}
      <main className="container mx-auto px-4 py-10 max-w-7xl flex flex-col lg:flex-row gap-10">
        {/* Left — tabbed content */}
        <div className="flex-grow min-w-0">
          {/* Tab nav */}
          <nav
            role="tablist"
            aria-label="Clinic information sections"
            className="flex gap-1 bg-white/60 backdrop-blur-sm p-1.5 rounded-2xl border border-white/40 shadow-sm mb-8 overflow-x-auto"
          >
            {TAB_LABELS.map(({ id: tabId, label }) => (
              <button
                key={tabId}
                role="tab"
                aria-selected={activeTab === tabId}
                aria-controls={`panel-${tabId}`}
                id={`tab-${tabId}`}
                onClick={() => setActiveTab(tabId)}
                className={`flex-1 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === tabId
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Tab panels */}
          <div
            id="panel-services"
            role="tabpanel"
            aria-labelledby="tab-services"
            hidden={activeTab !== "services"}
          >
            {clinic.services.length > 0 ? (
              <ServiceList services={clinic.services} />
            ) : (
              <p className="text-center text-gray-400 py-12 font-medium">
                No services listed yet.
              </p>
            )}
          </div>

          <div
            id="panel-staff"
            role="tabpanel"
            aria-labelledby="tab-staff"
            hidden={activeTab !== "staff"}
          >
            {clinic.staff.length > 0 ? (
              <StaffList staff={clinic.staff} />
            ) : (
              <p className="text-center text-gray-400 py-12 font-medium">
                Staff information not available.
              </p>
            )}
          </div>

          <div
            id="panel-reviews"
            role="tabpanel"
            aria-labelledby="tab-reviews"
            hidden={activeTab !== "reviews"}
          >
            {clinic.reviews && clinic.reviews.length > 0 ? (
              <ReviewSection
                reviews={clinic.reviews}
                averageRating={clinic.rating}
              />
            ) : (
              <p className="text-center text-gray-400 py-12 font-medium">
                No reviews yet. Be the first to review this clinic.
              </p>
            )}
          </div>

          <div
            id="panel-location"
            role="tabpanel"
            aria-labelledby="tab-location"
            hidden={activeTab !== "location"}
          >
            {clinic.locations.length > 0 ? (
              <LocationMap locations={clinic.locations} />
            ) : (
              <p className="text-center text-gray-400 py-12 font-medium">
                Location information not available.
              </p>
            )}
          </div>
        </div>

        {/* Right — sidebar */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          {/* Hours card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/40">
            <h2 className="text-lg font-black text-blue-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" aria-hidden="true" />
              Opening Hours
            </h2>
            <ul className="space-y-2">
              {clinic.hours.map((h) => (
                <li key={h.day} className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-700">{h.day}</span>
                  <span
                    className={
                      h.isClosed ? "text-red-400 font-bold" : "text-gray-500"
                    }
                  >
                    {h.isClosed ? "Closed" : `${h.open} – ${h.close}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick-book card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl">
            <h2 className="font-black text-xl mb-2">Ready to visit?</h2>
            <p className="text-blue-100 text-sm leading-relaxed mb-5">
              Book an appointment with {clinic.name} in just a few taps.
            </p>
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="w-full py-3 bg-white text-blue-700 font-black rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95"
            >
              Book Now
            </button>
          </div>

          {/* Contact card */}
          {primaryLocation && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/40">
              <h2 className="text-lg font-black text-blue-900 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-pink-500" aria-hidden="true" />
                Contact
              </h2>
              <ul className="space-y-3 text-sm">
                {primaryLocation.phone && (
                  <li className="flex items-center gap-2.5 text-gray-700">
                    <Phone className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
                    <a
                      href={`tel:${primaryLocation.phone}`}
                      className="font-semibold hover:text-blue-600 transition-colors"
                    >
                      {primaryLocation.phone}
                    </a>
                  </li>
                )}
                {primaryLocation.email && (
                  <li className="flex items-center gap-2.5 text-gray-700">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
                    <a
                      href={`mailto:${primaryLocation.email}`}
                      className="font-semibold hover:text-blue-600 transition-colors truncate"
                    >
                      {primaryLocation.email}
                    </a>
                  </li>
                )}
                {primaryLocation.address && (
                  <li className="flex items-start gap-2.5 text-gray-700">
                    <MapPin className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">
                      {primaryLocation.address}
                      {primaryLocation.city ? `, ${primaryLocation.city}` : ""}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </aside>
      </main>

      <footer className="text-center text-gray-500 py-8 bg-white/40 border-t border-white/60 mt-auto">
        <span>© 2024 PetChain. Premium Care for Every Pet.</span>
      </footer>

      {/* ── Booking modal ── */}
      {isBookingOpen && (
        <BookingModal
          onClose={() => setBookingOpen(false)}
          initialClinicId={clinic.id}
          initialClinicName={clinic.name}
        />
      )}
    </div>
  );
}
