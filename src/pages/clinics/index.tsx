import React, { useState } from "react";
import Head from "next/head";
import HeaderComponent from "@/components/Header";
import ClinicCard from "@/components/Clinics/ClinicCard";
import { Search, Filter, Star } from "lucide-react";
import { Clinic } from "@/types/clinic";

const MOCK_CLINICS: Clinic[] = [
  {
    id: "1",
    name: "Pawfect Health Center",
    description: "Premier veterinary clinic offering full medical services.",
    rating: 4.8,
    reviewCount: 156,
    locations: [
      {
        id: "1-1",
        name: "Main Branch",
        city: "London",
        address: "123 Pet Lane",
        phone: "020 1234 5678",
        email: "main@pawfect.com",
      },
      {
        id: "1-2",
        name: "West End",
        city: "London",
        address: "45 Bark Street",
        phone: "020 8765 4321",
        email: "west@pawfect.com",
      },
    ],
    services: [
      {
        id: "s1",
        name: "General Checkup",
        description: "Routine health assessment",
        priceRange: "£50-£80",
      },
      {
        id: "s2",
        name: "Vaccination",
        description: "Preventative shots",
        priceRange: "£30-£60",
      },
      {
        id: "s3",
        name: "Emergency",
        description: "Urgent medical care",
        priceRange: "£150+",
      },
      {
        id: "s4",
        name: "Surgery",
        description: "Complex procedures",
        priceRange: "£500+",
      },
    ],
    hours: [],
    staff: [],
    mainImage:
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "2",
    name: "The Cat & Dog Clinic",
    description:
      "Affordable and caring veterinary services for your furry friends.",
    rating: 4.5,
    reviewCount: 89,
    locations: [
      {
        id: "2-1",
        name: "London Central",
        city: "London",
        address: "10 Meow Road",
        phone: "020 2222 3333",
        email: "info@catdogclinic.com",
      },
    ],
    services: [
      {
        id: "s1",
        name: "General Checkup",
        description: "Routine health assessment",
        priceRange: "£40-£60",
      },
      {
        id: "s5",
        name: "Dental Care",
        description: "Teeth cleaning and treatment",
        priceRange: "£80-£150",
      },
      {
        id: "s6",
        name: "Microchipping",
        description: "Secure pet ID",
        priceRange: "£20-£40",
      },
    ],
    hours: [],
    staff: [],
    mainImage:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "3",
    name: "VetOne Specialists",
    description: "Expert specialist care for complex pet medical needs.",
    rating: 4.9,
    reviewCount: 210,
    locations: [
      {
        id: "3-1",
        name: "Specialist Hub",
        city: "London",
        address: "50 Expert Way",
        phone: "020 5555 6666",
        email: "vets@vetone.com",
      },
    ],
    services: [
      {
        id: "s4",
        name: "Surgery",
        description: "Complex procedures",
        priceRange: "£800+",
      },
      {
        id: "s7",
        name: "Imaging",
        description: "X-rays and Scans",
        priceRange: "£200-£500",
      },
      {
        id: "s8",
        name: "Oncology",
        description: "Cancer treatment",
        priceRange: "£1000+",
      },
    ],
    hours: [],
    staff: [],
    mainImage:
      "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=800",
  },
];

export default function ClinicDirectory() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>Clinics | PetChain</title>
        <meta
          name="description"
          content="Find the best veterinary clinics for your pet."
        />
      </Head>

      <HeaderComponent />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold text-blue-900 mb-4 tracking-tight">
            Find Your Pet&apos;s Next Doctor
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Expert care for every pet. Search through hundreds of verified
            clinics and specialists.
          </p>

          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search by clinic name, city, or service..."
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-xl border-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-800 placeholder-gray-400 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              Search
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 mb-12">
          {/* Filters Sidebar */}
          <aside className="w-full md:w-64 space-y-6">
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/40 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-blue-900 mb-6 uppercase tracking-wider text-xs">
                <Filter className="w-4 h-4" /> Filters
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3">
                    Service Type
                  </h4>
                  <div className="space-y-2">
                    {["General", "Emergency", "Surgery", "Dental"].map(
                      (service) => (
                        <label
                          key={service}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600 group-hover:text-blue-600 transition-colors">
                            {service}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3">
                    Rating
                  </h4>
                  <div className="space-y-2">
                    {[4, 3, 2].map((star) => (
                      <label
                        key={star}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 flex items-center gap-1 group-hover:text-blue-600">
                          {star}+{" "}
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-3xl text-white shadow-xl">
              <h4 className="font-bold mb-2">Need Help?</h4>
              <p className="text-xs text-pink-50 leading-relaxed mb-4">
                Not sure which clinic to choose? Use our AI matching tool to
                find the best fit for your pet&apos;s needs.
              </p>
              <button className="w-full py-2 bg-white text-pink-600 text-sm font-bold rounded-xl hover:bg-pink-50 transition-colors shadow-lg">
                Start AI Match
              </button>
            </div>
          </aside>

          {/* Clinics Grid */}
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-500 font-medium">
                Displaying {MOCK_CLINICS.length} clinics
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <select className="bg-transparent font-bold text-blue-800 text-sm focus:outline-none cursor-pointer">
                  <option>Top Rated</option>
                  <option>Distance</option>
                  <option>Price</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {MOCK_CLINICS.map((clinic) => (
                <ClinicCard key={clinic.id} clinic={clinic} />
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-gray-500 py-12 bg-white/40 border-t border-white/60">
        <span>
          © 2024 PetChain Clinic Directory. Premium Care for Every Pet.
        </span>
      </footer>
    </div>
  );
}
