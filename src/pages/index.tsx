import Image from 'next/image';
import { useState } from 'react';

const FEATURES = [
  {
    title: 'Scannable Pet Tags',
    desc: 'Unique QR code tags for each pet, instantly scannable by vets or responders. Displays key info and a custom message.',
    icon: '🐾',
    details: 'Each pet receives a unique QR code tag that links directly to their medical history. Vets and emergency responders can scan the tag to instantly access vital information, including allergies, medications, and a custom message from the owner. The tag can also act as a tracker if your pet goes missing.'
  },
  {
    title: 'Always-Available Records',
    desc: 'Medical history stored on Stellar—tamper-proof, permanent, and accessible anytime.',
    icon: '🔗',
    details: 'All medical records are securely stored on Stellar, ensuring they are tamper-proof and always accessible. No more lost or scattered records—access your pet’s health history from anywhere, at any time.'
  },
  {
    title: 'Controlled Access',
    desc: 'Owners control who sees what. Share vaccination status or give full access to a vet.',
    icon: '🔒',
    details: 'You decide who can view your pet’s records. Share only vaccination status publicly, or grant full access to a trusted vet. Your pet’s privacy and safety are always in your hands.'
  },
  {
    title: 'Smart Notifications',
    desc: 'Automatic alerts for vaccinations and check-ups. Never miss a date.',
    icon: '📅',
    details: 'Receive timely reminders for upcoming vaccinations, check-ups, and treatments. Stay on top of your pet’s health schedule with smart, automated notifications.'
  },
  {
    title: 'Vet-Ready Integration',
    desc: 'Easily plugs into existing vet or hospital software.',
    icon: '💻',
    details: 'PetChain is designed to integrate seamlessly with veterinary and hospital management systems, making it easy for professionals to access and update records with minimal friction.'
  },
  {
    title: 'Offline Mode & Privacy',
    desc: 'View essential info offline. Advanced cryptography keeps data secure—even on-chain.',
    icon: '🛡️',
    details: 'Access critical information even without an internet connection. Advanced cryptography, including zero-knowledge proofs, ensures your pet’s sensitive data remains private and secure—even on the blockchain.'
  },
];

export default function Home() {
  const [modal, setModal] = useState<{ open: boolean; feature?: typeof FEATURES[0] }>({ open: false });

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-6">
          <Image src="/PETCHAIN.jpeg" alt="PetChain Logo" width={120} height={120} className="rounded-2xl shadow-lg" />
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-blue-700 mb-4 drop-shadow-sm">PetChain</h1>
        <div className="text-xl md:text-2xl text-gray-700 max-w-2xl mb-6">
          Smart, secure, and always-available health tracking for your pet. <br />
          <div className="relative w-full overflow-x-hidden mt-4">
            <div className="animate-marquee whitespace-nowrap">
              <span className="inline-block bg-gradient-to-r from-blue-400 via-pink-400 to-green-400 bg-clip-text text-transparent font-bold px-6 py-2 rounded-full shadow-md text-2xl md:text-3xl">
                Decentralized, Private & Vet-Ready. &nbsp; Decentralized, Private & Vet-Ready. &nbsp; Decentralized, Private & Vet-Ready.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 px-4 bg-white/60 rounded-3xl shadow-lg mx-2 md:mx-16 mb-8">
        <h2 className="text-3xl font-bold text-center text-blue-700 mb-8">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              desc={feature.desc}
              icon={feature.icon}
              onClick={() => setModal({ open: true, feature })}
            />
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 px-4 flex flex-col items-center bg-gradient-to-r from-blue-50 via-pink-50 to-green-50 rounded-3xl mx-2 md:mx-16 mb-8">
        <h2 className="text-3xl font-bold text-blue-700 mb-8">How It Works</h2>
        <ol className="space-y-4 max-w-2xl text-lg text-gray-700">
          <li className="flex items-start"><span className="mr-3 text-2xl">1.</span> Register your pet and receive a unique QR tag.</li>
          <li className="flex items-start"><span className="mr-3 text-2xl">2.</span> Scan the tag to access or update medical records—anytime, anywhere.</li>
          <li className="flex items-start"><span className="mr-3 text-2xl">3.</span> Control access and get smart reminders for your pet’s health needs.</li>
        </ol>
      </section>

      {/* Tech & Security Section */}
      <section className="py-12 px-4 bg-white/60 rounded-3xl shadow-lg mx-2 md:mx-16 mb-8">
        <h2 className="text-3xl font-bold text-center text-blue-700 mb-8">Tech & Security</h2>
        <div className="flex flex-col md:flex-row justify-center items-center gap-8">
          <div className="flex-1 text-center">
            <h3 className="text-xl font-semibold mb-2">Powered by Stellar</h3>
            <p className="text-gray-700">Blockchain ensures records are tamper-proof, permanent, and universally accessible.</p>
          </div>
          <div className="flex-1 text-center">
            <h3 className="text-xl font-semibold mb-2">Advanced Privacy</h3>
            <p className="text-gray-700">Zero-knowledge proofs and encryption keep your pet’s data private—even on-chain.</p>
          </div>
          <div className="flex-1 text-center">
            <h3 className="text-xl font-semibold mb-2">Seamless Integration</h3>
            <p className="text-gray-700">Works with vet/hospital software and supports offline access for emergencies.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-500 py-6 mt-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <span>© 2024 PetChain. MIT License.</span>
        </div>
      </footer>

      {/* Feature Modal */}
      {modal.open && modal.feature && (
        <Modal onClose={() => setModal({ open: false })}>
          <div className="p-6 max-w-md mx-auto">
            <div className="flex items-center mb-4">
              <span className="text-4xl mr-3">{modal.feature.icon}</span>
              <h3 className="text-2xl font-bold text-blue-700">{modal.feature.title}</h3>
            </div>
            <p className="text-gray-700 text-lg mb-4">{modal.feature.details}</p>
            <button
              className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-all"
              onClick={() => setModal({ open: false })}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FeatureCard({ title, desc, icon, onClick }: { title: string; desc: string; icon: string; onClick: () => void }) {
  return (
    <button
      className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center text-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-300
        hover:scale-105 hover:shadow-2xl hover:bg-blue-50 group"
      onClick={onClick}
      type="button"
    >
      <div className="text-4xl mb-3 transition-transform group-hover:scale-125 group-hover:-rotate-6">{icon}</div>
      <h3 className="text-xl font-semibold text-blue-700 mb-2 group-hover:text-blue-900 transition-colors">{title}</h3>
      <p className="text-gray-600 transition-colors group-hover:text-blue-700">{desc}</p>
      {/* Optional: Extra info or icon animation on hover */}
      <span className="mt-2 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Click for more info</span>
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-0 relative animate-fade-in">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}