import React, { useState, useEffect } from 'react';
import {
  PaymentStatus,
  PaymentFrequency,
} from '../types/scheduling';

import type {
  PaymentSchedule,
  ScheduledPayment,
  CalendarEvent
} from '../types/scheduling';
import { SchedulingService } from '../services/schedulingService';

interface ScheduledPaymentsListProps {
  userId: string;
  onEditSchedule?: (schedule: PaymentSchedule) => void;
  onNewSchedule?: () => void;
}

export function ScheduledPaymentsList({ userId, onEditSchedule, onNewSchedule }: ScheduledPaymentsListProps) {
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<PaymentSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');
  const [, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const service = SchedulingService.getInstance();

  useEffect(() => {
    loadSchedules();
  }, [userId]);

  useEffect(() => {
    if (schedules.length > 0) {
      loadCalendarEvents();
    }
  }, [schedules, currentMonth]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const result = await service.getUserSchedules(userId);
      if (result.success && result.schedules) {
        setSchedules(result.schedules);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      const events = await service.getCalendarEvents(
        userId,
        currentMonth.getFullYear(),
        currentMonth.getMonth()
      );
      setCalendarEvents(events);
    } catch (error) {
      console.error('Failed to load calendar events:', error);
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to cancel this schedule? All pending payments will be cancelled.')) {
      return;
    }

    try {
      const result = await service.cancelSchedule(scheduleId);
      if (result.success) {
        await loadSchedules();
        // Show success message
      } else {
        console.error('Failed to cancel schedule:', result.error);
        // Show error message
      }
    } catch (error) {
      console.error('Error cancelling schedule:', error);
    }
  };

  const handlePauseSchedule = async (scheduleId: string) => {
    try {
      // This would need to be implemented in the service
      console.log('Pause schedule:', scheduleId);
    } catch (error) {
      console.error('Error pausing schedule:', error);
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.meterId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (schedule.description?.toLowerCase().includes(searchTerm.toLowerCase()) || '');
    
    switch (activeTab) {
      case 'active':
        return matchesSearch && schedule.status === PaymentStatus.SCHEDULED;
      case 'completed':
        return matchesSearch && schedule.status === PaymentStatus.COMPLETED;
      default:
        return matchesSearch;
    }
  });

  const getFrequencyLabel = (frequency: PaymentFrequency): string => {
    const labels = {
      [PaymentFrequency.ONCE]: 'One-time',
      [PaymentFrequency.DAILY]: 'Daily',
      [PaymentFrequency.WEEKLY]: 'Weekly',
      [PaymentFrequency.BIWEEKLY]: 'Bi-weekly',
      [PaymentFrequency.MONTHLY]: 'Monthly',
      [PaymentFrequency.QUARTERLY]: 'Quarterly',
      [PaymentFrequency.YEARLY]: 'Yearly'
    };
    return labels[frequency] || frequency;
  };

  const getStatusColor = (status: PaymentStatus): string => {
    const colors = {
      [PaymentStatus.SCHEDULED]: 'text-sky-400 bg-sky-400/10',
      [PaymentStatus.COMPLETED]: 'text-green-400 bg-green-400/10',
      [PaymentStatus.FAILED]: 'text-red-400 bg-red-400/10',
      [PaymentStatus.CANCELLED]: 'text-slate-400 bg-slate-400/10',
      [PaymentStatus.PAUSED]: 'text-amber-400 bg-amber-400/10'
    };
    return colors[status] || 'text-slate-400 bg-slate-400/10';
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XLM',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Scheduled Payments</h2>
          <p className="text-slate-400">Manage your recurring and scheduled payments</p>
        </div>
        {onNewSchedule && (
          <button
            onClick={onNewSchedule}
            className="px-4 h-10 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg transition-colors"
          >
            New Schedule
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by meter ID or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 h-10 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        
        <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
          {['active', 'completed', 'all'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">Calendar View</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ◀
            </button>
            <span className="text-slate-200 font-medium">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ▶
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-medium text-slate-400 py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days would go here - simplified for now */}
          <div className="col-span-7 text-center text-slate-500 py-8">
            Calendar view coming soon...
          </div>
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              No scheduled payments found
            </h3>
            <p className="text-slate-400 mb-4">
              {activeTab === 'active' 
                ? 'You have no active scheduled payments'
                : `No ${activeTab} payments found`
              }
            </p>
            {onNewSchedule && activeTab === 'active' && (
              <button
                onClick={onNewSchedule}
                className="px-4 h-10 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg transition-colors"
              >
                Create Your First Schedule
              </button>
            )}
          </div>
        ) : (
          filteredSchedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-100 mb-1">
                        {schedule.meterId}
                      </h4>
                      {schedule.description && (
                        <p className="text-slate-400 text-sm">{schedule.description}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                      {schedule.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 mb-1">Amount</p>
                      <p className="text-slate-200 font-medium">{formatCurrency(schedule.amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Frequency</p>
                      <p className="text-slate-200 font-medium">{getFrequencyLabel(schedule.frequency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Next Payment</p>
                      <p className="text-slate-200 font-medium">
                        {schedule.nextPaymentDate ? formatDate(schedule.nextPaymentDate) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Progress</p>
                      <p className="text-slate-200 font-medium">
                        {schedule.currentPaymentCount}
                        {schedule.maxPayments ? ` / ${schedule.maxPayments}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Payment History */}
                  {schedule.paymentHistory.length > 0 && (
                    <div className="mt-4">
                      <p className="text-slate-400 text-sm mb-2">Recent Payments</p>
                      <div className="space-y-1">
                        {schedule.paymentHistory.slice(-3).reverse().map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">
                              {formatDate(payment.scheduledDate)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200">{formatCurrency(payment.amount)}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(payment.status)}`}>
                                {payment.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 lg:ml-4">
                  <button
                    onClick={() => setSelectedSchedule(schedule)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    View Details
                  </button>
                  
                  {schedule.status === PaymentStatus.SCHEDULED && onEditSchedule && (
                    <button
                      onClick={() => onEditSchedule(schedule)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Edit
                    </button>
                  )}
                  
                  {schedule.status === PaymentStatus.SCHEDULED && (
                    <button
                      onClick={() => handlePauseSchedule(schedule.id)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Pause
                    </button>
                  )}
                  
                  {schedule.status === PaymentStatus.SCHEDULED && (
                    <button
                      onClick={() => handleCancelSchedule(schedule.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Schedule Details Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-100">Schedule Details</h3>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Meter ID</p>
                  <p className="text-slate-200 font-medium">{selectedSchedule.meterId}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedSchedule.status)}`}>
                    {selectedSchedule.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Amount</p>
                  <p className="text-slate-200 font-medium">{formatCurrency(selectedSchedule.amount)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Frequency</p>
                  <p className="text-slate-200 font-medium">{getFrequencyLabel(selectedSchedule.frequency)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Start Date</p>
                  <p className="text-slate-200 font-medium">{formatDate(selectedSchedule.startDate)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">End Date</p>
                  <p className="text-slate-200 font-medium">
                    {selectedSchedule.endDate ? formatDate(selectedSchedule.endDate) : 'No end date'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Next Payment</p>
                  <p className="text-slate-200 font-medium">
                    {selectedSchedule.nextPaymentDate ? formatDate(selectedSchedule.nextPaymentDate) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Progress</p>
                  <p className="text-slate-200 font-medium">
                    {selectedSchedule.currentPaymentCount}
                    {selectedSchedule.maxPayments ? ` / ${selectedSchedule.maxPayments}` : ' payments'}
                  </p>
                </div>
              </div>

              {selectedSchedule.description && (
                <div>
                  <p className="text-slate-400 text-sm mb-1">Description</p>
                  <p className="text-slate-200">{selectedSchedule.description}</p>
                </div>
              )}

              <div>
                <p className="text-slate-400 text-sm mb-3">Payment History</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSchedule.paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div>
                        <p className="text-slate-200 font-medium">{formatDate(payment.scheduledDate)}</p>
                        {payment.actualPaymentDate && (
                          <p className="text-slate-400 text-sm">
                            Paid: {formatDate(payment.actualPaymentDate)}
                          </p>
                        )}
                        {payment.transactionId && (
                          <p className="text-slate-400 text-xs">
                            TX: {payment.transactionId.slice(0, 10)}...
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-slate-200 font-medium">{formatCurrency(payment.amount)}</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${getStatusColor(payment.status)}`}>
                          {payment.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
