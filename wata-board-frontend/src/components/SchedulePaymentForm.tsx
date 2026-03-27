import React, { useState, useEffect } from 'react';
import {
  PaymentFrequency,
} from '../types/scheduling';

import type {
  NotificationSettings,
  ScheduleFormData,
  ScheduleValidationResult,
  PaymentSchedule
} from '../types/scheduling';
import { SchedulingService } from '../services/schedulingService';

interface SchedulePaymentFormProps {
  meterId?: string;
  initialAmount?: string;
  onSuccess?: (schedule: PaymentSchedule) => void;
  onCancel?: () => void;
  editMode?: boolean;
  existingSchedule?: PaymentSchedule;
}

export function SchedulePaymentForm({
  meterId = '',
  initialAmount = '',
  onSuccess,
  onCancel,
  editMode = false,
  existingSchedule
}: SchedulePaymentFormProps) {
  const [formData, setFormData] = useState<ScheduleFormData>({
    meterId,
    amount: initialAmount,
    frequency: PaymentFrequency.MONTHLY,
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    endDate: '',
    description: '',
    maxPayments: '',
    notificationSettings: {
      email: true,
      push: true,
      sms: false,
      reminderDays: [1, 3], // 1 day and 3 days before
      successNotification: true,
      failureNotification: true
    }
  });

  const [validation, setValidation] = useState<ScheduleValidationResult>({
    isValid: false,
    errors: [],
    warnings: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (editMode && existingSchedule) {
      setFormData({
        meterId: existingSchedule.meterId,
        amount: existingSchedule.amount.toString(),
        frequency: existingSchedule.frequency,
        startDate: existingSchedule.startDate.toISOString().split('T')[0],
        endDate: existingSchedule.endDate?.toISOString().split('T')[0] || '',
        description: existingSchedule.description || '',
        maxPayments: existingSchedule.maxPayments?.toString() || '',
        notificationSettings: existingSchedule.notificationSettings
      });
    }
  }, [editMode, existingSchedule]);

  const frequencyOptions = [
    { value: PaymentFrequency.ONCE, label: 'One-time', description: 'Single payment on a specific date' },
    { value: PaymentFrequency.DAILY, label: 'Daily', description: 'Every day' },
    { value: PaymentFrequency.WEEKLY, label: 'Weekly', description: 'Every week on the same day' },
    { value: PaymentFrequency.BIWEEKLY, label: 'Bi-weekly', description: 'Every two weeks' },
    { value: PaymentFrequency.MONTHLY, label: 'Monthly', description: 'Every month on the same date' },
    { value: PaymentFrequency.QUARTERLY, label: 'Quarterly', description: 'Every three months' },
    { value: PaymentFrequency.YEARLY, label: 'Yearly', description: 'Every year on the same date' }
  ];

  const handleInputChange = (field: keyof ScheduleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: keyof NotificationSettings, value: boolean | number[]) => {
    setFormData(prev => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [field]: value
      }
    }));
  };

  const validateForm = (): ScheduleValidationResult => {
    const service = SchedulingService.getInstance();
    return service.validateSchedule(formData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = validateForm();
    setValidation(validationResult);
    
    if (!validationResult.isValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      const service = SchedulingService.getInstance();
      const userId = 'current-user'; // This should come from auth context
      
      let result;
      if (editMode && existingSchedule) {
        result = await service.updateSchedule(existingSchedule.id, formData);
      } else {
        result = await service.createSchedule(userId, formData);
      }

      if (result.success && result.schedule) {
        onSuccess?.(result.schedule);
      } else {
        console.error('Schedule creation failed:', result.error);
        // Show error message to user
      }
    } catch (error) {
      console.error('Error submitting schedule:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFrequencyDescription = (frequency: PaymentFrequency): string => {
    const option = frequencyOptions.find(opt => opt.value === frequency);
    return option?.description || '';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          {editMode ? 'Edit Payment Schedule' : 'Schedule Payment'}
        </h2>
        <p className="text-slate-400 text-sm">
          {editMode 
            ? 'Modify your scheduled payment settings'
            : 'Set up automatic recurring payments for your utility bills'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Meter Number
            </label>
            <input
              type="text"
              value={formData.meterId}
              onChange={(e) => handleInputChange('meterId', e.target.value)}
              className="w-full h-12 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="e.g. METER-123"
            />
            {validation.errors.find(e => e.field === 'meterId') && (
              <p className="mt-1 text-sm text-red-400">
                {validation.errors.find(e => e.field === 'meterId')?.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Amount (XLM)
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              className="w-full h-12 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
            />
            {validation.errors.find(e => e.field === 'amount') && (
              <p className="mt-1 text-sm text-red-400">
                {validation.errors.find(e => e.field === 'amount')?.message}
              </p>
            )}
            {validation.warnings.find(e => e.field === 'amount') && (
              <p className="mt-1 text-sm text-amber-400">
                {validation.warnings.find(e => e.field === 'amount')?.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => handleInputChange('frequency', e.target.value as PaymentFrequency)}
              className="w-full h-12 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              {frequencyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-400">
              {getFrequencyDescription(formData.frequency)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                className="w-full h-12 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                required
              />
              {validation.errors.find(e => e.field === 'startDate') && (
                <p className="mt-1 text-sm text-red-400">
                  {validation.errors.find(e => e.field === 'startDate')?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                min={formData.startDate}
                className="w-full h-12 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="No end date"
              />
              {validation.errors.find(e => e.field === 'endDate') && (
                <p className="mt-1 text-sm text-red-400">
                  {validation.errors.find(e => e.field === 'endDate')?.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full h-20 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
              placeholder="Add a note for this payment schedule..."
              maxLength={200}
            />
          </div>
        </div>

        {/* Advanced Settings */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="mr-2">{showAdvanced ? '▼' : '▶'}</span>
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 p-4 bg-slate-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Maximum Payments (Optional)
                </label>
                <input
                  type="number"
                  value={formData.maxPayments}
                  onChange={(e) => handleInputChange('maxPayments', e.target.value)}
                  className="w-full h-12 px-4 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Unlimited"
                  min="1"
                />
                {validation.errors.find(e => e.field === 'maxPayments') && (
                  <p className="mt-1 text-sm text-red-400">
                    {validation.errors.find(e => e.field === 'maxPayments')?.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3">
                  Notification Preferences
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Email notifications</span>
                    <button
                      type="button"
                      onClick={() => handleNotificationChange('email', !formData.notificationSettings.email)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        formData.notificationSettings.email ? 'bg-sky-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.notificationSettings.email ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Push notifications</span>
                    <button
                      type="button"
                      onClick={() => handleNotificationChange('push', !formData.notificationSettings.push)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        formData.notificationSettings.push ? 'bg-sky-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.notificationSettings.push ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">SMS notifications</span>
                    <button
                      type="button"
                      onClick={() => handleNotificationChange('sms', !formData.notificationSettings.sms)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        formData.notificationSettings.sms ? 'bg-sky-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.notificationSettings.sms ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Success notifications</span>
                    <button
                      type="button"
                      onClick={() => handleNotificationChange('successNotification', !formData.notificationSettings.successNotification)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        formData.notificationSettings.successNotification ? 'bg-sky-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.notificationSettings.successNotification ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Failure notifications</span>
                    <button
                      type="button"
                      onClick={() => handleNotificationChange('failureNotification', !formData.notificationSettings.failureNotification)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        formData.notificationSettings.failureNotification ? 'bg-sky-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.notificationSettings.failureNotification ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-amber-300 mb-2">Please Review:</h4>
            <ul className="space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index} className="text-sm text-amber-200">
                  • {warning.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-12 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? 'Creating...' : (editMode ? 'Update Schedule' : 'Create Schedule')}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 h-12 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
