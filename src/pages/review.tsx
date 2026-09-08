import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Star, Shield, CheckCircle, ExternalLink, Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useRating } from '@/hooks/useRating';
import { useWallet } from '@/hooks/useWallet';
import { GetServerSideProps } from 'next';

const STAR_LABELS = ['Terrible', 'Poor', 'Average', 'Good', 'Excellent'];

interface RatingStats {
  total_reviews: number;
  average_rating: number;
  rating_counts: number[];
}

const DEFAULT_STATS: RatingStats = {
  total_reviews: 0,
  average_rating: 0,
  rating_counts: [0, 0, 0, 0, 0],
};

function StarRating({
  value,
  hoverValue,
  onSelect,
  onHover,
  onLeave,
  disabled,
}: {
  value: number;
  hoverValue: number;
  onSelect: (n: number) => void;
  onHover: (n: number) => void;
  onLeave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hoverValue || value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onSelect(star)}
            onMouseEnter={() => onHover(star)}
            onMouseLeave={onLeave}
            disabled={disabled}
            className={`p-1 rounded-lg transition-all duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-110'
            }`}
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function RatingDistribution({ stats }: { stats: RatingStats }) {
  const getPercentage = (stars: number) => {
    if (stats.total_reviews === 0) return 0;
    return Math.round(((stats.rating_counts[stars - 1] || 0) / stats.total_reviews) * 100);
  };

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((stars) => (
        <div key={stars} className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-12 shrink-0">{stars} star</span>
          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(stars)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-8 text-right tabular-nums">
            {getPercentage(stars)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ExistingReview({
  review,
  isVerifying,
  onVerify,
}: {
  review: { rating: number; comment: string; transaction_hash: string };
  isVerifying: boolean;
  onVerify: () => void;
}) {
  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-5 h-5 ${i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">
        {STAR_LABELS[review.rating - 1]}
      </p>
      <p className="text-gray-700 mb-4">{review.comment}</p>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          Tx: {review.transaction_hash.slice(0, 10)}...{review.transaction_hash.slice(-8)}
        </span>
        <button
          onClick={onVerify}
          disabled={isVerifying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Shield className="w-3 h-3" />
              Verify
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ReviewForm({
  rating,
  review,
  isSubmitting,
  onSubmit,
  onRatingChange,
  onReviewChange,
}: {
  rating: number;
  review: string;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onRatingChange: (n: number) => void;
  onReviewChange: (s: string) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-3">
          Your Rating
        </label>
        <StarRating
          value={rating}
          hoverValue={hoverRating}
          onSelect={onRatingChange}
          onHover={setHoverRating}
          onLeave={() => setHoverRating(0)}
          disabled={isSubmitting}
        />
        {rating > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            {STAR_LABELS[rating - 1]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="review-text" className="block text-sm font-medium text-gray-600 mb-2">
          Your Review
        </label>
        <textarea
          id="review-text"
          value={review}
          onChange={(e) => onReviewChange(e.target.value)}
          rows={4}
          maxLength={500}
          disabled={isSubmitting}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none ring-blue-500/30 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 transition-all resize-none"
          placeholder="Share your experience with PetChain..."
          required
        />
        <p className="mt-1 text-xs text-gray-400 text-right">
          {review.length}/500 characters
        </p>
      </div>

      <button
        type="submit"
        disabled={rating === 0 || isSubmitting}
        className="h-12 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </span>
        ) : (
          'Submit Review'
        )}
      </button>
    </form>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedWallet } = useWallet();

  const { submitReview, getUserReview, getRatingStats, verifyReview, isLoading, error, clearError } = useRating();

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [stats, setStats] = useState<RatingStats>(DEFAULT_STATS);
  const [userReview, setUserReview] = useState<{ rating: number; comment: string; transaction_hash: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  const publicKey = selectedWallet?.publicKey;

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load stats and existing review
  useEffect(() => {
    const load = async () => {
      setStatsLoading(true);
      const [s, existing] = await Promise.all([
        getRatingStats(),
        publicKey ? getUserReview(publicKey) : Promise.resolve(null),
      ]);
      setStats(s);
      if (existing) {
        setUserReview(existing);
        setRating(existing.rating);
        setReview(existing.comment);
        setTransactionHash(existing.transaction_hash);
      }
      setStatsLoading(false);
    };
    if (isAuthenticated) {
      load();
    }
  }, [isAuthenticated, publicKey, getRatingStats, getUserReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    clearError();
    const result = await submitReview(rating, review);

    if (result.success && result.txHash) {
      setTransactionHash(result.txHash);
      setSubmitted(true);

      // Refresh stats
      const s = await getRatingStats();
      setStats(s);

      // Refresh user review
      if (publicKey) {
        const existing = await getUserReview(publicKey);
        if (existing) {
          setUserReview(existing);
        }
      }

      setTimeout(() => setSubmitted(false), 5000);
    }
  };

  const handleVerify = async () => {
    if (!publicKey || !transactionHash) return;
    setIsVerifying(true);
    try {
      const valid = await verifyReview(publicKey, transactionHash);
      alert(valid ? 'Review verified on blockchain!' : 'Review verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Rate Us | PetChain</title>
        <meta name="description" content="Rate your experience with PetChain. Your feedback helps us improve." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 p-4 md:p-8 flex flex-col transition-all duration-300">
        <div className="mx-auto max-w-4xl w-full">

          {/* Header */}
          <div className="mb-6 md:mb-8 bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg transition-all duration-300">
            <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 drop-shadow-sm">
              Rate Your Experience
            </h1>
            <p className="mt-1 text-sm md:text-base text-gray-600">
              Your feedback helps us improve our decentralized platform
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm"
            >
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-red-500 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Stats + Distribution */}
          {statsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="h-40 rounded-3xl bg-white/60 animate-pulse border border-gray-100" />
              <div className="h-40 rounded-3xl bg-white/60 animate-pulse border border-gray-100" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Average rating */}
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center">
                <p className="text-5xl font-extrabold text-blue-700">
                  {stats.average_rating.toFixed(1)}
                </p>
                <div className="flex gap-1 my-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i <= Math.round(stats.average_rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  Based on {stats.total_reviews} blockchain-verified review{stats.total_reviews !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Distribution */}
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300">
                <h2 className="text-sm font-semibold text-gray-500 mb-4">
                  Rating Distribution
                </h2>
                <RatingDistribution stats={stats} />
              </div>
            </div>
          )}

          {/* Review form / existing review / success */}
          <div className="bg-white/60 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 mb-6">
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-green-700 mb-2">Review submitted!</h2>
                <p className="text-sm text-gray-500 mb-2">
                  Transaction:{' '}
                  <span className="font-mono text-gray-700">
                    {transactionHash?.slice(0, 10)}...{transactionHash?.slice(-8)}
                  </span>
                </p>
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Verify on Blockchain
                    </>
                  )}
                </button>
              </div>
            ) : userReview ? (
              <div>
                <h2 className="text-lg font-bold text-blue-700 mb-4">Your Review</h2>
                <ExistingReview
                  review={userReview}
                  isVerifying={isVerifying}
                  onVerify={handleVerify}
                />
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-blue-700 mb-6">Write a Review</h2>
                {!publicKey && (
                  <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    Connect your wallet to submit a review
                  </div>
                )}
                <ReviewForm
                  rating={rating}
                  review={review}
                  isSubmitting={isLoading}
                  onSubmit={handleSubmit}
                  onRatingChange={setRating}
                  onReviewChange={setReview}
                />
              </div>
            )}
          </div>

          {/* Blockchain Transparency */}
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 mb-6">
            <h2 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Blockchain Transparency
            </h2>
            <div className="space-y-3 text-sm text-gray-600">
              {[
                ['On-Chain Storage', 'All reviews are permanently stored on the Stellar blockchain'],
                ['Immutable', 'Once submitted, reviews cannot be altered or removed'],
                ['Verifiable', 'Each review has a unique transaction hash for verification'],
                ['Transparent', 'Anyone can verify the authenticity of reviews'],
                ['One Per User', 'Each wallet address can submit only one review'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-700">{title}:</span>{' '}
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-blue-50/50 backdrop-blur-sm p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-blue-600 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              All reviews are recorded on the blockchain for transparency. Please ensure your review is genuine and helpful to other users.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
