import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { GetStaticProps, GetStaticPaths } from "next";
import HeaderComponent from "@/components/Header";
import StaffList from "@/components/Clinics/StaffList";
import ServiceList from "@/components/Clinics/ServiceList";
import ReviewSection from "@/components/Clinics/ReviewSection";
import LocationMap from "@/components/Clinics/LocationMap";
import {
  Star,
  MapPin,
  Clock,
  Calendar,
  ShieldCheck,
  Heart,
  Award,
  Share2,
  Loader2,
} from "lucide-react";
import { Clinic } from "@/types/clinic";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
import { isAxiosError } from "axios";

export default function ClinicProfile() {
  const router = useRouter();
  const clinicId = typeof router.query.id === "string" ? router.query.id : "";

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "services" | "staff" | "locations" | "reviews"
  >("services");

  const loadClinic = useCallback(async () => {
    if (!clinicId) return;

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await clinicsAPI.getClinicById(clinicId);
      setClinic(data);
    } catch (err) {
      setClinic(null);
      if (isAxiosError(err) && err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError("Failed to load clinic details.");
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (router.isReady && clinicId) {
      loadClinic();
    }
  }, [router.isReady, clinicId, loadClinic]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const tabs: {
    id: "services" | "staff" | "locations" | "reviews";
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "services", label: "Our Services", icon: ShieldCheck },
    { id: "staff", label: "Meet the Team", icon: Heart },
    { id: "locations", label: "Our Locations", icon: MapPin },
    { id: "reviews", label: "Client Feedback", icon: Award },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
        <Head>
          <title>Clinic | PetChain</title>
        </Head>
        <HeaderComponent />
        <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mb-3" />
          <p>Loading clinic details...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
        <Head>
          <title>Clinic Not Found | PetChain</title>
        </Head>
        <HeaderComponent />
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl font-bold text-blue-900 mb-2">
            Clinic not found
          </h1>
          <p className="text-gray-600 mb-6">
            We could not find a clinic with that ID. It may have been removed or
            the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
        <Head>
          <title>Clinic | PetChain</title>
        </Head>
        <HeaderComponent />
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4">
          <p className="text-red-600 mb-4">{error || "Something went wrong."}</p>
          <button
            onClick={loadClinic}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const emergencyPhone = clinic.locations[0]?.phone || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>{clinic.name} | PetChain</title>
      </Head>

      <HeaderComponent />

      {/* Hero Header */}
      <section className="relative h-[450px] overflow-hidden">
        {clinic.mainImage ? (
          <img
            src={clinic.mainImage}
            className="w-full h-full object-cover"
            alt={clinic.name}
          />
        ) : (
          <div className="w-full h-full bg-blue-200 flex items-center justify-center">
            <MapPin className="w-16 h-16 text-blue-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/40 to-transparent"></div>

        <div className="absolute bottom-0 inset--0">
          <div className="container mx-auto px-4 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="max-w-3xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-blue-600 p-3 rounded-2xl shadow-xl border border-blue-400">
                    <Heart className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white text-xs font-bold">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    {clinic.rating} Rating • {clinic.reviewCount} Reviews
                  </div>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
                  {clinic.name}
                </h1>
                <p className="text-blue-100 text-lg md:text-xl font-medium max-w-2xl leading-relaxed drop-shadow-md">
                  {clinic.description}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button className="px-8 py-4 bg-white text-blue-900 font-black rounded-2xl shadow-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]">
                  <Calendar className="w-5 h-5 text-blue-600" /> Book an
                  Appointment
                </button>
                <button className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all flex items-center justify-center gap-3">
                  <Share2 className="w-5 h-5" /> Share Clinic
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Info */}
      <main className="container mx-auto px-4 py-8 max-w-7xl -mt-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* Tabs Navigation */}
            <nav className="flex flex-wrap gap-2 p-1 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/40 shadow-sm overflow--auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-500 hover:text-blue-600"
                  }`}
                >
                  <tab.icon
                    className={`w-4 h-4 ${activeTab === tab.id ? "text-white" : "text-gray-400"}`}
                  />
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Tab Panes */}
            <div className="min-h-[400px] animate-fade-in">
              {activeTab === "services" && (
                <ServiceList services={clinic.services} />
              )}
              {activeTab === "staff" && <StaffList staff={clinic.staff} />}
              {activeTab === "locations" && (
                <LocationMap locations={clinic.locations} />
              )}
              {activeTab === "reviews" && (
                <ReviewSection
                  reviews={clinic.reviews || []}
                  averageRating={clinic.rating}
                />
              )}
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6">
            {/* Operating Hours Card */}
            <section className="bg-white rounded-[2rem] p-8 shadow-2xl border border-blue-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-black text-blue-900">
                    Operating Hours
                  </h3>
                </div>

                <div className="space-y-3">
                  {clinic.hours.map((h) => (
                    <div
                      key={h.day}
                      className={`flex items-center justify-between text-sm ${h.day === today ? "bg-blue-50 -mx-4 px-4 py-2 rounded-xl font-bold text-blue-600" : "text-gray-500 font-medium"}`}
                    >
                      <span>{h.day}</span>
                      <span>
                        {h.isClosed ? "Closed" : `${h.open} - ${h.close}`}
                      </span>
                    </div>
                  ))}
                </div>

                {emergencyPhone && (
                  <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 mb-1">
                      Emergency Line (24/7)
                    </p>
                    <a
                      href={`tel:${emergencyPhone.replace(/\s/g, "")}`}
                      className="text-2xl font-black text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      {emergencyPhone}
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* Newsletter/Action Card */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <Award className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
              <h3 className="text-xl font-black mb-4 relative">
                Partner with Us
              </h3>
              <p className="text-blue-100 text-sm mb-6 leading-relaxed relative">
                Are you a vet clinic looking to join the PetChain network of
                premium healthcare providers?
              </p>
              <button className="w-full py-3 bg-white text-blue-600 font-black rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95 relative">
                Request Partnership
              </button>
            </section>
          </div>
        </div>
      </main>

      <footer className="mt-20 py-12 bg-white border-t border-gray-100 text-center">
        <p className="text-gray-400 font-medium">
          © 2024 PetChain Healthcare Directory. Trusted by pets and humans
          alike.
        </p>
      </footer>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: false,
  };
};
