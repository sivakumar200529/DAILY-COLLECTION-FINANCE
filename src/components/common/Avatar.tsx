import React from 'react';

/** Shows the person's photo when one exists, otherwise their initials. */
export const Avatar: React.FC<{ src?: string; name: string; className: string }> = ({ src, name, className }) => {
  if (src) return <img src={src} alt={name} className={`object-cover ${className}`} />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  return (
    <div className={`flex items-center justify-center bg-navy-800 text-gold-300 font-bold ${className}`} aria-label={name}>
      {initials || '?'}
    </div>
  );
};
