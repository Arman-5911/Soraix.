import React, { useId } from "react";
import { Link } from "react-router-dom";

export default function Brand({ mode = "anime" }) {
  const name = mode[0].toUpperCase() + mode.slice(1);
  const gradient = useId();
  return (
    <Link
      to="/"
      className="logo soraix-brand"
      data-brand-mode={mode}
      aria-label={`SoraiX ${name} home`}
    >
      <svg
        className="soraix-mark"
        viewBox="0 0 64 64"
        width="44"
        height="44"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--brand-light)" />
            <stop offset=".45" stopColor="var(--brand-color)" />
            <stop offset="1" stopColor="var(--brand-deep)" />
          </linearGradient>
          <linearGradient id={`${gradient}-tile`} x1="0" y1="0" x2=".8" y2="1">
            <stop stopColor="#52647d" />
            <stop offset=".35" stopColor="#1d2c40" />
            <stop offset=".7" stopColor="#080f1c" />
            <stop offset="1" stopColor="#263c54" />
          </linearGradient>
          <linearGradient id={`${gradient}-shine`} x1="0" y1="0" x2=".3" y2="1">
            <stop stopColor="#ffffff" stopOpacity=".58" />
            <stop offset="1" stopColor="#e5f6ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradient}-sweep`}>
            <stop stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${gradient}-clip`}>
            <rect x="2" y="2" width="60" height="60" rx="19" />
          </clipPath>
        </defs>
        <rect
          x="1"
          y="1"
          width="62"
          height="62"
          rx="20"
          fill={`url(#${gradient}-tile)`}
          stroke="var(--brand-light)"
          strokeOpacity=".55"
        />
        <rect
          x="3"
          y="3"
          width="58"
          height="58"
          rx="18"
          fill="none"
          stroke="var(--brand-color)"
          strokeOpacity=".18"
        />
        <path
          d="M7 23C7 10 13 5 26 5h12c12 0 18 6 19 14-13 11-31 14-50 4Z"
          fill={`url(#${gradient}-shine)`}
        />
        <g transform="translate(0 2)" opacity=".55">
          <path
            d="M11 15c16-4 22 12 28 22 5 8 9 10 16 10-15 9-24-5-31-17-4-7-7-12-13-15ZM49 10c-1 13-7 18-16 26-8 7-14 11-18 19 0-14 6-23 16-31 7-5 13-8 18-14Z"
            fill="#030711"
          />
        </g>
        <path
          d="M11 15c16-4 22 12 28 22 5 8 9 10 16 10-15 9-24-5-31-17-4-7-7-12-13-15Z"
          fill={`url(#${gradient})`}
        />
        <path
          d="M49 10c-1 13-7 18-16 26-8 7-14 11-18 19 0-14 6-23 16-31 7-5 13-8 18-14Z"
          fill={`url(#${gradient})`}
        />
        <path
          d="M19 17c8 3 12 12 16 19"
          fill="none"
          stroke="var(--brand-light)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M46 15c-4 9-15 14-22 24"
          fill="none"
          stroke="#f1fbff"
          strokeOpacity=".8"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M8 18C9 10 15 6 23 6M41 58c9 0 15-5 17-12"
          fill="none"
          stroke="#e7f6ff"
          strokeOpacity=".65"
          strokeLinecap="round"
        />
        <path
          d="m49 17 1.5 4.5L55 23l-4.5 1.5L49 29l-1.5-4.5L43 23l4.5-1.5L49 17Z"
          fill="var(--brand-light)"
        />
        <g clipPath={`url(#${gradient}-clip)`}>
          <path
            className="brand-light-sweep"
            d="M-42 0h18l42 64H0Z"
            fill={`url(#${gradient}-sweep)`}
          />
        </g>
      </svg>
      <span className="soraix-lockup">
        <span className="soraix-wordmark">
          Sorai<span className="soraix-letter-x">X</span>
        </span>
        <small className="brand-mode">{name}</small>
      </span>
    </Link>
  );
}
