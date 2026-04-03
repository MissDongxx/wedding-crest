'use client';

import { useEffect, useState } from 'react';

const ICON_COUNT = 5;

interface GeminiIconData {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  dx: number;
  dy: number;
}

function generateIcons(): GeminiIconData[] {
  return Array.from({ length: ICON_COUNT }, () => ({
    x: Math.random() * 90,
    y: Math.random() * 90,
    size: 180 + Math.random() * 220,
    duration: 30 + Math.random() * 40,
    delay: Math.random() * -40,
    dx: (Math.random() - 0.5) * 20,
    dy: (Math.random() - 0.5) * 20,
  }));
}

export function GeminiBackground() {
  const [icons, setIcons] = useState<GeminiIconData[] | null>(null);

  useEffect(() => {
    setIcons(generateIcons());
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {icons && icons.map((icon, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="absolute fill-primary/[0.04]"
          width={icon.size}
          height={icon.size}
          style={{
            left: `${icon.x}%`,
            top: `${icon.y}%`,
            animation: `gemini-float-${i} ${icon.duration}s ease-in-out ${icon.delay}s infinite alternate`,
          }}
        >
          <path d="M11.5 21.5C11.5 16.2533 7.2467 12 2 12C7.2467 12 11.5 7.7467 11.5 2.5C11.5 7.7467 15.7533 12 21 12C15.7533 12 11.5 16.2533 11.5 21.5Z" />
        </svg>
      ))}
      {icons && (
      <style>
        {icons
          .map(
            (icon, i) =>
              `@keyframes gemini-float-${i} { 0% { transform: translate(0, 0); } 100% { transform: translate(${icon.dx}vw, ${icon.dy}vh); } }`
          )
          .join('\n')}
      </style>
      )}
    </div>
  );
}
