import { useState } from 'react';

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.subject) newErrors.subject = 'Please select a subject';
    if (!formData.message.trim()) newErrors.message = 'Message is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;
    try {
      console.log('Form submitted:', formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setErrors({});
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      setSubmitError('Something went wrong. Please try again later.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const faqItems = [
    { q: 'How do I connect my Freighter wallet?', a: 'Install the Freighter browser extension, create or import a wallet, then click &quot;Connect Wallet&quot; on our homepage and approve the connection.' },
    { q: 'What networks does Wata-Board support?', a: 'Wata-Board supports the Stellar network on both public mainnet and testnet for testing purposes.' },
    { q: 'How long do transactions take?', a: 'Stellar transactions typically complete within 3-5 seconds, making it ideal for fast utility payments.' },
    { q: 'Is there any fee for using the service?', a: 'Only minimal Stellar network fees (in XLM) are charged. Fee estimates are shown before confirming transactions.' },
    { q: 'Can I schedule recurring payments?', a: 'Yes! Use the &quot;Scheduled Payments&quot; feature to set up automatic recurring payments. Manage or cancel anytime from the Schedules page.' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/20">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight mb-6">Contact Us</h1>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-6">
                <p className="text-slate-300 text-responsive leading-relaxed">
                  Have questions or feedback? We'd love to hear from you. Fill out the form
                  and our team will get back to you as soon as possible.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <a href="mailto:support@wata-board.com" className="text-sm sm:text-base hover:text-sky-400 transition-colors">support@wata-board.com</a>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base">Blockchain City, Stellar Network</span>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Connect With Us</h3>
                <div className="flex gap-3">
                  <a href="https://t.me/wataboard" target="_blank" rel="noopener noreferrer"
                    className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-800/50 flex items-center justify-center text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/50 transition-all"
                    title="Telegram">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </a>
                  <a href="https://github.com/wataboard" target="_blank" rel="noopener noreferrer"
                    className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-800/50 flex items-center justify-center text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/50 transition-all"
                    title="GitHub">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                  </a>
                  <a href="https://twitter.com/wataboard" target="_blank" rel="noopener noreferrer"
                    className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-800/50 flex items-center justify-center text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/50 transition-all"
                    title="Twitter / X">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* FAQ Section */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Frequently Asked Questions</h3>
                <div className="space-y-2">
                  {faqItems.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left text-slate-200 hover:bg-slate-800/50 transition-colors"
                      >
                        <span className="font-medium pr-4">{item.q}</span>
                        <svg className={"w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 " + (openFaq === idx ? 'rotate-180' : '')}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openFaq === idx && (
                        <div className="px-4 pb-3 text-xs sm:text-sm text-slate-400 leading-relaxed animate-fade-in-up">
                          {item.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right column: Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Name</label>
                <input
                  type="text" name="name" value={formData.name} onChange={handleChange}
                  className={"w-full h-12 rounded-xl border px-4 text-sm text-slate-100 outline-none ring-sky-500/30 placeholder:text-slate-500 focus:ring-4 focus:ring-sky-500/20 transition-all bg-slate-950/50 " + (errors.name ? 'border-red-500' : 'border-slate-800')}
                  placeholder="Your name"
                />
                {errors.name && <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
                <input
                  type="email" name="email" value={formData.email} onChange={handleChange}
                  className={"w-full h-12 rounded-xl border px-4 text-sm text-slate-100 outline-none ring-sky-500/30 placeholder:text-slate-500 focus:ring-4 focus:ring-sky-500/20 transition-all bg-slate-950/50 " + (errors.email ? 'border-red-500' : 'border-slate-800')}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Subject</label>
                <select
                  name="subject" value={formData.subject} onChange={handleChange}
                  className={"w-full h-12 rounded-xl border px-4 text-sm text-slate-100 outline-none ring-sky-500/30 focus:ring-4 focus:ring-sky-500/20 transition-all bg-slate-950/50 " + (errors.subject ? 'border-red-500' : 'border-slate-800')}
                >
                  <option value="" className="bg-slate-950">Select a subject</option>
                  <option value="general" className="bg-slate-950">General Inquiry</option>
                  <option value="support" className="bg-slate-950">Technical Support</option>
                  <option value="billing" className="bg-slate-950">Billing Question</option>
                  <option value="feedback" className="bg-slate-950">Feedback</option>
                </select>
                {errors.subject && <p className="mt-1.5 text-xs text-red-400">{errors.subject}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Message</label>
                <textarea
                  name="message" value={formData.message} onChange={handleChange}
                  rows={4}
                  className={"w-full rounded-xl border px-4 py-3 text-sm text-slate-100 outline-none ring-sky-500/30 placeholder:text-slate-500 focus:ring-4 focus:ring-sky-500/20 transition-all resize-none bg-slate-950/50 " + (errors.message ? 'border-red-500' : 'border-slate-800')}
                  placeholder="How can we help you?"
                />
                {errors.message && <p className="mt-1.5 text-xs text-red-400">{errors.message}</p>}
              </div>

              {submitError && (
                <div className="rounded-xl bg-red-900/30 border border-red-800/50 p-3 text-sm text-red-300">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-sky-500 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 ring-1 ring-inset ring-white/10 transition-all hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/30 active:scale-[0.98]"
              >
                {submitted ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Message Sent!
                  </span>
                ) : (
                  'Send Message'
                )}
              </button>

              {submitted && (
                <div className="rounded-xl bg-green-900/30 border border-green-800/50 p-4 text-center animate-fade-in-up">
                  <div className="text-3xl mb-1">✅</div>
                  <p className="text-sm text-green-300 font-medium">Thank you! Your message has been sent successfully.</p>
                  <p className="text-xs text-green-400/70 mt-1">We typically respond within 24 hours.</p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
