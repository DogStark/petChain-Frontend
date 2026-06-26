import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { GetServerSideProps } from "next";
import HeaderComponent from "@/components/Header";
import ClinicCard from "@/components/Clinics/ClinicCard";
import { Search, Filter, Star, Loader2 } from "lucide-react";
import { Clinic } from "@/types/clinic";
import { clinicsAPI } from "@/lib/api/clinicsAPI";

export default function ClinicDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clinicsAPI.getClinics();
      setClinics(data);
    } catch {
      setError("Failed to load clinics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const filteredClinics = clinics.filter((clinic) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      clinic.name.toLowerCase().includes(term) ||
      clinic.locations.some((loc) => loc.city.toLowerCase().includes(term)) ||
      clinic.services.some((service) =>
        service.name.toLowerCase().includes(term),
      )
    );
  });

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
                Displaying {filteredClinics.length} clinics
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

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-10 h-10 animate-spin mb-3" />
                <p>Loading clinics...</p>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={loadClinics}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : filteredClinics.length === 0 ? (
              <p className="text-center text-gray-500 py-16">
                No clinics found. Try adjusting your search or check back later.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredClinics.map((clinic) => (
                  <ClinicCard key={clinic.id} clinic={clinic} />
                ))}
              </div>
            )}
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

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
