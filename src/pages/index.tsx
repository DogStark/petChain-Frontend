import Image from 'next/image';
import { useState } from 'react';

const FEATURES = [
  {
    title: 'Scannable Pet Tags',
    desc: 'Unique QR code tags for each pet, instantly scannable by vets or responders. Displays key info and a custom message.',
    icon: '🐾',
    details:
      'Each pet receives a unique QR code tag that links directly to their medical history. Vets and emergency responders can scan the tag to instantly access vital information, including allergies, medications, and a custom message from the owner. The tag can also act as a tracker if your pet goes missing.',
  },
  {
    title: 'Always-Available Records',
    desc: 'Medical history stored on Stellar—tamper-proof, permanent, and accessible anytime.',
    icon: '🔗',
    details:
      "All medical records are securely stored on Stellar, ensuring they are tamper-proof and always accessible. No more lost or scattered records—access your pet's health history from anywhere, at any time.",
  },
  {
    title: 'Controlled Access',
    desc: 'Owners control who sees what. Share vaccination status or give full access to a vet.',
    icon: '🔒',
    details:
      "You decide who can view your pet's records. Share only vaccination status publicly, or grant full access to a trusted vet. Your pet's privacy and safety are always in your hands.",
  },
  {
    title: 'Smart Notifications',
    desc: 'Automatic alerts for vaccinations and check-ups. Never miss a date.',
    icon: '📅',
    details:
      "Receive timely reminders for upcoming vaccinations, check-ups, and treatments. Stay on top of your pet's health schedule with smart, automated notifications.",
  },
  {
    title: 'Vet-Ready Integration',
    desc: 'Easily plugs into existing vet or hospital software.',
    icon: '💻',
    details:
      'PetChain is designed to integrate seamlessly with veterinary and hospital management systems, making it easy for professionals to access and update records with minimal friction.',
  },
  {
    title: 'Offline Mode & Privacy',
    desc: 'View essential info offline. Advanced cryptography keeps data secure—even on-chain.',
    icon: '🛡️',
    details:
      "Access critical information even without an internet connection. Advanced cryptography, including zero-knowledge proofs, ensures your pet's sensitive data remains private and secure—even on the blockchain.",
  },
];

export default function Home() {
  const [modal, setModal] = useState<{ open: boolean; feature?: (typeof FEATURES)[0] }>({
    open: false,
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/PETCHAIN.jpeg"
              alt="PetChain"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold text-gray-900">PetChain</span>
          </div>
          <div className="flex gap-6">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition">
              How It Works
            </a>
            <a
              href="https://github.com/DogStark/petChain-Frontend"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-6">
                Powered by Stellar Blockchain
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Your Pet&apos;s Medical Records,
                <span className="text-blue-600"> Always Accessible</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Secure, decentralized health tracking for pets. Scan a QR tag for instant access to
                medical history—anytime, anywhere.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://github.com/DogStark/petChain-Frontend"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg"
                >
                  Get Started
                </a>
                <a
                  href="#features"
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition"
                >
                  Learn More
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl p-8 shadow-2xl">
                <Image
                  src="/PETCHAIN.jpeg"
                  alt="PetChain Platform"
                  width={500}
                  height={500}
                  className="rounded-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-600">
              Built for pet owners, vets, and emergency responders
            </p>
          </div>
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
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">
              Three simple steps to secure your pet&apos;s health data
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Register Your Pet</h3>
              <p className="text-gray-600">
                Create a profile and receive a unique QR tag linked to their medical records
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Scan & Access</h3>
              <p className="text-gray-600">
                Vets and responders scan the tag to instantly view medical history
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Stay Updated</h3>
              <p className="text-gray-600">
                Get smart reminders and control who accesses your pet&apos;s information
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Built with Modern Technology</h2>
            <p className="text-xl text-gray-600">Secure, scalable, and privacy-focused</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md">
              <h3 className="text-2xl font-bold mb-3">Stellar Blockchain</h3>
              <p className="text-gray-600">
                Tamper-proof records that are permanent and universally accessible
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-md">
              <h3 className="text-2xl font-bold mb-3">Zero-Knowledge Proofs</h3>
              <p className="text-gray-600">
                Advanced cryptography keeps sensitive data private—even on-chain
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-md">
              <h3 className="text-2xl font-bold mb-3">Offline Access</h3>
              <p className="text-gray-600">
                View critical information even without an internet connection
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Secure Your Pet&apos;s Health Data?
          </h2>
          <p className="text-xl text-blue-100 mb-8">Join the decentralized pet health revolution</p>
          <div className="flex gap-4 justify-center">
            <a
              href="https://github.com/DogStark/petChain-Frontend"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition shadow-lg"
            >
              View on GitHub
            </a>
            <a
              href="https://t.me/+Jw8HkvUhinw2YjE0"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border-2 border-white text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Join Community
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/PETCHAIN.jpeg"
                  alt="PetChain"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-white font-bold text-xl">PetChain</span>
              </div>
              <p className="text-sm">Decentralized pet health records on Stellar</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="hover:text-white transition">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Developers</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://github.com/DogStark/petChain-Frontend"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                  >
                    Frontend
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/DogStark/petchain_api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                  >
                    Backend
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/DogStark/PetMedTracka-Contracts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                  >
                    Smart Contracts
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://t.me/+Jw8HkvUhinw2YjE0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                  >
                    Telegram
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/DogStark/pet-medical-tracka/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                  >
                    Report Issues
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2024 PetChain. MIT License.</p>
          </div>
        </div>
      </footer>

      {/* Feature Modal */}
      {modal.open && modal.feature && (
        <Modal onClose={() => setModal({ open: false })}>
          <div className="p-8 max-w-lg">
            <div className="flex items-center mb-4">
              <span className="text-5xl mr-4">{modal.feature.icon}</span>
              <h3 className="text-3xl font-bold text-gray-900">{modal.feature.title}</h3>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">{modal.feature.details}</p>
            <button
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
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

function FeatureCard({
  title,
  desc,
  icon,
  onClick,
}: {
  title: string;
  desc: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      className="bg-white rounded-2xl shadow-md p-8 text-left transition-all hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={onClick}
      type="button"
    >
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 mb-4">{desc}</p>
      <span className="text-blue-600 text-sm font-semibold">Learn more →</span>
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl relative max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-bold focus:outline-none"
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
