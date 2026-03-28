import { useState, useEffect } from 'react';
import { useRating } from '../hooks/useRating';
import { useWalletBalance } from '../hooks/useWalletBalance';
import React from 'react';

function Rate() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [ratingStats, setRatingStats] = useState({
    total_reviews: 0,
    average_rating: 0,
    rating_counts: [0, 0, 0, 0, 0],
  });
  const [userReview, setUserReview] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  const { balance } = useWalletBalance();
  const publicKey = balance?.publicKey;
  const {
    submitReview,
    getUserReview,
    getRatingStats,
    verifyReview,
    isLoading,
    error
  } = useRating();

  // Load rating stats on component mount
  useEffect(() => {
    const loadRatingStats = async () => {
      try {
        const stats = await getRatingStats();
        setRatingStats(stats);
      } catch (err) {
        console.error('Error loading rating stats:', err);
      }
    };

    loadRatingStats();
  }, [getRatingStats]);

  // Load user's existing review
  useEffect(() => {
    const loadUserReview = async () => {
      if (publicKey) {
        try {
          const review = await getUserReview(publicKey);
          setUserReview(review);
          if (review) {
            setRating(review.rating);
            setReview(review.comment);
            setTransactionHash(review.transaction_hash);
          }
        } catch (err) {
          console.error('Error loading user review:', err);
        }
      }
    };

    loadUserReview();
  }, [publicKey, getUserReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      return;
    }

    try {
      const result = await submitReview(rating, review);

      if (result.success && result.txHash) {
        setTransactionHash(result.txHash);
        setSubmitted(true);
        setShowVerification(true);

        // Refresh rating stats
        const stats = await getRatingStats();
        setRatingStats(stats);

        // Load user's review
        if (publicKey) {
          const userRev = await getUserReview(publicKey);
          setUserReview(userRev);
        }

        // Reset form after 5 seconds
        setTimeout(() => {
          setSubmitted(false);
          setShowVerification(false);
        }, 5000);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
    }
  };

  const handleVerifyReview = async () => {
    if (!publicKey || !transactionHash) return;

    setIsVerifying(true);
    try {
      const isValid = await verifyReview(publicKey, transactionHash);
      if (isValid) {
        alert('Review verified on blockchain! ✅');
      } else {
        alert('Review verification failed ❌');
      }
    } catch (err) {
      console.error('Error verifying review:', err);
      alert('Error verifying review');
    } finally {
      setIsVerifying(false);
    }
  };

  const renderStars = () => {
    return [...Array(5)].map((_, index) => {
      const starNumber = index + 1;
      const isFilled = starNumber <= (hoverRating || rating);
      return (
        <button
          key={index}
          type="button"
          onClick={() => setRating(starNumber)}
          onMouseEnter={() => setHoverRating(starNumber)}
          onMouseLeave={() => setHoverRating(0)}
          className="p-1 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
          disabled={!!userReview || isLoading}
          aria-label={`Rate ${starNumber} stars`}
        >
          <svg
            className={`w-8 h-8 transition-colors ${isFilled ? 'text-yellow-400 fill-current' : 'text-slate-600'} ${userReview || isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            stroke="currentColor"
            viewBox="0 0 24 24"
            fill={isFilled ? 'currentColor' : 'none'}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      );
    });
  };

  const getRatingPercentage = (stars: number) => {
    if (ratingStats.total_reviews === 0) return 0;
    const count = ratingStats.rating_counts[stars - 1] || 0;
    return Math.round((count / ratingStats.total_reviews) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/20">
          <header className="mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">Rate Wata-Board</h1>
            <p className="mt-2 text-slate-300">Your feedback helps us improve our decentralized utility payment platform</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2 mb-8 border-b border-slate-800 pb-8">
            <div className="p-4 sm:p-6 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">
                  {ratingStats.average_rating.toFixed(1)}
                </div>
                <div className="flex justify-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < Math.floor(ratingStats.average_rating) ? 'text-yellow-400 fill-current' : 'text-slate-600'}`}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-400 text-sm">Based on {ratingStats.total_reviews} blockchain-verified reviews</p>
              </div>
            </div>

            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-12 sm:w-16">{stars} star</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${getRatingPercentage(stars)}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 w-10 text-right">
                    {getRatingPercentage(stars)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 sm:pt-8">
            <h2 className="text-xl font-semibold mb-4">
              {userReview ? 'Your Review' : 'Write a Review'}
            </h2>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {submitted ? (
              <div className="p-4 sm:p-6 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-center">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="font-medium text-lg mb-2">Review submitted to blockchain!</p>
                <p className="text-sm mb-4">Transaction: {transactionHash?.slice(0, 10)}...{transactionHash?.slice(-8)}</p>

                {showVerification && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm">Verify your review on the blockchain:</p>
                    <button
                      onClick={handleVerifyReview}
                      disabled={isVerifying}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? 'Verifying...' : 'Verify Review'}
                    </button>
                  </div>
                )}
              </div>
            ) : userReview ? (
              <div className="p-4 sm:p-6 rounded-xl bg-slate-950/50 border border-slate-800">
                <div className="mb-4">
                  <div className="flex gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-6 h-6 ${i < userReview.rating ? 'text-yellow-400 fill-current' : 'text-slate-600'}`}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-slate-300 mb-3">
                    {['Terrible', 'Poor', 'Average', 'Good', 'Excellent'][userReview.rating - 1]}
                  </p>
                  <p className="text-slate-100 mb-4">{userReview.comment}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Transaction: {userReview.transaction_hash?.slice(0, 10)}...{userReview.transaction_hash?.slice(-8)}</span>
                    <button
                      onClick={handleVerifyReview}
                      disabled={isVerifying}
                      className="px-3 py-1 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-3">Your Rating</label>
                  <div className="flex gap-1 justify-center sm:justify-start">
                    {renderStars()}
                  </div>
                  <p className="mt-2 text-sm text-slate-400 text-center sm:text-left">
                    {rating > 0 && ['Terrible', 'Poor', 'Average', 'Good', 'Excellent'][rating - 1]}
                  </p>
                </div>

                <div>
                  <label htmlFor="review-text" className="block text-sm font-medium text-slate-200 mb-2">Your Review</label>
                  <textarea
                    id="review-text"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none ring-sky-500/30 placeholder:text-slate-500 focus:ring-4 focus:ring-sky-500/20 transition-all resize-none"
                    placeholder="Share your experience with Wata-Board..."
                    required
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-xs text-slate-500 text-right">
                    {review.length}/500 characters
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={rating === 0 || isLoading || !publicKey}
                    className="h-12 rounded-xl bg-sky-500 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 ring-1 ring-inset ring-white/10 transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Submitting...' : 'Submit Review to Blockchain'}
                  </button>

                  {!publicKey && (
                    <p className="text-sm text-amber-300">
                      Connect your wallet to submit a review
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>

          <div className="mt-8 p-4 sm:p-6 rounded-xl bg-slate-950/50 border border-slate-800">
            <h3 className="text-lg font-semibold mb-3 text-slate-100">Blockchain Transparency</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                <span className="font-medium text-slate-100">✅ On-Chain Storage:</span> All reviews are permanently stored on the Stellar blockchain
              </p>
              <p>
                <span className="font-medium text-slate-100">✅ Immutable:</span> Once submitted, reviews cannot be altered or removed
              </p>
              <p>
                <span className="font-medium text-slate-100">✅ Verifiable:</span> Each review has a unique transaction hash for verification
              </p>
              <p>
                <span className="font-medium text-slate-100">✅ Transparent:</span> Anyone can verify the authenticity of reviews
              </p>
              <p>
                <span className="font-medium text-slate-100">✅ One Review Per User:</span> Each wallet address can submit only one review
              </p>
            </div>
          </div>
          <div className="mt-8 p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <p className="text-sm text-sky-300 leading-relaxed">
              <span className="font-medium">Note:</span> All reviews are recorded on the blockchain for transparency.
              Please ensure your review is genuine and helpful to other users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Rate;
