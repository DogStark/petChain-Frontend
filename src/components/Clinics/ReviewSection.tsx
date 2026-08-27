import React, { useState } from 'react';
import { Star, MessageSquare, ThumbsUp } from 'lucide-react';
import { ClinicReview } from '@/types/clinic';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

interface ReviewSectionProps {
  reviews: ClinicReview[];
  averageRating: number;
}

interface ReplyEntry {
  id: string;
  text: string;
  date: string;
}

// Best-effort call — the UI already updates optimistically, so a failure
// here (e.g. no backend wired up yet) shouldn't disrupt the experience.
async function postJson(path: string, body: unknown) {
  try {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Ignore network errors — this is a best-effort sync.
  }
}

export default function ReviewSection({ reviews, averageRating }: ReviewSectionProps) {
  const [extraReviews, setExtraReviews] = useState<ClinicReview[]>([]);
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, ReplyEntry[]>>({});
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({ userName: '', rating: 5, comment: '' });

  const allReviews = [...reviews, ...extraReviews];

  const handleHelpful = (review: ClinicReview) => {
    if (votedIds.has(review.id)) return;
    setVotedIds((prev) => new Set(prev).add(review.id));
    setHelpfulCounts((prev) => ({
      ...prev,
      [review.id]: (prev[review.id] ?? review.helpfulCount ?? 0) + 1,
    }));
    void postJson(`/reviews/${review.id}/helpful`, {});
  };

  const toggleReply = (reviewId: string) => {
    setOpenReplyId((prev) => (prev === reviewId ? null : reviewId));
  };

  const submitReply = (reviewId: string) => {
    const text = (replyDrafts[reviewId] ?? '').trim();
    if (!text) return;
    const entry: ReplyEntry = { id: `${reviewId}-${Date.now()}`, text, date: new Date().toISOString() };
    setReplies((prev) => ({ ...prev, [reviewId]: [...(prev[reviewId] ?? []), entry] }));
    setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
    setOpenReplyId(null);
    void postJson(`/reviews/${reviewId}/replies`, { comment: text });
  };

  const submitNewReview = () => {
    if (!newReview.comment.trim()) return;
    const review: ClinicReview = {
      id: `local-${Date.now()}`,
      userId: 'me',
      userName: newReview.userName.trim() || 'Anonymous',
      rating: newReview.rating,
      comment: newReview.comment.trim(),
      date: new Date().toISOString(),
      helpfulCount: 0,
    };
    setExtraReviews((prev) => [review, ...prev]);
    void postJson('/reviews', review);
    setNewReview({ userName: '', rating: 5, comment: '' });
    setShowWriteReview(false);
  };

  return (
    <div className="space-y-8">
      {/* Rating Summary Header */}
      <div className="bg-blue-900 text-white rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
        <div className="text-center md:text-left">
          <div className="text-6xl font-black mb-2">{averageRating.toFixed(1)}</div>
          <div className="flex items-center justify-center md:justify-start gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-5 h-5 ${s <= Math.round(averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-blue-800 fill-blue-800'}`}
              />
            ))}
          </div>
          <div className="text-blue-300 text-sm font-bold uppercase tracking-widest">
            {allReviews.length} Total Reviews
          </div>
        </div>

        <div className="hidden md:block h-20 w-px bg-blue-800 shrink-0"></div>

        <div className="flex-grow space-y-2 w-full max-w-sm">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = allReviews.filter((r) => r.rating === score).length;
            const percentage = allReviews.length > 0 ? (count / allReviews.length) * 100 : 0;
            return (
              <div key={score} className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-200 w-3">{score}</span>
                <div className="flex-grow h-2 bg-blue-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-blue-300 w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allReviews.map((review) => {
          const hasVoted = votedIds.has(review.id);
          const helpfulCount = helpfulCounts[review.id] ?? review.helpfulCount ?? 0;
          const reviewReplies = replies[review.id] ?? [];

          return (
            <div
              key={review.id}
              className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/40 shadow-sm flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-pink-400 border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-sm">
                    {review.userName[0]}
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-sm">{review.userName}</h5>
                    <p className="text-[10px] text-gray-500">
                      {new Date(review.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${s <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`}
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
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    hasVoted ? 'text-blue-600 cursor-default' : 'text-gray-400 hover:text-blue-600'
                  }`}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-blue-600' : ''}`} /> Helpful
                  {helpfulCount > 0 && <span>({helpfulCount})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => toggleReply(review.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Reply
                </button>
              </div>

              {reviewReplies.length > 0 && (
                <div className="mt-3 space-y-2 pl-4 border-l-2 border-blue-100">
                  {reviewReplies.map((r) => (
                    <p key={r.id} className="text-xs text-gray-600">
                      {r.text}
                    </p>
                  ))}
                </div>
              )}

              {openReplyId === review.id && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyDrafts[review.id] ?? ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                    }
                    placeholder="Write a reply…"
                    className="flex-grow text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => submitReply(review.id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-2"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showWriteReview ? (
        <div className="w-full p-6 bg-white border-2 border-blue-100 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setNewReview((prev) => ({ ...prev, rating: s }))}
                aria-label={`Rate ${s} star${s !== 1 ? 's' : ''}`}
              >
                <Star
                  className={`w-6 h-6 ${s <= newReview.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`}
                />
              </button>
            ))}
          </div>
          <input
            type="text"
            value={newReview.userName}
            onChange={(e) => setNewReview((prev) => ({ ...prev, userName: e.target.value }))}
            placeholder="Your name"
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={newReview.comment}
            onChange={(e) => setNewReview((prev) => ({ ...prev, comment: e.target.value }))}
            placeholder="Share your experience…"
            rows={3}
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submitNewReview}
              disabled={!newReview.comment.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              Submit Review
            </button>
            <button
              type="button"
              onClick={() => setShowWriteReview(false)}
              className="px-5 py-2.5 text-gray-500 font-bold text-sm rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
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
