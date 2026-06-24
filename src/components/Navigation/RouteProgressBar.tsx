import React, { useState, useEffect } from "react";
import Router from "next/router";

export default function RouteProgressBar() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const handleStart = () => {
      setVisible(true);
      setProgress(10);
      clearInterval(interval);

      // Simulate step progress increments to make the bar feel responsive
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          const increment = Math.random() * 10;
          return prev + increment;
        });
      }, 250);
    };

    const handleComplete = () => {
      clearInterval(interval);
      setProgress(100);
      
      // Delay fade out to allow 100% state to render clearly
      timer = setTimeout(() => {
        setVisible(false);
        // Reset progress after fade out animation
        setTimeout(() => setProgress(0), 300);
      }, 200);
    };

    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeComplete", handleComplete);
    Router.events.on("routeChangeError", handleComplete);

    return () => {
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeComplete", handleComplete);
      Router.events.off("routeChangeError", handleComplete);
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 w-full h-[3px] z-[9999] pointer-events-none transition-all duration-300 ease-out"
      style={{
        width: `${progress}%`,
        background: "linear-gradient(90deg, #3b82f6 0%, #d946ef 50%, #6366f1 100%)",
        boxShadow: "0 0 8px rgba(99, 102, 241, 0.6)",
      }}
    />
  );
}
