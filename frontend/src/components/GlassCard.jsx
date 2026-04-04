import React from 'react';

// Reusable animated glassmorphism container
const GlassCard = ({ children, className = '', style = {} }) => {
  return (
    <div className={`glass-panel ${className}`} style={style}>
      {children}
    </div>
  );
};

export default GlassCard;
