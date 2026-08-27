import Head from 'next/head';
import Link from 'next/link';

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col">
      <Head>
        <title>About PetChain</title>
        <meta name="description" content="Learn more about PetChain, our mission, team, and technology." />
      </Head>
      
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-blue-700 mb-4 drop-shadow-sm">
          About PetChain
        </h1>
        <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mb-6">
          Our mission is to provide secure, decentralized, and vet-ready health tracking for every pet, empowering owners with control and privacy.
        </p>
      </section>

      {/* Team Section */}
      <section className="py-12 px-4 bg-white/60 rounded-3xl shadow-lg mx-2 md:mx-16 mb-8">
        <h2 className="text-3xl font-bold text-center text-blue-700 mb-8">Our Team</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <div className="w-24 h-24 bg-blue-200 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">👩‍💻</div>
            <h3 className="text-xl font-bold text-gray-800">Alex Johnson</h3>
            <p className="text-blue-600">Lead Developer</p>
          </div>
          <div className="p-6">
            <div className="w-24 h-24 bg-green-200 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">👨‍🎨</div>
            <h3 className="text-xl font-bold text-gray-800">Sam Rivera</h3>
            <p className="text-blue-600">UX/UI Designer</p>
          </div>
          <div className="p-6">
            <div className="w-24 h-24 bg-pink-200 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">🐾</div>
            <h3 className="text-xl font-bold text-gray-800">Jordan Lee</h3>
            <p className="text-blue-600">Product Manager</p>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-12 px-4 flex flex-col items-center bg-gradient-to-r from-blue-50 via-pink-50 to-green-50 rounded-3xl mx-2 md:mx-16 mb-8 shadow-lg">
        <h2 className="text-3xl font-bold text-blue-700 mb-8">Technology Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center w-full max-w-4xl">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-3xl block mb-2">⚛️</span>
            <p className="font-semibold text-gray-800">React & Next.js</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-3xl block mb-2">🎨</span>
            <p className="font-semibold text-gray-800">Tailwind CSS</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-3xl block mb-2">⛓️</span>
            <p className="font-semibold text-gray-800">Stellar Blockchain</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-3xl block mb-2">🛡️</span>
            <p className="font-semibold text-gray-800">Zero-Knowledge Proofs</p>
          </div>
        </div>
      </section>

      {/* Info & Links */}
      <section className="py-12 px-4 bg-white/60 rounded-3xl shadow-lg mx-2 md:mx-16 mb-8 text-center">
        <h2 className="text-3xl font-bold text-blue-700 mb-8">More Information</h2>
        <div className="flex flex-col md:flex-row justify-center items-start gap-12 text-lg text-gray-700">
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Build & Version</h3>
            <p>Version: 0.1.0-beta</p>
            <p className="text-sm text-gray-500 mt-1">Build: #20260529</p>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Links</h3>
            <p><a href="https://github.com/DogStark/petChain-Frontend" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub Repository</a></p>
            <p><Link href="/docs" className="text-blue-600 hover:underline">Documentation</Link></p>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Contact</h3>
            <p><a href="mailto:hello@petchain.local" className="text-blue-600 hover:underline">hello@petchain.local</a></p>
            <p className="text-sm text-gray-500 mt-1">Response time: ~24 hours</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-500 py-6 mt-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <Link href="/" className="hover:text-blue-600">← Back to Home</Link>
          <span>© 2024 PetChain. MIT License.</span>
        </div>
      </footer>
    </div>
  );
}
