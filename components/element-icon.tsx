'use client';

import React from 'react';

export interface ElementIconProps {
  element: string;
  size?: number | string;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
  badgeMode?: boolean;
}

export const ELEMENT_PALETTES: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    text: string;
    glow: string;
  }
> = {
  Glacio: {
    color: '#38bdf8',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/20',
  },
  Fusion: {
    color: '#fb7185',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/20',
  },
  Electro: {
    color: '#c084fc',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  Aero: {
    color: '#34d399',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  Spectro: {
    color: '#fbbf24',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  Havoc: {
    color: '#e879f9',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-400',
    glow: 'shadow-fuchsia-500/20',
  },
};

function renderElementSvg(element: string, size: number | string, color: string) {
  switch (element) {
    case 'Glacio':
      // Ice crystal / frost snowflake
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M12 2v20M2 12h20" />
          <path d="m4.93 4.93 14.14 14.14M4.93 19.07 19.07 4.93" />
          <circle cx="12" cy="12" r="2.5" fill={color} fillOpacity="0.4" />
        </svg>
      );

    case 'Fusion':
      // Flame / fire spark
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          <circle cx="12" cy="15" r="1.5" fill={color} fillOpacity="0.5" />
        </svg>
      );

    case 'Electro':
      // Lightning bolt
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill={color} fillOpacity="0.3" />
        </svg>
      );

    case 'Aero':
      // Wind gust / vortex
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
          <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
          <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
        </svg>
      );

    case 'Spectro':
      // Solar radiance / light star
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" fill={color} fillOpacity="0.4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      );

    case 'Havoc':
      // Dark crescent / eclipse orbit
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill={color} fillOpacity="0.3" />
          <circle cx="12" cy="12" r="1.5" fill={color} />
        </svg>
      );

    default:
      // Neutral diamond
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <polygon points="12 2 22 12 12 22 2 12" />
        </svg>
      );
  }
}

export function ElementIcon({
  element,
  size = 14,
  className = '',
  showLabel = false,
  labelClassName = '',
  badgeMode = false,
}: ElementIconProps) {
  const palette = ELEMENT_PALETTES[element] || {
    color: '#94a3b8',
    bg: 'bg-secondary/40',
    border: 'border-border',
    text: 'text-foreground',
    glow: '',
  };

  const svg = renderElementSvg(element, size, palette.color);

  if (badgeMode) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold border ${palette.bg} ${palette.border} ${palette.text} ${className}`}
        title={`Hệ: ${element}`}
      >
        {svg}
        {showLabel && <span className={labelClassName}>{element}</span>}
      </span>
    );
  }

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${palette.text} ${className}`}>
        {svg}
        <span className={labelClassName}>{element}</span>
      </span>
    );
  }

  return <span className={`inline-flex items-center ${className}`}>{svg}</span>;
}
