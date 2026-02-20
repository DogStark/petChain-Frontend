import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import {
    MOCK_DENTAL_EXAMS,
    MOCK_CLEANINGS,
    MOCK_ISSUES,
    MOCK_REMINDERS,
    DentalExam,
    CleaningRecord,
    DentalIssue,
    DentalReminder,
    ToothRecord,
    ToothStatus,
    IssueSeverity,
    IssueStatus,
    ReminderType,
} from '../lib/api/dentalAPI';

// ─── Colour helpers ──────────────────────────────────────────────────────────

const TOOTH_STATUS_CONFIG: Record<
    ToothStatus,
    { bg: string; border: string; emoji: string; label: string }
> = {
    healthy: { bg: '#22c55e', border: '#16a34a', emoji: '✅', label: 'Healthy' },
    cavity: { bg: '#ef4444', border: '#dc2626', emoji: '🔴', label: 'Cavity' },
    missing: { bg: '#6b7280', border: '#4b5563', emoji: '⬜', label: 'Missing' },
    treated: { bg: '#3b82f6', border: '#2563eb', emoji: '💙', label: 'Treated' },
    fractured: { bg: '#f97316', border: '#ea580c', emoji: '🟠', label: 'Fractured' },
    tartar: { bg: '#eab308', border: '#ca8a04', emoji: '🟡', label: 'Tartar' },
};

const SEVERITY_CONFIG: Record<IssueSeverity, { bg: string; text: string; badge: string }> = {
    mild: { bg: '#fef9c3', text: '#854d0e', badge: 'bg-yellow-100 text-yellow-800' },
    moderate: { bg: '#ffedd5', text: '#c2410c', badge: 'bg-orange-100 text-orange-800' },
    severe: { bg: '#fee2e2', text: '#991b1b', badge: 'bg-red-100 text-red-800' },
};

const STATUS_CONFIG: Record<IssueStatus, { badge: string; label: string }> = {
    active: { badge: 'bg-red-100 text-red-700 border border-red-200', label: 'Active' },
    monitoring: { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', label: 'Monitoring' },
    resolved: { badge: 'bg-green-100 text-green-700 border border-green-200', label: 'Resolved' },
};

const REMINDER_TYPE_CONFIG: Record<ReminderType, { icon: string; color: string }> = {
    cleaning: { icon: '🪥', color: 'from-blue-400 to-cyan-400' },
    exam: { icon: '🔬', color: 'from-purple-400 to-pink-400' },
    follow_up: { icon: '📋', color: 'from-orange-400 to-amber-400' },
    medication: { icon: '💊', color: 'from-green-400 to-teal-400' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, gradient }: {
    icon: string; label: string; value: string | number; sub?: string; gradient: string;
}) {
    return (
        <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${gradient} shadow-lg flex flex-col gap-1 transition-transform hover:scale-105`}>
            <span className="text-3xl">{icon}</span>
            <p className="text-sm font-medium opacity-80">{label}</p>
            <p className="text-3xl font-extrabold">{value}</p>
            {sub && <p className="text-xs opacity-70">{sub}</p>}
        </div>
    );
}

// ─── Tooth Chart ─────────────────────────────────────────────────────────────

function ToothChart({ teeth, onToothClick }: {
    teeth: ToothRecord[];
    onToothClick: (tooth: ToothRecord) => void;
}) {
    // Dogs have 42 teeth: 12 incisors, 4 canines, 16 premolars, 10 molars
    // We'll lay them out as upper (21) / lower (21) rows
    const upper = teeth.slice(0, 21);
    const lower = teeth.slice(21, 42);

    const ToothBtn = ({ tooth }: { tooth: ToothRecord }) => {
        const cfg = TOOTH_STATUS_CONFIG[tooth.status];
        return (
            <button
                key={tooth.toothId}
                onClick={() => onToothClick(tooth)}
                title={`${tooth.label} – ${cfg.label}`}
                className="relative group flex flex-col items-center focus:outline-none"
                style={{ width: 28 }}
            >
                <div
                    className="w-6 h-7 rounded-md transition-transform group-hover:scale-125 group-hover:z-10 shadow-sm"
                    style={{ backgroundColor: cfg.bg, border: `2px solid ${cfg.border}` }}
                />
                <span className="text-[9px] text-gray-500 mt-0.5 font-mono">{tooth.toothId}</span>
                {/* Tooltip */}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl">
                    {cfg.emoji} {tooth.label}: {cfg.label}
                    {tooth.notes && <span className="block opacity-70">{tooth.notes}</span>}
                </div>
            </button>
        );
    };

    return (
        <div className="flex flex-col items-center gap-4 py-4">
            {/* Upper jaw */}
            <div>
                <p className="text-center text-xs text-gray-400 font-semibold mb-2 uppercase tracking-widest">Upper Jaw</p>
                <div className="flex gap-1 flex-wrap justify-center">
                    {upper.map(t => <ToothBtn key={t.toothId} tooth={t} />)}
                </div>
            </div>
            {/* Divider */}
            <div className="w-full max-w-xs border-t-2 border-dashed border-blue-200 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-xs text-blue-400 font-semibold">gum line</span>
            </div>
            {/* Lower jaw */}
            <div>
                <div className="flex gap-1 flex-wrap justify-center">
                    {lower.map(t => <ToothBtn key={t.toothId} tooth={t} />)}
                </div>
                <p className="text-center text-xs text-gray-400 font-semibold mt-2 uppercase tracking-widest">Lower Jaw</p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2">
                {Object.entries(TOOTH_STATUS_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}` }} />
                        <span className="text-xs text-gray-600">{cfg.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
    const radius = 38;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (score / 10) * circ;
    const color = score >= 8 ? '#22c55e' : score >= 5 ? '#eab308' : '#ef4444';
    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={100} height={100} className="-rotate-90">
                <circle cx={50} cy={50} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={10} />
                <circle
                    cx={50} cy={50} r={radius} fill="none"
                    stroke={color} strokeWidth={10}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <span className="absolute text-2xl font-extrabold" style={{ color }}>{score}</span>
        </div>
    );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
    const map: Record<string, string> = {
        none: 'bg-green-100 text-green-700',
        mild: 'bg-yellow-100 text-yellow-700',
        moderate: 'bg-orange-100 text-orange-700',
        severe: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[level] || 'bg-gray-100 text-gray-600'}`}>
            {level}
        </span>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'chart' | 'cleanings' | 'issues' | 'reminders';

export default function DentalHealthPage() {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [exams] = useState<DentalExam[]>(MOCK_DENTAL_EXAMS);
    const [cleanings] = useState<CleaningRecord[]>(MOCK_CLEANINGS);
    const [issues] = useState<DentalIssue[]>(MOCK_ISSUES);
    const [reminders, setReminders] = useState<DentalReminder[]>(MOCK_REMINDERS);

    const [selectedExam, setSelectedExam] = useState<DentalExam>(exams[0]);
    const [selectedTooth, setSelectedTooth] = useState<ToothRecord | null>(null);
    const [showAddReminder, setShowAddReminder] = useState(false);
    const [newReminder, setNewReminder] = useState({
        title: '', description: '', dueDate: '', type: 'exam' as ReminderType,
    });

    const latestExam = exams[0];
    const activeIssues = issues.filter(i => i.status === 'active').length;
    const pendingReminders = reminders.filter(r => !r.isCompleted).length;
    const lastCleaning = cleanings[0];

    const handleCompleteReminder = (id: string) => {
        setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, isCompleted: true, completedDate: new Date().toISOString().split('T')[0] } : r
        ));
    };

    const handleAddReminder = () => {
        if (!newReminder.title || !newReminder.dueDate) return;
        const r: DentalReminder = {
            id: `rem-${Date.now()}`,
            petId: 'pet-001',
            type: newReminder.type,
            title: newReminder.title,
            description: newReminder.description,
            dueDate: newReminder.dueDate,
            isCompleted: false,
        };
        setReminders(prev => [r, ...prev]);
        setNewReminder({ title: '', description: '', dueDate: '', type: 'exam' });
        setShowAddReminder(false);
    };

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overview', icon: '🦷' },
        { id: 'chart', label: 'Tooth Chart', icon: '🗺️' },
        { id: 'cleanings', label: 'Cleanings', icon: '🪥' },
        { id: 'issues', label: 'Dental Issues', icon: '⚠️' },
        { id: 'reminders', label: 'Reminders', icon: '🔔' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 pb-16">
            <Head>
                <title>Dental Health | PetChain</title>
                <meta name="description" content="Track your pet's dental health, cleanings, tooth chart, and dental care reminders on PetChain." />
            </Head>

            {/* ── Header ── */}
            <div className="bg-white/70 backdrop-blur-md shadow-sm sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-4xl">🦷</span>
                        <div>
                            <h1 className="text-2xl font-extrabold text-blue-700 leading-tight">Dental Health</h1>
                            <p className="text-sm text-gray-500">Comprehensive oral care tracking for your pet</p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2">
                        <span className="text-xs text-blue-600 font-semibold">🐾 Max — Golden Retriever</span>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200 focus:outline-none
                  ${activeTab === tab.id
                                        ? 'border-blue-600 text-blue-700'
                                        : 'border-transparent text-gray-500 hover:text-blue-500 hover:border-blue-200'
                                    }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pt-8">

                {/* ────────────────── OVERVIEW TAB ────────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-fade-in-up">
                        {/* Stat cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                icon="📊" label="Dental Score" value={`${latestExam.overallScore}/10`}
                                sub="Latest exam" gradient="from-blue-500 to-cyan-400"
                            />
                            <StatCard
                                icon="⚠️" label="Active Issues" value={activeIssues}
                                sub="Needs attention" gradient="from-red-400 to-orange-400"
                            />
                            <StatCard
                                icon="🔔" label="Pending Reminders" value={pendingReminders}
                                sub="Upcoming care" gradient="from-purple-500 to-pink-400"
                            />
                            <StatCard
                                icon="🪥" label="Last Cleaning" value={lastCleaning?.date ?? '—'}
                                sub={lastCleaning?.type === 'professional' ? 'Professional' : 'Home'}
                                gradient="from-green-500 to-teal-400"
                            />
                        </div>

                        {/* Latest exam card */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <span>🔬</span> Latest Dental Exam
                                </h2>
                                <span className="text-sm text-gray-500">{latestExam.date}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Score ring + vet info */}
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-center">
                                        <ScoreRing score={latestExam.overallScore} />
                                        <p className="text-xs text-gray-500 mt-1 text-center">Overall Score</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-gray-800">{latestExam.vetName}</p>
                                        <p className="text-sm text-gray-500">{latestExam.clinic}</p>
                                        <p className="text-sm text-gray-500">Next exam: <span className="font-medium text-blue-600">{latestExam.nextExamDate}</span></p>
                                    </div>
                                </div>

                                {/* Level indicators */}
                                <div className="space-y-3">
                                    {[
                                        { label: 'Plaque Level', value: latestExam.plaqueLevel },
                                        { label: 'Tartar Level', value: latestExam.tartarLevel },
                                        { label: 'Gingivitis', value: latestExam.gingivitisLevel },
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100">
                                            <span className="text-sm text-gray-600">{item.label}</span>
                                            <LevelBadge level={item.value} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {latestExam.notes && (
                                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                    <p className="text-sm text-blue-800">
                                        <span className="font-semibold">📝 Vet Notes: </span>{latestExam.notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Quick issue summary */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span>⚠️</span> Active Issues Summary
                            </h2>
                            {issues.filter(i => i.status !== 'resolved').length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">✅ No active dental issues!</div>
                            ) : (
                                <div className="space-y-3">
                                    {issues.filter(i => i.status !== 'resolved').map(issue => (
                                        <div key={issue.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow"
                                            style={{ backgroundColor: SEVERITY_CONFIG[issue.severity].bg }}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-sm text-gray-800">{issue.issueType}</span>
                                                    {issue.toothId && <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 text-gray-500">Tooth #{issue.toothId}</span>}
                                                </div>
                                                <p className="text-xs text-gray-600">{issue.notes}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_CONFIG[issue.status].badge}`}>
                                                    {STATUS_CONFIG[issue.status].label}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_CONFIG[issue.severity].badge}`}>
                                                    {issue.severity}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Upcoming reminders */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span>🔔</span> Upcoming Reminders
                            </h2>
                            <div className="space-y-3">
                                {reminders.filter(r => !r.isCompleted).slice(0, 3).map(r => {
                                    const cfg = REMINDER_TYPE_CONFIG[r.type];
                                    return (
                                        <div key={r.id} className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${cfg.color} text-white shadow-md`}>
                                            <span className="text-2xl">{cfg.icon}</span>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{r.title}</p>
                                                <p className="text-xs opacity-80">Due: {r.dueDate}</p>
                                            </div>
                                            <button
                                                onClick={() => handleCompleteReminder(r.id)}
                                                className="bg-white/25 hover:bg-white/40 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                                            >
                                                Done ✓
                                            </button>
                                        </div>
                                    );
                                })}
                                {reminders.filter(r => !r.isCompleted).length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">🎉 All caught up! No pending reminders.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ────────────────── TOOTH CHART TAB ────────────────── */}
                {activeTab === 'chart' && (
                    <div className="space-y-6 animate-fade-in-up">
                        {/* Exam selector */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <span>🗺️</span> Interactive Tooth Chart
                                </h2>
                                <select
                                    className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
                                    value={selectedExam.id}
                                    onChange={e => setSelectedExam(exams.find(ex => ex.id === e.target.value) || exams[0])}
                                >
                                    {exams.map(ex => (
                                        <option key={ex.id} value={ex.id}>{ex.date} — {ex.vetName}</option>
                                    ))}
                                </select>
                            </div>

                            <p className="text-sm text-gray-500 mb-4 text-center">
                                Hover over any tooth to see its status. Click for detailed notes.
                            </p>

                            <ToothChart
                                teeth={selectedExam.toothChart}
                                onToothClick={setSelectedTooth}
                            />
                        </div>

                        {/* Tooth detail panel */}
                        {selectedTooth && (
                            <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6 border-l-4"
                                style={{ borderColor: TOOTH_STATUS_CONFIG[selectedTooth.status].border }}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <span>{TOOTH_STATUS_CONFIG[selectedTooth.status].emoji}</span>
                                        {selectedTooth.label} — {TOOTH_STATUS_CONFIG[selectedTooth.status].label}
                                    </h3>
                                    <button onClick={() => setSelectedTooth(null)}
                                        className="text-gray-400 hover:text-gray-600 text-xl transition-colors">✕</button>
                                </div>
                                <p className="text-sm text-gray-600">Last updated: {selectedTooth.lastUpdated}</p>
                                {selectedTooth.notes
                                    ? <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{selectedTooth.notes}</p>
                                    : <p className="mt-3 text-sm text-gray-400 italic">No additional notes for this tooth.</p>
                                }
                            </div>
                        )}

                        {/* Tooth status summary */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Jaw Summary</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {Object.entries(TOOTH_STATUS_CONFIG).map(([status, cfg]) => {
                                    const count = selectedExam.toothChart.filter(t => t.status === status).length;
                                    return (
                                        <div key={status} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                                            <div className="w-4 h-4 rounded-sm flex-shrink-0 shadow-sm"
                                                style={{ backgroundColor: cfg.bg, border: `2px solid ${cfg.border}` }} />
                                            <div>
                                                <p className="text-xs font-semibold text-gray-700">{cfg.label}</p>
                                                <p className="text-lg font-bold text-gray-900">{count}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ────────────────── CLEANINGS TAB ────────────────── */}
                {activeTab === 'cleanings' && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span>🪥</span> Cleaning History
                            </h2>
                            <div className="text-sm text-gray-500">{cleanings.length} records</div>
                        </div>

                        {cleanings.map(c => (
                            <div key={c.id} className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6 transition-all hover:shadow-xl">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow
                      ${c.type === 'professional' ? 'bg-blue-100' : 'bg-green-100'}`}>
                                            {c.type === 'professional' ? '🏥' : '🏠'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{c.clinic}</p>
                                            <p className="text-sm text-gray-500">{c.vetName}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-gray-700">{c.date}</p>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize
                      ${c.type === 'professional' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                            {c.type}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                    <div className="bg-gray-50 rounded-2xl p-3">
                                        <p className="text-xs text-gray-400 mb-1">Anesthesia</p>
                                        <p className="font-semibold text-sm">{c.anesthesiaUsed ? '✅ Used' : '❌ Not used'}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl p-3">
                                        <p className="text-xs text-gray-400 mb-1">Extractions</p>
                                        <p className="font-semibold text-sm">{c.teethExtracted.length > 0 ? `Teeth: ${c.teethExtracted.join(', ')}` : 'None'}</p>
                                    </div>
                                    {c.cost !== undefined && (
                                        <div className="bg-gray-50 rounded-2xl p-3">
                                            <p className="text-xs text-gray-400 mb-1">Cost</p>
                                            <p className="font-semibold text-sm">{c.cost === 0 ? 'Free (home)' : `$${c.cost}`}</p>
                                        </div>
                                    )}
                                </div>

                                {c.notes && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                                        <p className="text-sm text-blue-800">
                                            <span className="font-semibold">📝 Notes: </span>{c.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ────────────────── ISSUES TAB ────────────────── */}
                {activeTab === 'issues' && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span>⚠️</span> Dental Issues
                            </h2>
                            <div className="flex gap-2">
                                {(['active', 'monitoring', 'resolved'] as IssueStatus[]).map(s => (
                                    <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_CONFIG[s].badge}`}>
                                        {issues.filter(i => i.status === s).length} {s}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {issues.map(issue => (
                            <div key={issue.id}
                                className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-6 transition-all hover:shadow-xl border-l-4"
                                style={{ borderColor: issue.severity === 'severe' ? '#ef4444' : issue.severity === 'moderate' ? '#f97316' : '#eab308' }}>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-gray-800 text-lg">{issue.issueType}</p>
                                            {issue.toothId && (
                                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">Tooth #{issue.toothId}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">Diagnosed: {issue.diagnosedDate}</p>
                                        {issue.resolvedDate && <p className="text-sm text-green-600">Resolved: {issue.resolvedDate}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_CONFIG[issue.status].badge}`}>
                                            {STATUS_CONFIG[issue.status].label}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SEVERITY_CONFIG[issue.severity].badge}`}>
                                            {issue.severity}
                                        </span>
                                    </div>
                                </div>

                                {issue.treatment && (
                                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 mb-3">
                                        <p className="text-sm text-purple-800">
                                            <span className="font-semibold">💊 Treatment: </span>{issue.treatment}
                                        </p>
                                    </div>
                                )}

                                <p className="text-sm text-gray-600 bg-gray-50 rounded-2xl p-3">{issue.notes}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ────────────────── REMINDERS TAB ────────────────── */}
                {activeTab === 'reminders' && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span>🔔</span> Dental Care Reminders
                            </h2>
                            <button
                                onClick={() => setShowAddReminder(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all hover:scale-105 shadow-md"
                            >
                                <span>+</span> Add Reminder
                            </button>
                        </div>

                        {/* Add reminder modal */}
                        {showAddReminder && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
                                <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-800">New Dental Reminder</h3>
                                        <button onClick={() => setShowAddReminder(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Type</label>
                                            <select
                                                value={newReminder.type}
                                                onChange={e => setNewReminder(p => ({ ...p, type: e.target.value as ReminderType }))}
                                                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            >
                                                <option value="exam">🔬 Exam</option>
                                                <option value="cleaning">🪥 Cleaning</option>
                                                <option value="follow_up">📋 Follow-up</option>
                                                <option value="medication">💊 Medication</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Title</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Annual dental checkup"
                                                value={newReminder.title}
                                                onChange={e => setNewReminder(p => ({ ...p, title: e.target.value }))}
                                                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                                            <textarea
                                                placeholder="Optional details…"
                                                rows={2}
                                                value={newReminder.description}
                                                onChange={e => setNewReminder(p => ({ ...p, description: e.target.value }))}
                                                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Due Date</label>
                                            <input
                                                type="date"
                                                value={newReminder.dueDate}
                                                onChange={e => setNewReminder(p => ({ ...p, dueDate: e.target.value }))}
                                                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setShowAddReminder(false)}
                                                className="flex-1 border border-gray-200 rounded-full py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleAddReminder}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full py-2.5 text-sm font-semibold transition-all hover:scale-105"
                                            >
                                                Add Reminder
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending reminders */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Upcoming</h3>
                            {reminders.filter(r => !r.isCompleted).length === 0 ? (
                                <div className="text-center py-10 text-gray-400">🎉 Nothing pending — great job!</div>
                            ) : (
                                <div className="space-y-4">
                                    {reminders.filter(r => !r.isCompleted).map(r => {
                                        const cfg = REMINDER_TYPE_CONFIG[r.type];
                                        const isOverdue = new Date(r.dueDate) < new Date();
                                        return (
                                            <div key={r.id}
                                                className={`bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg p-5 flex items-center gap-4 transition-all hover:shadow-xl
                          ${isOverdue ? 'border-2 border-red-200' : ''}`}>
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${cfg.color} shadow-md flex-shrink-0`}>
                                                    {cfg.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-gray-800">{r.title}</p>
                                                        {isOverdue && (
                                                            <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">Overdue</span>
                                                        )}
                                                    </div>
                                                    {r.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{r.description}</p>}
                                                    <p className="text-xs text-gray-400 mt-1">📅 Due: <span className={`font-semibold ${isOverdue ? 'text-red-500' : 'text-blue-600'}`}>{r.dueDate}</span></p>
                                                </div>
                                                <button
                                                    onClick={() => handleCompleteReminder(r.id)}
                                                    className="flex-shrink-0 bg-green-100 hover:bg-green-200 text-green-700 font-semibold text-xs px-3 py-2 rounded-full transition-all hover:scale-105"
                                                >
                                                    ✓ Done
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Completed reminders */}
                        {reminders.filter(r => r.isCompleted).length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Completed</h3>
                                <div className="space-y-3">
                                    {reminders.filter(r => r.isCompleted).map(r => {
                                        const cfg = REMINDER_TYPE_CONFIG[r.type];
                                        return (
                                            <div key={r.id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4 opacity-60">
                                                <span className="text-xl">{cfg.icon}</span>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-600 line-through text-sm">{r.title}</p>
                                                    {r.completedDate && <p className="text-xs text-gray-400">Completed: {r.completedDate}</p>}
                                                </div>
                                                <span className="text-green-500 text-lg">✅</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
