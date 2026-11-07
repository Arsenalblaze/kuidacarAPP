import React from 'react';
import { Star } from 'lucide-react';

type Props = {
  value?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
  className?: string;
};

export default function StarRating({ value = 0, onChange, readOnly = false, size = 20, className = '' }: Props) {
  const handleClick = (v: number) => {
    if (readOnly) return;
    onChange?.(v);
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= (value || 0);
        return (
          <button
            key={i}
            type="button"
            aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
            onClick={() => handleClick(i)}
            className={`p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 ${readOnly ? 'cursor-default' : 'hover:scale-110'} `}
          >
            <Star size={size} className={filled ? 'text-yellow-400' : 'text-gray-300'} />
          </button>
        );
      })}
    </div>
  );
}
