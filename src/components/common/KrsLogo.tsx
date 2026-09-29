import React from 'react';

interface KrsLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  showTagline?: boolean;
  className?: string;
  variant?: 'horizontal' | 'vertical' | 'badge-only';
}

export const KrsLogo: React.FC<KrsLogoProps> = ({
  size = 'md',
  className = '',
  variant = 'horizontal',
}) => {
  const sizeConfig = {
    sm: {
      badge: 'w-8 h-8',
      textKrs: 'text-base',
      textFinance: 'text-base',
    },
    md: {
      badge: 'w-11 h-11',
      textKrs: 'text-xl md:text-2xl',
      textFinance: 'text-xl md:text-2xl',
    },
    lg: {
      badge: 'w-16 h-16',
      textKrs: 'text-3xl md:text-4xl',
      textFinance: 'text-3xl md:text-4xl',
    },
    xl: {
      badge: 'w-20 h-20 md:w-24 md:h-24',
      textKrs: 'text-4xl md:text-5xl',
      textFinance: 'text-4xl md:text-5xl',
    },
  }[size];

  // Official Gold Coin & Indian Rupee (₹) Finance Symbol Insignia
  const LogoInsignia = (
    <div className={`relative ${sizeConfig.badge} rounded-2xl bg-gradient-to-br from-gold-400 via-amber-500 to-gold-700 p-0.5 shadow-xl shadow-gold-500/25 flex-shrink-0 group`}>
      <div className="w-full h-full bg-navy-950 rounded-[14px] flex items-center justify-center relative overflow-hidden border border-gold-400/30">
        {/* Subtle radial gold glow inside */}
        <div className="absolute inset-0 bg-gradient-to-tr from-gold-500/20 via-amber-500/10 to-transparent" />
        
        {/* Authentic Finance Symbol SVG: Gold Medallion + Indian Rupee (₹) + Growth Trend */}
        <svg 
          viewBox="0 0 64 64" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-4/5 h-4/5 relative z-10 drop-shadow-[0_2px_6px_rgba(217,119,6,0.6)]"
        >
          <defs>
            {/* Gold Medallion Outer Rim */}
            <linearGradient id="coinGoldRim" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="35%" stopColor="#F59E0B" />
              <stop offset="70%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>

            {/* Inner Dark Velvet Disc */}
            <radialGradient id="coinInnerBg" cx="32" cy="32" r="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="65%" stopColor="#0B132B" />
              <stop offset="100%" stopColor="#030712" />
            </radialGradient>

            {/* 3D Rupee Currency Gold Gradient */}
            <linearGradient id="rupeeGold" x1="20" y1="16" x2="44" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="25%" stopColor="#FDE68A" />
              <stop offset="55%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>

            {/* Financial Growth Trajectory */}
            <linearGradient id="growthGreen" x1="16" y1="46" x2="48" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Outer Gold Coin Medallion */}
          <circle cx="32" cy="32" r="30" fill="url(#coinGoldRim)" />
          <circle cx="32" cy="32" r="27.5" fill="#0A0F1D" stroke="#FDE68A" strokeWidth="0.8" />

          {/* Security Coin Dots */}
          <circle cx="32" cy="6.5" r="1.2" fill="#FDE68A" />
          <circle cx="50" cy="14" r="1.2" fill="#FDE68A" />
          <circle cx="57.5" cy="32" r="1.2" fill="#FDE68A" />
          <circle cx="50" cy="50" r="1.2" fill="#FDE68A" />
          <circle cx="32" cy="57.5" r="1.2" fill="#FDE68A" />
          <circle cx="14" cy="50" r="1.2" fill="#FDE68A" />
          <circle cx="6.5" cy="32" r="1.2" fill="#FDE68A" />
          <circle cx="14" cy="14" r="1.2" fill="#FDE68A" />

          {/* Inner Financial Core */}
          <circle cx="32" cy="32" r="24.5" fill="url(#coinInnerBg)" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.5" />

          {/* Upward Financial Growth Curve (Ascending Trajectory) */}
          <path d="M16 44 C 22 46, 36 41, 46 22" stroke="url(#growthGreen)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M42 19 L 47 21 L 45 26" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Precision Indian Rupee (₹) Symbol */}
          {/* Top Primary Bar */}
          <path d="M21 19 H42" stroke="url(#rupeeGold)" strokeWidth="3.4" strokeLinecap="round" />
          {/* Second Parallel Bar */}
          <path d="M21 25.5 H37" stroke="url(#rupeeGold)" strokeWidth="3.4" strokeLinecap="round" />
          {/* R Spine & Loop */}
          <path d="M26.5 19 V33 C32.5 33 36.5 31 36.5 26.5 C36.5 22 32.5 20 26.5 20" stroke="url(#rupeeGold)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Downward Angled Leg */}
          <path d="M26.5 32.5 L 39 46" stroke="url(#rupeeGold)" strokeWidth="3.6" strokeLinecap="round" />

          {/* Prosperity Sparkle */}
          <path d="M45 13 Q45 10 47 10 Q45 10 45 7 Q45 10 43 10 Q45 10 45 13 Z" fill="#FDE68A" />
        </svg>

        {/* Shimmer sweep effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </div>
  );

  if (variant === 'badge-only') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{LogoInsignia}</div>;
  }

  return (
    <div className={`inline-flex ${variant === 'vertical' ? 'flex-col items-center text-center' : 'items-center text-left'} gap-3 ${className}`}>
      {LogoInsignia}

      <div>
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <span className={`font-royal font-black tracking-wider text-white ${sizeConfig.textKrs} drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]`}>
            DAILY
          </span>
          <span className={`font-royal font-black tracking-wider bg-gradient-to-r from-gold-300 via-amber-400 to-gold-500 bg-clip-text text-transparent ${sizeConfig.textFinance} drop-shadow-[0_2px_12px_rgba(217,119,6,0.3)]`}>
            COLLECTION
          </span>
        </div>
      </div>
    </div>
  );
};
