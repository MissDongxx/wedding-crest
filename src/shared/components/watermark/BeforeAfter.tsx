'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface BeforeAfterProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeAlt?: string;
  afterAlt?: string;
  layout?: 'slider' | 'side-by-side';
}

export const BeforeAfter: React.FC<BeforeAfterProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  beforeAlt = 'Before',
  afterAlt = 'After',
  layout = 'slider',
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current || layout !== 'slider') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in event ? event.touches[0].clientX : (event as React.MouseEvent).clientX;
    const position = ((x - rect.left) / rect.width) * 100;

    setSliderPosition(Math.max(0, Math.min(100, position)));
  };

  if (layout === 'side-by-side') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full px-4">
        <div className="flex flex-col gap-5">
          <div className="flex justify-center">
            <span className="inline-flex items-center rounded-full bg-red-100 px-6 py-2 text-lg font-black text-red-700 ring-1 ring-inset ring-red-700/20 shadow-sm transition-all hover:scale-105">
              {beforeLabel}
            </span>
          </div>
          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl shadow-2xl border-[6px] border-white/10 bg-muted/20 transition-transform hover:scale-[1.01]">
            <Image
              src={beforeImage}
              alt={beforeAlt}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex justify-center">
            <span className="inline-flex items-center rounded-full bg-green-100 px-6 py-2 text-lg font-black text-green-700 ring-1 ring-inset ring-green-700/20 shadow-sm transition-all hover:scale-105">
              {afterLabel}
            </span>
          </div>
          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl shadow-2xl border-[6px] border-white/10 bg-muted/20 transition-transform hover:scale-[1.01]">
            <Image
              src={afterImage}
              alt={afterAlt}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[3/2] overflow-hidden rounded-xl shadow-2xl border-4 border-white/10 group cursor-col-resize select-none"
      onMouseMove={(e) => handleMove(e)}
      onTouchMove={(e) => handleMove(e)}
    >
      {/* After Image (Background) */}
      <div className="absolute inset-0">
        <Image
          src={afterImage}
          alt={afterAlt}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute bottom-4 right-12 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          {afterLabel}
        </div>
      </div>

      {/* Before Image (Foreground with Clip) */}
      <div
        className="absolute inset-0 z-10"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <Image
          src={beforeImage}
          alt={beforeAlt}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute bottom-4 left-12 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {beforeLabel}
        </div>
      </div>

      {/* Slider Handle */}
      <div
        className="absolute top-0 bottom-0 z-20 w-1 bg-white cursor-col-resize"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-3 bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
