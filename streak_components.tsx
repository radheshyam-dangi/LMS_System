function useAnimatedValue(targetValue: number, duration: number = 800) {
  const [value, setValue] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setValue(targetValue);
      prevTargetRef.current = targetValue;
      return;
    }

    const startValue = prevTargetRef.current;
    if (startValue === targetValue) {
      setValue(targetValue);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentVal = Math.round(startValue + (targetValue - startValue) * easeProgress);
      setValue(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        prevTargetRef.current = targetValue;
      }

    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration]);

  return value;
}

function TraineeProgressRing({ 
  progressPercent, 
  currentPathTitle,
  onPathClick,
  completedLessons,
  totalLessons
}: { 
  progressPercent: number; 
  currentPathTitle: string; 
  onPathClick: () => void;
  completedLessons: number;
  totalLessons: number;
}) {
  const animatedPercent = useAnimatedValue(progressPercent, 1000);
  const [strokeOffset, setStrokeOffset] = useState(251); // 251 is full circumference
  const [showTooltip, setShowTooltip] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetOffset = 251 - (251 * progressPercent) / 100;
    
    if (prefersReducedMotion) {
      setStrokeOffset(targetOffset);
    } else {
      // Trigger animation slightly after mount
      const timer = setTimeout(() => {
        setStrokeOffset(targetOffset);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progressPercent]);

  useEffect(() => {
    if (progressPercent === 100) {
      const timer = setTimeout(() => setShowCheckmark(true), 800);
      return () => clearTimeout(timer);
    } else {
      setShowCheckmark(false);
    }
  }, [progressPercent]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
      <div
        style={{ position: 'relative', width: '130px', height: '130px', cursor: 'pointer', outline: 'none' }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onClick={onPathClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPathClick(); }}
        tabIndex={0}
        role="button"
        aria-label={`${currentPathTitle}: ${progressPercent}% complete`}
      >
        <svg width="130" height="130" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="10"
            strokeDasharray="251"
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {showCheckmark ? (
            <div style={{
              fontSize: '32px', color: '#10b981', 
              animation: 'popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>✓</div>
          ) : (
            <>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{animatedPercent}%</span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete</span>
            </>
          )}
        </div>
        
        {/* CSS for popIn animation (inlined for safety) */}
        <style>{`
          @keyframes popIn {
            0% { transform: scale(0); opacity: 0; }
            70% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {showTooltip && (
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{currentPathTitle} — {progressPercent}% complete</div>
            <div style={{ color: '#cbd5e1' }}>{completedLessons} of {totalLessons || 1} lessons completed</div>
            {/* Tooltip triangle */}
            <div style={{
              position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
              borderTop: '4px solid #0f172a'
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function StreakCard({ currentStreak }: { currentStreak: number }) {
  const animatedStreak = useAnimatedValue(currentStreak, 800);
  const prevStreakRef = useRef(currentStreak);
  const flameRef = useRef<HTMLDivElement>(null);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    // On load, prevStreak is currentStreak. If it changes and increments:
    if (prevStreakRef.current !== undefined && currentStreak > prevStreakRef.current) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      setBounce(true);
      setTimeout(() => setBounce(false), 300);

      // Check milestones
      let particleCount = 20;
      if (currentStreak === 7) { setMilestoneMsg("7-day streak! 🔥"); particleCount = 35; }
      else if (currentStreak === 30) { setMilestoneMsg("30-day streak! 🏆"); particleCount = 40; }
      else if (currentStreak === 100) { setMilestoneMsg("100-day streak! 💎"); particleCount = 50; }
      else { setMilestoneMsg(null); }

      // Fire confetti from flame
      if (!prefersReducedMotion && flameRef.current) {
        const rect = flameRef.current.getBoundingClientRect();
        const originX = (rect.left + rect.width / 2) / window.innerWidth;
        const originY = (rect.top + rect.height / 2) / window.innerHeight;
        
        confetti({
          particleCount,
          spread: 50,
          origin: { x: originX, y: originY },
          colors: ['#4f46e5', '#ea580c', '#10b981', '#ec4899'],
          disableForReducedMotion: true,
          zIndex: 9999
        });
      }
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak]);

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      <div 
        ref={flameRef}
        style={{ 
          width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a',
          transform: bounce ? 'scale(1.3)' : 'scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
        🔥
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
        {animatedStreak} days
      </div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>Current Streak</div>
      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
        {milestoneMsg ? milestoneMsg : (currentStreak === 0 ? 'Submit a task to start!' : 'Keep it up!')}
      </div>
    </div>
  );
}

