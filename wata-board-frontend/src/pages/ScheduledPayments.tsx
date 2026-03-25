import React, { useState } from 'react';
import { ScheduledPaymentsList } from '../components/ScheduledPaymentsList';
import { SchedulePaymentForm } from '../components/SchedulePaymentForm';
import type { PaymentSchedule } from '../types/scheduling';

export default function ScheduledPayments() {
  const [, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PaymentSchedule | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [refreshKey, setRefreshKey] = useState(0);

  const userId = 'current-user'; // This should come from auth context

  const handleNewSchedule = () => {
    setEditingSchedule(null);
    setShowScheduleForm(true);
    setActiveView('form');
  };

  const handleEditSchedule = (schedule: PaymentSchedule) => {
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
    setActiveView('form');
  };

  const handleScheduleSuccess = (schedule: PaymentSchedule) => {
    console.log('Schedule created/updated:', schedule.id);
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setActiveView('list');
    setRefreshKey(prev => prev + 1); // Trigger refresh
  };

  const handleCancelSchedule = () => {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setActiveView('list');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Scheduled Payments
          </h1>
          <p className="text-slate-400">
            Set up and manage your recurring utility payments
          </p>
        </div>

        {activeView === 'list' ? (
          <ScheduledPaymentsList
            key={refreshKey}
            userId={userId}
            onEditSchedule={handleEditSchedule}
            onNewSchedule={handleNewSchedule}
          />
        ) : (
          <div className="max-w-2xl mx-auto">
            <SchedulePaymentForm
              editMode={!!editingSchedule}
              existingSchedule={editingSchedule || undefined}
              onSuccess={handleScheduleSuccess}
              onCancel={handleCancelSchedule}
            />
          </div>
        )}

        {/* Floating action button for quick access */}
        {activeView === 'list' && (
          <button
            onClick={handleNewSchedule}
            className="fixed bottom-6 right-6 w-14 h-14 bg-sky-500 hover:bg-sky-400 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Create new payment schedule"
          >
            <span className="text-2xl">+</span>
          </button>
        )}
      </div>
    </div>
  );
}
