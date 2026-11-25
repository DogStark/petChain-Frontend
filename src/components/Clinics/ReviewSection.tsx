import React, { useState } from 'react';
import { MessageSquare, Star, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { clinicsAPI } from '@/lib/api/clinicsAPI';
import type { ClinicReview } from '@/types/clinic';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';
import { formatDate } from '@/utils/formatDate';

interface ReviewSectionProps {
  clinicId: string;
  reviews: ClinicReview[];
  averageRating: number;
}

interface ReplyEntry {
  id: string;
  text: string;
  date: string;
}

const MAX_REVIEW_LENGTH = 1000;

async function postJson(path: string, body: unknown) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Helpful votes and replies remain local when their optional endpoints are unavailable.
  }
}

export default function ReviewSection({
  clinicId,
  reviews,
  averageRating,
}: ReviewSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const [extraReviews, setExtraReviews] = useState<ClinicReview[]>([]);
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, ReplyEntry[]>>({});
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const allReviews = [...extraReviews, ...reviews];
  const currentAverage =
    allReviews.length > 0
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
      : averageRating;

  const handleHelpful = (review: ClinicReview) => {
    if (votedIds.has(review.id)) return;
    setVotedIds((previous) => new Set(previous).add(review.id));
    setHelpfulCounts((previous) => ({
      ...previous,
      [review.id]: (previous[review.id] ?? review.helpfulCount ?? 0) + 1,
    }));
    void postJson(`/reviews/${encodeURIComponent(review.id)}/helpful`, {});
  };

  const toggleReply = (reviewId: string) => {
    setOpenReplyId((previous) => (previous === reviewId ? null : reviewId));
  };

  const submitReply = (reviewId: string) => {
    const text = (replyDrafts[reviewId] ?? '').trim();
    if (!text) return;
    const entry: ReplyEntry = {
      id: `${reviewId}-${Date.now()}`,
      text,
      date: new Date().toISOString(),
    };
    setReplies((previous) => ({
      ...previous,
      [reviewId]: [...(previous[reviewId] ?? []), entry],
    }));
    setReplyDrafts((previous) => ({ ...previous, [reviewId]: '' }));
    setOpenReplyId(null);
    void postJson(`/reviews/${encodeURIComponent(reviewId)}/replies`, { comment: text });
  };

  const submitNewReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = newReview.comment.trim();
    if (!comment || !user) return;

    setSubmitting(true);
    setSubmissionError(null);
    try {
      const submitted = await clinicsAPI.submitReview(clinicId, {
        rating: newReview.rating,
        comment,
      });
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
      setExtraReviews((previous) => [
        { ...submitted, userId: user.id, userName, rating: newReview.rating, comment },
        ...previous,
      ]);
      setNewReview({ rating: 5, comment: '' });
      setShowWriteReview(false);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : 'Unable to submit your review. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-blue-900 text-white rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
        <div className="text-center md:text-left">
          <div className="text-6xl font-black mb-2">{currentAverage.toFixed(1)}</div>
          <div className="flex items-center justify-center md:justify-start gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((score) => (
              <Star
                key={score}
                aria-hidden="true"
                className={`w-5 h-5 ${
                  score <= Math.round(currentAverage)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-blue-800 fill-blue-800'
                }`}
              />
            ))}
          </div>
          <div className="text-blue-300 text-sm font-bold uppercase tracking-widest">
            {allReviews.length} Total Reviews
          </div>
        </div>

        <div className="hidden md:block h-20 w-px bg-blue-800 shrink-0" />

        <div className="flex-grow space-y-2 w-full max-w-sm">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = allReviews.filter((review) => review.rating === score).length;
            const percentage = allReviews.length > 0 ? (count / allReviews.length) * 100 : 0;
            return (
              <div key={score} className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-200 w-3">{score}</span>
                <div className="flex-grow h-2 bg-blue-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-blue-300 w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allReviews.map((review) => {
          const hasVoted = votedIds.has(review.id);
          const helpfulCount = helpfulCounts[review.id] ?? review.helpfulCount ?? 0;
          const reviewReplies = replies[review.id] ?? [];
          const displayName = review.userName || 'PetChain user';

          return (
            <article
              key={review.id}
              className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/40 shadow-sm flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-pink-400 border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-sm">
                    {displayName[0]}
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-sm">{displayName}</h5>
                    <p className="text-[10px] text-gray-500">{formatDate(review.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Star
                      key={score}
                      aria-hidden="true"
                      className={`w-3 h-3 ${
                        score <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <blockquote className="text-gray-600 text-sm italic leading-relaxed mb-6 flex-grow">
                &quot;{review.comment}&quot;
              </blockquote>

              <div className="flex items-center gap-4 mt-auto pt-4 border-t border-gray-100/50">
                <button
                  type="button"
                  onClick={() => handleHelpful(review)}
                  disabled={hasVoted}
                  aria-pressed={hasVoted}
                  aria-label={`Mark ${displayName}'s review as helpful`}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    hasVoted ? 'text-blue-600 cursor-default' : 'text-gray-400 hover:text-blue-600'
                  }`}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-blue-600' : ''}`} />
                  Helpful {helpfulCount > 0 && <span>({helpfulCount})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => toggleReply(review.id)}
                  aria-label={`Reply to ${displayName}'s review`}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Reply
                </button>
              </div>

              {reviewReplies.length > 0 && (
                <div className="mt-3 space-y-2 pl-4 border-l-2 border-blue-100">
                  {reviewReplies.map((reply) => (
                    <p key={reply.id} className="text-xs text-gray-600">{reply.text}</p>
                  ))}
                </div>
              )}

              {openReplyId === review.id && (
                <form
                  className="mt-3 flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitReply(review.id);
                  }}
                >
                  <input
                    type="text"
                    value={replyDrafts[review.id] ?? ''}
                    onChange={(event) =>
                      setReplyDrafts((previous) => ({
                        ...previous,
                        [review.id]: event.target.value,
                      }))
                    }
                    aria-label="Write a reply"
                    placeholder="Write a reply"
                    className="flex-grow text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" className="text-xs font-bold text-blue-600 px-3 py-2">
                    Send
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>

      {!isAuthenticated || !user ? (
        <p className="text-center text-sm text-gray-600">Sign in to write a clinic review.</p>
      ) : showWriteReview ? (
        <form
          onSubmit={submitNewReview}
          className="w-full p-6 bg-white border-2 border-blue-100 rounded-3xl shadow-sm space-y-4"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Your rating</legend>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  type="button"
                  key={score}
                  onClick={() => setNewReview((previous) => ({ ...previous, rating: score }))}
                  aria-label={`Rate ${score} star${score === 1 ? '' : 's'}`}
                  aria-pressed={newReview.rating === score}
                >
                  <Star
                    aria-hidden="true"
                    className={`w-6 h-6 ${
                      score <= newReview.rating
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="sr-only">Your review</span>
            <textarea
              required
              maxLength={MAX_REVIEW_LENGTH}
              value={newReview.comment}
              onChange={(event) =>
                setNewReview((previous) => ({ ...previous, comment: event.target.value }))
              }
              placeholder="Share your experience"
              rows={4}
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <p className="text-right text-xs text-gray-500">
            {newReview.comment.length}/{MAX_REVIEW_LENGTH}
          </p>
          {submissionError && <p role="alert" className="text-sm text-red-700">{submissionError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !newReview.comment.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowWriteReview(false);
                setSubmissionError(null);
              }}
              className="px-5 py-2.5 text-gray-500 font-bold text-sm rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowWriteReview(true)}
          className="w-full py-4 bg-white border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-3xl hover:bg-blue-50 transition-all active:scale-[0.99] shadow-sm"
        >
          + Write a Review
        </button>
      )}
    </div>
  );
}
