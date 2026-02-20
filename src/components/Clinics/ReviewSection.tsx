import React from "react";
import { Star, MessageSquare, ThumbsUp } from "lucide-react";
import { ClinicReview } from "@/types/clinic";

interface ReviewSectionProps {
  reviews: ClinicReview[];
  averageRating: number;
}

export default function ReviewSection({
  reviews,
  averageRating,
}: ReviewSectionProps) {
  return (
    <div className="space-y-8">
      {/* Rating Summary Header */}
      <div className="bg-blue-900 text-white rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
        <div className="text-center md:text-left">
          <div className="text-6xl font-black mb-2">
            {averageRating.toFixed(1)}
          </div>
          <div className="flex items-center justify-center md:justify-start gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-5 h-5 ${s <= Math.round(averageRating) ? "text-yellow-400 fill-yellow-400" : "text-blue-800 fill-blue-800"}`}
              />
            ))}
          </div>
          <div className="text-blue-300 text-sm font-bold uppercase tracking-widest">
            {reviews.length} Total Reviews
          </div>
        </div>

        <div className="hidden md:block h-20 w-px bg-blue-800 shrink-0"></div>

        <div className="flex-grow space-y-2 w-full max-w-sm">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = reviews.filter((r) => r.rating === score).length;
            const percentage =
              reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={score} className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-200 w-3">
                  {score}
                </span>
                <div className="flex-grow h-2 bg-blue-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-blue-300 w-6 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reviews.map((review) => (
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
                  <h5 className="font-bold text-gray-900 text-sm">
                    {review.userName}
                  </h5>
                  <p className="text-[10px] text-gray-500">
                    {new Date(review.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-200"}`}
                  />
                ))}
              </div>
            </div>

            <blockquote className="text-gray-600 text-sm italic leading-relaxed mb-6 flex-grow">
              &quot;{review.comment}&quot;
            </blockquote>

            <div className="flex items-center gap-4 mt-auto pt-4 border-t border-gray-100/50">
              <button className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors">
                <ThumbsUp className="w-3.5 h-3.5" /> Helpful
              </button>
              <button className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors">
                <MessageSquare className="w-3.5 h-3.5" /> Reply
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full py-4 bg-white border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-3xl hover:bg-blue-50 transition-all active:scale-[0.99] shadow-sm">
        + Write a Review
      </button>
    </div>
  );
}
