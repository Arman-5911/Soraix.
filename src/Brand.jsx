import React, { useId } from "react";
import { Link } from "react-router-dom";

export default function Brand({ mode = "anime" }) {
  const name = mode[0].toUpperCase() + mode.slice(1);
  const gradient = useId();
  return (
    <Link to="/" className="logo soraix-brand" data-brand-mode={mode} aria-label={`SoraiX ${name} home`}>
      <svg className="soraix-mark" viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--brand-light)" />
          <stop offset=".45" stopColor="var(--brand-color)" />
          <stop offset="1" stopColor="var(--brand-deep)" />
        </linearGradient></defs>
        <rect x="1" y="1" width="62" height="62" rx="19" fill="#101725" stroke="var(--brand-color)" strokeOpacity=".45" />
        <path d="M11 15c16-4 22 12 28 22 5 8 9 10 16 10-15 9-24-5-31-17-4-7-7-12-13-15Z" fill={`url(#${gradient})`} />
        <path d="M49 10c-1 13-7 18-16 26-8 7-14 11-18 19 0-14 6-23 16-31 7-5 13-8 18-14Z" fill={`url(#${gradient})`} />
        <path d="M19 17c8 3 12 12 16 19" fill="none" stroke="var(--brand-light)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="m49 17 1.5 4.5L55 23l-4.5 1.5L49 29l-1.5-4.5L43 23l4.5-1.5L49 17Z" fill="var(--brand-light)" />
      </svg>
      <span className="soraix-lockup">
        <span className="soraix-wordmark">Sorai<span className="soraix-letter-x">X</span></span>
        <small className="brand-mode">{name}</small>
      </span>
    </Link>
  );
}
