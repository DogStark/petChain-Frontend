import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
    Phone,
    MapPin,
    AlertOctagon,
    User,
    Stethoscope,
    Dna,
    ExternalLink
} from 'lucide-react';
import { petAPI } from '../../../../lib/api/petAPI';
import { PetEmergencyInfo } from '../../../../types/pet';

export default function EmergencyAccessPage() {
    const router = useRouter();
    const { id } = router.query;
    const [data, setData] = useState<PetEmergencyInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const loadData = async () => {
            try {
                const result = await petAPI.getPetEmergencyInfo(id as string);
                setData(result);
            } catch (err: any) {
                setError(err.message || 'Failed to load emergency records');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent shadow-lg" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-center">
                <AlertOctagon size={64} className="text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergency Access Denied</h1>
                <p className="text-gray-600 mb-6">{error || 'Unable to retrieve emergency information for this pet.'}</p>
                <button
                    onClick={() => router.push('/')}
                    className="bg-gray-900 text-white px-8 py-3 rounded-full font-bold shadow-xl"
                >
                    Return Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-red-50">
            <Head>
                <title>EMERGENCY RECORD — PetChain</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
            </Head>

            {/* Emergency Header */}
            <div className="bg-red-600 text-white p-6 shadow-xl sticky top-0 z-50">
                <div className="max-w-md mx-auto flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl animate-pulse">
                        <AlertOctagon size={32} className="text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Emergency Record</h1>
                        <p className="text-red-100 text-sm font-bold">Critical Information for Pet Responders</p>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto p-4 space-y-4 pb-12">
                {/* Critical Medical Notes - MUST BE FIRST */}
                {data.medicalNotes && (
                    <div className="bg-white border-4 border-red-500 rounded-3xl p-6 shadow-2xl">
                        <h2 className="text-red-600 font-black flex items-center gap-2 mb-3 text-lg uppercase">
                            <AlertOctagon size={24} /> Critical Medical Notes
                        </h2>
                        <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100 text-red-900 font-black text-xl leading-snug">
                            {data.medicalNotes}
                        </div>
                    </div>
                )}

                {/* Primary Contacts */}
                <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
                    <h2 className="text-gray-900 font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
                        <User size={18} /> Owner Contacts
                    </h2>
                    <div className="space-y-3">
                        {data.contacts.sort((a, b) => a.priority - b.priority).map((contact) => (
                            <a
                                key={contact.id}
                                href={`tel:${contact.phone}`}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                            >
                                <div>
                                    <p className="font-extrabold text-gray-900 text-lg">{contact.name}</p>
                                    <p className="text-sm text-gray-500 font-bold">{contact.relationship.toUpperCase()}</p>
                                </div>
                                <div className="bg-red-600 text-white p-3 rounded-full shadow-lg">
                                    <Phone size={24} fill="currentColor" />
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* 24/7 Vet */}
                {data.emergencyVet && (
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
                        <h2 className="text-gray-900 font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
                            <Stethoscope size={18} /> Emergency Vet
                        </h2>
                        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 mb-4">
                            <p className="font-black text-blue-900 text-xl mb-1">{data.emergencyVet.name}</p>
                            <div className="flex items-center gap-2 text-blue-600 font-bold mb-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                {data.emergencyVet.is24Hours ? "OPEN 24/7" : "Check Hours"}
                            </div>

                            <div className="flex flex-col gap-2">
                                <a
                                    href={`tel:${data.emergencyVet.phone}`}
                                    className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-full py-4 font-black shadow-lg"
                                >
                                    <Phone size={20} fill="currentColor" /> Call Clinic
                                </a>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.emergencyVet.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 bg-white text-blue-600 border-2 border-blue-600 rounded-full py-4 font-black"
                                >
                                    <MapPin size={20} /> Open Maps
                                </a>
                            </div>
                        </div>
                        {data.emergencyVet.notes && (
                            <p className="text-sm text-gray-600 italic px-2">
                                <span className="font-bold uppercase text-[10px] tracking-widest block text-gray-400 not-italic">Notes</span>
                                {data.emergencyVet.notes}
                            </p>
                        )}
                    </div>
                )}

                {/* Poison Control */}
                {data.poisonControl && (
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 shadow-2xl text-white">
                        <h2 className="font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
                            <AlertOctagon size={18} /> Poison Control
                        </h2>
                        <p className="text-2xl font-black mb-1">{data.poisonControl.name}</p>
                        <a
                            href={`tel:${data.poisonControl.phone}`}
                            className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/10 mt-4 active:scale-95 transition-all"
                        >
                            <p className="font-black text-2xl">{data.poisonControl.phone}</p>
                            <div className="bg-white text-black p-3 rounded-full">
                                <Phone size={24} fill="currentColor" />
                            </div>
                        </a>
                        {data.poisonControl.website && (
                            <a
                                href={data.poisonControl.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm opacity-60 mt-4 justify-center"
                            >
                                Visit Website <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                )}

                <div className="text-center pt-8">
                    <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
                        <Dna size={16} />
                        <span className="font-black tracking-widest text-xs uppercase">Verified by PetChain</span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold max-w-[200px] mx-auto uppercase">
                        Data secured via Stellar Blockchain technology. High-integrity medical registry.
                    </p>
                </div>
            </div>
        </div>
    );
}
