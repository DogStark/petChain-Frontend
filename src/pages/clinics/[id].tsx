import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
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
} from "lucide-react";
import { Clinic } from "@/types/clinic";

// Full Mock Data for the Profile
const MOCK_CLINIC_DETAILS: Clinic = {
  id: "1",
  name: "Pawfect Health Center",
  description:
    "Welcome to Pawfect Health Center, where your pet's well-being is our top priority. Established in 2010, our center leverages state-of-the-art diagnostic technology combined with a deep passion for animal healthcare. Our team of board-certified specialists and caring staff are dedicated to providing comprehensive, compassionate care for pets of all kinds.",
  rating: 4.8,
  reviewCount: 156,
  mainImage:
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=1200",
  locations: [
    {
      id: "1-1",
      name: "Main Branch",
      city: "London",
      address: "123 Pet Lane, Camden",
      phone: "020 1234 5678",
      email: "main@pawfect.com",
    },
    {
      id: "1-2",
      name: "West End Annex",
      city: "London",
      address: "45 Bark Street, Soho",
      phone: "020 8765 4321",
      email: "west@pawfect.com",
    },
    {
      id: "1-3",
      name: "Greenwich Point",
      city: "London",
      address: "88 River Way",
      phone: "020 9999 8888",
      email: "green@pawfect.com",
    },
  ],
  services: [
    {
      id: "s1",
      name: "Consultation",
      description:
        "Comprehensive physical examination and medical history review.",
      priceRange: "£55.00",
    },
    {
      id: "s2",
      name: "Core Vaccinations",
      description:
        "Protection against common infectious diseases tailored to your pet.",
      priceRange: "£45.00",
    },
    {
      id: "s3",
      name: "Professional Dental",
      description:
        "Ultrasonic scaling, polishing, and oral assessment under sedation.",
      priceRange: "£220.00",
    },
    {
      id: "s4",
      name: "Wellness Profile",
      description:
        "Advanced blood panel, urinalysis, and early detection screening.",
      priceRange: "£110.00",
    },
    {
      id: "s5",
      name: "Microchipping",
      description:
        "Permanent identification for your pet with international registration.",
      priceRange: "£25.00",
    },
  ],
  hours: [
    { day: "Monday", open: "08:30", close: "19:00", isClosed: false },
    { day: "Tuesday", open: "08:30", close: "19:00", isClosed: false },
    { day: "Wednesday", open: "08:30", close: "19:00", isClosed: false },
    { day: "Thursday", open: "08:30", close: "19:00", isClosed: false },
    { day: "Friday", open: "08:30", close: "19:00", isClosed: false },
    { day: "Saturday", open: "09:00", close: "17:00", isClosed: false },
    { day: "Sunday", open: "10:00", close: "14:00", isClosed: false },
  ],
  staff: [
    {
      id: "st1",
      name: "Dr. Sarah Miller",
      role: "Head Veterinarian",
      specialty: ["Surgery", "Oncology"],
      clinicId: "1",
      avatar:
        "https://images.unsplash.com/photo-1559839734-2b71f1536783?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
    },
    {
      id: "st2",
      name: "Dr. James Wilson",
      role: "Senior Vet",
      specialty: ["Dental", "Nutrition"],
      clinicId: "1",
      avatar:
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
    },
    {
      id: "st3",
      name: "Emma Watson",
      role: "Vet Nurse",
      specialty: ["Emergency Care"],
      clinicId: "1",
    },
  ],
  reviews: [
    {
      id: "r1",
      userId: "u1",
      userName: "John Doe",
      rating: 5,
      comment:
        "Dr. Miller saved our dog after a complex surgery. Incredible care and empathy throughout.",
      date: "2023-11-01",
    },
    {
      id: "r2",
      userId: "u2",
      userName: "Alice Smith",
      rating: 4,
      comment:
        "Great clinic, bit of a wait sometimes but the quality of care is worth it.",
      date: "2023-11-15",
    },
    {
      id: "r3",
      userId: "u3",
      userName: "Mark Ruffalo",
      rating: 5,
      comment:
        "My cat is actually happy to go there! Modern equipment and very clean environment.",
      date: "2023-11-20",
    },
  ],
};

export default function ClinicProfile() {
  const [activeTab, setActiveTab] = useState<
    "services" | "staff" | "locations" | "reviews"
  >("services");

  // Logic to get current day status
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>{MOCK_CLINIC_DETAILS.name} | PetChain</title>
      </Head>

      <HeaderComponent />

      {/* Hero Header */}
      <section className="relative h-[450px] overflow-hidden">
        <img
          src={MOCK_CLINIC_DETAILS.mainImage}
          className="w-full h-full object-cover"
          alt={MOCK_CLINIC_DETAILS.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/40 to-transparent"></div>

        <div className="absolute bottom-0 inset-x-0">
          <div className="container mx-auto px-4 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="max-w-3xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-blue-600 p-3 rounded-2xl shadow-xl border border-blue-400">
                    <Heart className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white text-xs font-bold">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    {MOCK_CLINIC_DETAILS.rating} Rating •{" "}
                    {MOCK_CLINIC_DETAILS.reviewCount} Reviews
                  </div>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
                  {MOCK_CLINIC_DETAILS.name}
                </h1>
                <p className="text-blue-100 text-lg md:text-xl font-medium max-w-2xl leading-relaxed drop-shadow-md">
                  {MOCK_CLINIC_DETAILS.description}
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
            <nav className="flex flex-wrap gap-2 p-1 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/40 shadow-sm overflow-x-auto">
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
                <ServiceList services={MOCK_CLINIC_DETAILS.services} />
              )}
              {activeTab === "staff" && (
                <StaffList staff={MOCK_CLINIC_DETAILS.staff} />
              )}
              {activeTab === "locations" && (
                <LocationMap locations={MOCK_CLINIC_DETAILS.locations} />
              )}
              {activeTab === "reviews" && (
                <ReviewSection
                  reviews={MOCK_CLINIC_DETAILS.reviews || []}
                  averageRating={MOCK_CLINIC_DETAILS.rating}
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
                  {MOCK_CLINIC_DETAILS.hours.map((h) => (
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

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400 mb-1">
                    Emergency Line (24/7)
                  </p>
                  <a
                    href="tel:02012345678"
                    className="text-2xl font-black text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    020 1234 5678
                  </a>
                </div>
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
