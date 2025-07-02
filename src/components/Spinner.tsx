import React from 'react';

const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <div 
    className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    style={{ width: size, height: size }}
    role="status"
    aria-label="Loading"
  >
    <span className="sr-only">Loading...</span>
  </div>
);

export default Spinner;