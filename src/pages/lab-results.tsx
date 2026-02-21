import React from "react";
import Head from "next/head";
import HeaderComponent from "@/components/Header";
import ResultsDashboard from "@/components/LabResults/ResultsDashboard";

export default function LabResultsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col font-sans text-gray-900">
      <Head>
        <title>Lab Results | PetChain</title>
        <meta
          name="description"
          content="Manage and view your pet's lab results securely."
        />
      </Head>

      <HeaderComponent />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Lab Results</h1>
            <p className="text-gray-600 mt-2">
              Upload, view, and track your pet&apos;s medical test results
              securely.
            </p>
          </div>
          {/* Action Buttons */}
        </div>

        <ResultsDashboard />
      </main>

      {/* Footer */}
      <footer className="text-center text-gray-500 py-6 mt-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <span>© 2024 PetChain. MIT License.</span>
        </div>
      </footer>
    </div>
  );
}
