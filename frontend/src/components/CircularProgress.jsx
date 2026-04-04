import React, { useEffect, useState } from 'react';

const CircularProgress = ({ score, max = 8, label = "Sleep Score" }) => {
  const [offset, setOffset] = useState(0);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  // Animate on mount
  useEffect(() => {
    const progress = score / max;
    const strokeDashoffset = circumference - progress * circumference;
    
    // Slight delay for smooth animation trigger
    const timer = setTimeout(() => {
      setOffset(strokeDashoffset);
    }, 100);

    return () => clearTimeout(timer);
  }, [score, max, circumference]);

  return (
    <div className="circle-progress-wrapper">
      <svg className="circle-svg" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-cyan)" />
            <stop offset="100%" stopColor="var(--accent-purple)" />
          </linearGradient>
        </defs>
        
        {/* Background track */}
        <circle 
          className="circle-bg"
          cx="100" cy="100" r={radius} 
        />
        
        {/* Animated colored bar */}
        <circle 
          className="circle-bar"
          cx="100" cy="100" r={radius} 
          strokeDasharray={circumference}
          strokeDashoffset={offset === 0 ? circumference : offset}
        />
      </svg>
      
      {/* Inner text */}
      <div className="circle-text">
        <div className="score">{score}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
};

export default CircularProgress;
