import React, { useState } from 'react';
import type { FormEvent } from 'react';

import {
  qrcodeAPI,
  type EmergencyResponderFeedbackType,
} from '@/lib/api/qrcodeAPI';

interface EmergencyResponderFeedbackProps {
  qrCodeId: string;
}

function getResponseStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const responseStatus = (error as { response?: { status?: unknown } }).response?.status;
  if (typeof responseStatus === 'number') return responseStatus;

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export default function EmergencyResponderFeedback({
  qrCodeId,
}: EmergencyResponderFeedbackProps) {
  const [feedbackType, setFeedbackType] =
    useState<EmergencyResponderFeedbackType | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackType || submitting || submitted) return;

    setSubmitting(true);
    setErrorMessage('');
    try {
      await qrcodeAPI.submitEmergencyFeedback(qrCodeId, feedbackType);
      setSubmitted(true);
    } catch (error: unknown) {
      const status = getResponseStatus(error);
      if (status === 429) {
        setErrorMessage('Too many reports have been sent. Please wait before trying again.');
      } else if (status === 403 || status === 404 || status === 410) {
        setErrorMessage('Feedback is not available for this emergency profile.');
      } else {
        setErrorMessage('Your report could not be sent. Please try again later.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="responder-feedback-title"
      className="rounded-3xl border border-red-100 bg-white p-6 shadow-lg"
    >
      <h2 id="responder-feedback-title" className="text-base font-black text-gray-900">
        Update the pet&apos;s owner
      </h2>
      <p id="responder-feedback-description" className="mt-2 text-sm text-gray-600">
        Let them know if these contact details are out of date or if the pet is safe.
        This report sends no message or personal details.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <fieldset disabled={submitting || submitted}>
          <legend className="mb-2 text-sm font-semibold text-gray-800">
            Choose one update
          </legend>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input
                type="radio"
                name="responder-feedback"
                value="contact_details_stale"
                checked={feedbackType === 'contact_details_stale'}
                onChange={() => setFeedbackType('contact_details_stale')}
                aria-describedby="responder-feedback-description"
                className="mt-1"
              />
              <span className="text-sm text-gray-800">
                The contact details are out of date
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input
                type="radio"
                name="responder-feedback"
                value="pet_safe"
                checked={feedbackType === 'pet_safe'}
                onChange={() => setFeedbackType('pet_safe')}
                aria-describedby="responder-feedback-description"
                className="mt-1"
              />
              <span className="text-sm text-gray-800">The pet is safe</span>
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={!feedbackType || submitting || submitted}
          className="w-full rounded-full bg-gray-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Sending report…' : submitted ? 'Report sent' : 'Send report'}
        </button>
      </form>

      {submitted ? (
        <p className="mt-3 text-sm text-green-800" role="status" aria-live="polite">
          Thank you. Your report was sent to the pet&apos;s owner.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
