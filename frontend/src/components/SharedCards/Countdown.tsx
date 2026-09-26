import React, { useState, useEffect } from 'react';

export function Countdown({ deadline }: { deadline: string | Date }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const targetDate = new Date(deadline).getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
      } else {
        setIsExpired(false);
        setTimeLeft(difference);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (isExpired) {
    return <span style={{ color: '#dc2626', fontWeight: 700 }}>Expired</span>;
  }

  const hours = Math.floor((timeLeft / (1000 * 60 * 60)));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  const isWarning = hours < 1;
  const color = isWarning ? '#dc2626' : 'inherit';
  const fontWeight = isWarning ? 700 : 'inherit';

  const formatUnit = (unit: number) => unit.toString().padStart(2, '0');

  return (
    <span style={{ color, fontWeight, fontVariantNumeric: 'tabular-nums' }}>
      {formatUnit(hours)}:{formatUnit(minutes)}:{formatUnit(seconds)}
    </span>
  );
}
