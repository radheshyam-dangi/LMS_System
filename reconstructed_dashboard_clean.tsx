Created At: 2026-08-07T05:19:45Z
Completed At: 2026-08-07T05:19:47Z
The following changes were made by the multi_replace_file_content tool to: e:\LMS_System\LMS_System\frontend\src\pages\DashboardPage.tsx. If relevant, proactively run terminal commands to execute this code for the USER. Don't ask for permission.
[diff_block_start]
@@ -1,5 +1,6 @@
 import { useMemo, useState, useEffect, useRef } from 'react';
 import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
 import { InviteUserModal } from '../components/users/InviteUserModal';
 import { UsersSection } from '../components/users/UserManagement';
 import { LearningPathsSection } from '../components/LearningPathsSection/LearningPathsSection';
@@ -21,6 +21,246 @@
 import { DailyActivityHeatmap } from '../components/DailyActivityHeatmap/DailyActivityHeatmap';
 import type { RoleName, SessionUser } from '../types/auth';
 
// 1. Lightweight number tween hook
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

// 2. Trainee Progress Ring Component
function TraineeProgressRing({ 
  progressPercent, 
  currentPathTitle: string,
  onPathClick: () => void 
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

// 3. Streak Celebration Component
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

 const calculateStreak = (submissions: any[]) => {
   if (!submissions || submissions.length === 0) return 0;
 
[diff_block_end]

Please note that the above snippet only shows the MODIFIED lines from the last change. It shows up to 3 lines of unchanged lines before and after the modified lines. The actual file contents may have many more lines not shown.
Created At: 2026-08-10T10:03:31Z
Completed At: 2026-08-10T10:03:33Z
The following changes were made by the multi_replace_file_content tool to: e:\LMS_System\LMS_System\frontend\src\pages\DashboardPage.tsx. If relevant, proactively run terminal commands to execute this code for the USER. Don't ask for permission.
[diff_block_start]
@@ -17,8 +17,198 @@
 import { ModulesManagementSection } from '../components/ModulePathSection/ModulesManagementSection';
 import { seriesToAreaPath, seriesToPolyline } from '../utils/charts';
 import { useNotifications } from '../context/NotificationContext';
import { DailyActivityHeatmap } from '../components/DailyActivityHeatmap/DailyActivityHeatmap';
import confetti from 'canvas-confetti';
 import type { RoleName, SessionUser } from '../types/auth';
 
function useAnimatedValue(targetValue: number, duration = 800) {
  const [value, setValue] = useState(targetValue);
  const prevTargetRef = useRef(targetValue);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      requestAnimationFrame(() => setValue(targetValue));
      prevTargetRef.current = targetValue;
      return;
    }
    const startValue = prevTargetRef.current;
    if (startValue === targetValue) {
      requestAnimationFrame(() => setValue(targetValue));
      return;
    }
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + (targetValue - startValue) * ease));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevTargetRef.current = targetValue;
      }
    };
    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  return value;
}

function TraineeProgressRing({ progressPercent, completedLessons, totalLessons, currentPathTitle, onPathClick }: any) {
  const animatedPercent = useAnimatedValue(progressPercent, 1000);
  const [strokeOffset, setStrokeOffset] = useState(251);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetOffset = 251 - (251 * progressPercent) / 100;
    if (prefersReducedMotion) {
      requestAnimationFrame(() => setStrokeOffset(targetOffset));
    } else {
      const timer = setTimeout(() => requestAnimationFrame(() => setStrokeOffset(targetOffset)), 100);
      return () => clearTimeout(timer);
    }
  }, [progressPercent]);

  useEffect(() => {
    if (progressPercent === 100) {
      const timer = setTimeout(() => setShowCheckmark(true), 800);
      return () => clearTimeout(timer);
    } else {
      requestAnimationFrame(() => setShowCheckmark(false));
    }
  }, [progressPercent]);

  const toggleTooltip = (e: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip(t => t.visible ? { visible: false, x: 0, y: 0 } : { visible: true, x: rect.width / 2, y: -10 });
  };

  useEffect(() => {
    const handleTouchOutside = () => setTooltip({ visible: false, x: 0, y: 0 });
    document.addEventListener("touchstart", handleTouchOutside);
    return () => document.removeEventListener("touchstart", handleTouchOutside);
  }, []);

  return (
    <div
      style={{ position: 'relative', width: '100%', maxWidth: '130px', margin: '0 auto', cursor: 'pointer', outline: 'none' }}
      tabIndex={0}
      role="button"
      aria-label={`${progressPercent}% Complete`}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ visible: true, x: rect.width / 2, y: -10 });
      }}
      onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0 })}
      onClick={onPathClick}
      onTouchStart={toggleTooltip}
      onFocus={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ visible: true, x: rect.width / 2, y: -10 });
      }}
      onBlur={() => setTooltip({ visible: false, x: 0, y: 0 })}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
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
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {showCheckmark ? (
          <span style={{ fontSize: '36px', color: '#16a34a', animation: 'scaleIn 0.3s ease-out forwards' }}>✓</span>
        ) : (
          <>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{animatedPercent}%</span>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete</span>
          </>
        )}
      </div>
      {tooltip.visible && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)',
          background: '#0f172a', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12,
          whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          pointerEvents: 'none'
        }}>
          <div style={{ color: '#818cf8', fontWeight: 600, marginBottom: 2 }}>{currentPathTitle}</div>
          <div style={{ color: '#cbd5e1' }}>{animatedPercent}% Complete · {completedLessons}/{totalLessons || 1} lessons</div>
          <div style={{
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
          You're {progressPercent}% through {currentPathTitle}. Keep the momentum!
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>📖</div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{currentPathTitle}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Current Path</div>
          <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '4px' }}>
            Module {completedModules} of {totalModules}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>🎯</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{dbData.totalTasks}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Tasks Assigned</div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>
            {upcomingTasks.length} upcoming
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>⭐</div>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '12px', color: '#0f172a' }}>{progressPercent}%</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Overall Progress</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
            {progressStats.completedLessons}/{progressStats.totalLessons} lessons
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>🔥</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
            {dbData.acceptedCount} days
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Accepted Submissions</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
            {dbData.acceptedCount === 0 ? 'No activity yet' : 'Keep going'}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 1.3fr', gap: '20px' }}>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', position: 'relative' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Learning Path Progress</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
            <div
              style={{ position: 'relative', width: '130px', height: '130px', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setChartTooltip({
                  visible: true,
                  x: rect.width / 2,
                  y: -10,
                  label: currentPathTitle,
                  value: `${progressPercent}% Complete · ${progressStats.completedLessons}/${progressStats.totalLessons || 1} lessons`,
                });
              }}
              onMouseLeave={() => setChartTooltip((t) => ({ ...t, visible: false }))}
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
                  strokeDashoffset={251 - (251 * progressPercent) / 100}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{progressPercent}%</span>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(traineePath?.modules || []).slice(0, 5).map((m: any, idx: number) => (
              <div key={m.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, background: '#fafafa' }}>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                  <span style={{ color: idx < completedModules ? '#16a34a' : '#94a3b8', fontWeight: 700, marginRight: 6 }}>
                    {idx < completedModules ? '✓' : '○'}
                  </span>
                  {m.title || `Module ${idx + 1}`}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: idx < completedModules ? '#dcfce7' : '#f1f5f9', color: idx < completedModules ? '#166534' : '#64748b' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>🎯</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{dbData.totalTasks}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Tasks Assigned</div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>
            {upcomingTasks.length} upcoming
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>⭐</div>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '12px', color: '#0f172a' }}>{progressPercent}%</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Overall Progress</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
            {progressStats.completedLessons}/{progressStats.totalLessons} lessons
          </div>
        </div>

        <StreakCard currentStreak={dbData.currentStreak || 0} hasActivityToday={hasActivityToday} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 1.3fr', gap: '20px' }}>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', position: 'relative' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Learning Path Progress</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
            <div
              style={{ position: 'relative', width: '130px', height: '130px', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setChartTooltip({
                  visible: true,
                  x: rect.width / 2,
                  y: -10,
                  label: currentPathTitle,
                  value: `${progressPercent}% Complete · ${progressStats.completedLessons}/${progressStats.totalLessons || 1} lessons`,
                });
              }}
              onMouseLeave={() => setChartTooltip((t) => ({ ...t, visible: false }))}
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
                  strokeDashoffset={251 - (251 * progressPercent) / 100}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{progressPercent}%</span>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(traineePath?.modules || []).slice(0, 5).map((m: any, idx: number) => (
              <div key={m.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, background: '#fafafa' }}>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                  <span style={{ color: idx < completedModules ? '#16a34a' : '#94a3b8', fontWeight: 700, marginRight: 6 }}>
                    {idx < completedModules ? '✓' : '○'}
                  </span>
        currentUser={currentUser}
      />
    </div>
  );
}

if (activeSection === 'Settings') {
  return (
    <div className="dashboard-content">
      <SettingsSection accessToken={accessToken} activeRole={activeRole} currentUser={currentUser} />
    </div>
  );
}

// ========================================================
// DEFAULT DASHBOARD HOME (ROLE-ADAPTIVE DB VIEWS)
// ========================================================
const firstName = currentUser.firstName || currentUser.name?.split(' ')[0] || 'User';

if (isTrainee) {
  const dbActivityDates = dbData.activityTimestamps || [];
  const todayStr = new Date().toLocaleDateString();
  const hasActivityToday = dbActivityDates.some((d: string) => new Date(d).toLocaleDateString() === todayStr);

  const currentPathTitle = traineePath?.title || traineePath?.name || 'No path assigned';
  const totalModules = traineePath?.modules?.length || 0;
  const progressPercent = progressStats.completionPercent || dbData.completionRate || 0;
  const completedModules = Math.min(
    totalModules,
    progressStats.completedLessons > 0 && totalModules > 0
      ? Math.max(1, Math.round((progressPercent / 100) * totalModules))
      : 0,
  );

  return (
    <div className="dashboard-content" style={{ padding: '24px 32px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
          You're {progressPercent}% through {currentPathTitle}. Keep the momentum!
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>📖</div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{currentPathTitle}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Current Path</div>
          <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '4px' }}>
            Module {completedModules} of {totalModules}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>🎯</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{dbData.totalTasks}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Tasks Assigned</div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>
            {upcomingTasks.length} upcoming
          </div>
                assigned = pathsList.find((p: any) => p.id === pId);
                if (assigned) break;
              }
            }
          }
          if (!assigned) {
            assigned = pathsList.find((p: any) => p.assignedToTraineeIds?.includes(currentUser.id)) || null;
          }
          setTraineePath(assigned);
          setUpcomingTasks([]);
        } else {
          setTraineePath(null);
          setUpcomingTasks([]);
        }
      } catch (err) {
        console.error('Failed to load database metrics:', err);
        if (isMounted) {
          setDbData({
            totalUsers: 0,
            totalTrainers: 0,
            totalTrainees: 0,
            totalPaths: 0,
            totalModules: 0,
            totalTasks: 0,
            pendingReviews: 0,
            acceptedCount: 0,
            completionRate: 0,
            averageScore: 0,
            totalLessons: 0,
            currentStreak: 0,
            activityTimestamps: [],
                  <span style={{ fontSize: '11px', color: '#64748b' }}>⏱️ {task.due || 'Due Soon'}</span>
                </div>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, background: task.priority === 'high' ? '#fee2e2' : '#fef3c7', color: task.priority === 'high' ? '#dc2626' : '#b45309' }}>
                  {task.priority ? task.priority.toUpperCase() : 'MEDIUM'}
                </span>
              </div>
            ))}
            {upcomingTasks.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No upcoming tasks in database.</div>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}

// 🔵 B. TRAINER / ADMIN DASHBOARD VIEW
return (
  <div className="dashboard-content" style={{ padding: '24px 32px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

    <section className="workspace-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
          {isAdmin ? 'System overview: Total active learning paths, user roles & review pipelines.' : "Here's what's happening in your cohort today."}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>

        {isAdmin ? (
          <button
            className="primary-button"
            type="button"
            style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setShowInviteModal(true)}
          >
            + Add User
          </button>
        ) : (
          <button></button>
        )}
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontSize: '18px' }}>👥</div>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>↗</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
          {isLoadingMetrics ? '...' : dbData.totalTrainees}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Total Trainees</div>
        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '6px' }}>
          {dbData.totalTrainers} trainers
        </div>
          accessToken={accessToken}
          onBack={handleBackToAllPaths}
        />
      </div>
    );
      </div>
    );
  }

          <LearningPathsSection
            currentUser={{
              id: currentUser?.id ?? 'trainee-99',
              name: currentUser?.firstName ?? 'User',
              role: activeRole as any
            }}
            accessToken={accessToken}
            onNavigateToModules={(pathId: string, pathName: string) => {
              if (isTrainee) {
                navigate('/modules', { state: { pathId, pathName } });
              } else {
                setSelectedPathId(pathId);
                setSelectedPathTitle(pathName);
              }
            }}
            onBackToAllPaths={handleBackToAllPaths}
          />
        )}
      </div>
    );
  }
  if (activeSection === 'Modules' || activeSection === 'Module Details') {
    const pathId = location.state?.pathId || selectedPathId || traineePath?.id || '';
    const pathTitle = location.state?.pathName || selectedPathTitle || traineePath?.title || 'All Modules';

    if (!pathId) {
      return <Navigate to="/learning-paths" replace />;
    }

    return (
      <div className="dashboard-content">
        <ModulesManagementSection
          currentPathId={pathId}
          currentPathTitle={pathTitle}
          userRole={activeRole as 'Admin' | 'Trainer' | 'Trainee'}
          accessToken={accessToken}
          onBack={handleBackToAllPaths}
        />
      </div>
    );
  }

  if (activeSection === 'Progress' || activeSection === 'Analytics') {
    return (
      <div className="dashboard-content">
        <ProgressAnalyticsSection
          accessToken={accessToken}
          activeRole={activeRole}
          currentUser={currentUser}
        />
      </div>
    );
  }

  if (activeSection === 'Settings') {
    return (
      <div className="dashboard-content">
        <SettingsSection accessToken={accessToken} activeRole={activeRole} currentUser={currentUser} />
      </div>
    );
  }

  // ========================================================
  // DEFAULT DASHBOARD HOME (ROLE-ADAPTIVE DB VIEWS)
  // ========================================================
  const firstName = currentUser.firstName || currentUser.name?.split(' ')[0] || 'User';

  if (isTrainee) {
    const currentPathTitle = traineePath?.title || traineePath?.name || 'No path assigned';
    const totalModules = traineePath?.modules?.length || 0;
    const progressPercent = traineePath ? (progressStats.completionPercent || dbData.completionRate || 0) : 0;
    
    // Evaluate actual module completion from detailedTraineeModules
    let completedModules = 0;
    if (detailedTraineeModules && detailedTraineeModules.length > 0) {
      completedModules = detailedTraineeModules.filter((m: any) => {
        const allTasks = (m.lessons || []).flatMap((l: any) => l.assignments || []);
        if (allTasks.length === 0) {
          // If no tasks, check if lessons are marked complete
          const lessons = m.lessons || [];
          return lessons.length > 0 && lessons.every((l: any) => l.isCompleted);
        }
        const doneTasks = allTasks.filter((t: any) => 
          t.userSubmission?.evaluationStatus === 'accepted_high' || 
          (t.userSubmission && t.userSubmission.score >= (t.minPassScore || 0)) ||
          t.userSubmission?.status === 'Accepted' ||
          t.userSubmission?.status === 'Evaluated'
        ).length;
        return doneTasks === allTasks.length;
      }).length;
    } else {
      completedModules = Math.min(
        totalModules,
        progressPercent > 0 && totalModules > 0
          ? Math.max(1, Math.round((progressPercent / 100) * totalModules))
          : 0
      );
    }

    const currentStreak = dbData.currentStreak || calculateStreak(mySubmissions);
    const traineeAvgScore = progressStats.averageScore || 0;

    return (
      <div className="dashboard-content" style={{ padding: '24px 32px', width: '100%', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            {traineePath
              ? `You're ${progressPercent}% through ${currentPathTitle}. Keep the momentum!`
              : `Welcome, ${firstName}! No learning path assigned yet — check back soon or explore available paths.`}
          </p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>📖</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{currentPathTitle}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Current Path</div>
            <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '4px' }}>
              {traineePath ? `Module ${completedModules} of ${totalModules}` : '0 Modules'}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>🎯</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{dbData.totalTasks}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Tasks Assigned</div>
            <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>
              {upcomingTasks.length} upcoming
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>⭐</div>
            <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '12px', color: '#0f172a' }}>{progressPercent}%</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Overall Progress</div>
            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
              {traineePath ? progressStats.completedLessons : 0}/{traineePath ? progressStats.totalLessons : 0} lessons
            </div>
          </div>

          <StreakCard currentStreak={currentStreak} />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.5fr', gap: '20px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', position: 'relative' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Learning Path Progress</h3>
              
              <TraineeProgressRing 
                progressPercent={progressPercent}
                completedLessons={progressStats.completedLessons}
                totalLessons={progressStats.totalLessons}
                currentPathTitle={currentPathTitle}
                onPathClick={() => {
                  if (traineePath) {
                    navigate('/learning-paths', { state: { pathId: traineePath.id, pathName: traineePath.title } });
                  }
                }}
              />

              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(traineePath?.modules || []).slice(0, 5).map((m: any, idx: number) => {
                  let isCompleted = false;
                  if (detailedTraineeModules && detailedTraineeModules.length > 0) {
                    const detailedMod = detailedTraineeModules.find((dm: any) => dm.id === m.id);
                    if (detailedMod) {
                      const allTasks = (detailedMod.lessons || []).flatMap((l: any) => l.assignments || []);
                      if (allTasks.length === 0) {
                        const lessons = detailedMod.lessons || [];
                        isCompleted = lessons.length > 0 && lessons.every((l: any) => l.isCompleted);
                      } else {
                        const doneTasks = allTasks.filter((t: any) => 
                          t.userSubmission?.evaluationStatus === 'accepted_high' || 
                          (t.userSubmission && t.userSubmission.score >= (t.minPassScore || 0)) ||
                          t.userSubmission?.status === 'Accepted' ||
                          t.userSubmission?.status === 'Evaluated'
                        ).length;
                        isCompleted = doneTasks === allTasks.length;
                      }
                    }
                  } else {
                    isCompleted = idx < completedModules;
                  }

                  return (
                    <div 
                      key={m.id || idx} 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        padding: '4px 8px', borderRadius: 6, 
                        background: isCompleted ? '#f0fdf4' : '#fafafa',
                        cursor: isCompleted ? 'pointer' : 'default',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => {
                        if (isCompleted && traineePath) {
                          navigate('/learning-paths', { state: { pathId: traineePath.id, pathName: traineePath.title } });
                        }
                      }}
                      onMouseEnter={(e) => { if (isCompleted) e.currentTarget.style.background = '#dcfce7'; }}
                      onMouseLeave={(e) => { if (isCompleted) e.currentTarget.style.background = '#f0fdf4'; }}
                    >
                      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                        <span style={{ color: isCompleted ? '#16a34a' : '#94a3b8', fontWeight: 700, marginRight: 6 }}>
                          {isCompleted ? '✓' : '○'}
                        </span>
                        {m.title || `Module ${idx + 1}`}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: isCompleted ? '#dcfce7' : '#f1f5f9', color: isCompleted ? '#166534' : '#64748b' }}>
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
                {(!traineePath?.modules || traineePath.modules.length === 0) && (
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>No modules assigned yet.</div>
                )}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '12px', color: '#64748b' }}>Latest Feedback</strong>
                <span style={{ fontSize: 10, fontWeight: 700, color: traineeAvgScore >= 75 ? '#16a34a' : '#ea580c', background: traineeAvgScore >= 75 ? '#dcfce7' : '#fff7ed', padding: '2px 6px', borderRadius: 4 }}>
                  {traineeAvgScore >= 75 ? 'Excellent' : 'Needs Focus'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#334155', margin: '6px 0 0 0', fontStyle: 'italic' }}>
                {traineeAvgScore > 0
                  ? `Overall average evaluation score: ${traineeAvgScore}%`
                  : 'No evaluation feedback in database yet.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Daily Activity</h3>
                <select
                  value={heatmapDays}
                  onChange={(e) => setHeatmapDays(Number(e.target.value))}
                  style={{ fontSize: 12, fontWeight: 600, background: '#f8fafc', color: '#334155', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                >
                  <option value={30}>Last 30 Days ({getRangeLabel(30)})</option>
                  <option value={90}>Last 90 Days ({getRangeLabel(90)})</option>
                  <option value={140}>Last 140 Days ({getRangeLabel(140)})</option>
                  <option value={180}>Last 180 Days ({getRangeLabel(180)})</option>
                  <option value={365}>Last 1 Year ({getRangeLabel(365)})</option>
                </select>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 12px 0' }}>
                {dbData.activityTimestamps?.length || mySubmissions.length} items completed total
              </p>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <DailyActivityHeatmap submissions={dbData.activityTimestamps?.length ? dbData.activityTimestamps : mySubmissions} daysToDispay={heatmapDays} />
              </div>
            </div>
          </div>

        </section>
      </div>
    );
  }

  // 🔵 B. TRAINER / ADMIN DASHBOARD VIEW
  return (
    <div className="dashboard-content" style={{ padding: '24px 32px', width: '100%', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      <section className="workspace-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            {isAdmin ? 'System overview: Total active learning paths, user roles & review pipelines.' : "Here's what's happening in your cohort today."}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>

          {isAdmin ? (
            <button
              className="primary-button"
              type="button"
              style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setShowInviteModal(true)}
            >
              + Add User
            </button>
          ) : (
            <button></button>
          )}
        </div>
      </section>

      {/* Metrics Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "2rem"
      }}>
        {[
          { label: isAdmin ? "Total Trainees" : "My Trainees", value: isLoadingMetrics ? "..." : dbData.totalTrainees, desc: isAdmin ? `${dbData.totalTrainers} trainers` : "Assigned to your paths/tasks", icon: "👥", color: "#4f46e5", bg: "#f0f3ff" },
          { label: "Active Assignments", value: isLoadingMetrics ? "..." : dbData.totalTasks, desc: `${dbData.totalModules} modules live`, icon: "📋", color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Pending Reviews", value: isLoadingMetrics ? "..." : dbData.pendingReviews, desc: "Needs Trainer action", icon: "⏱️", color: "#ea580c", bg: "#fff7ed" },
          { label: "Completion Rate", value: isLoadingMetrics ? "..." : `${dbData.completionRate}%`, desc: `${completionGrowth >= 0 ? '+' : ''}${completionGrowth}% vs last month`, icon: "📈", color: "#16a34a", bg: "#f0fdf4", descColor: completionGrowth >= 0 ? "#16a34a" : "#dc2626" }
        ].map((metric, idx) => (
          <div key={idx} style={{
            background: "#ffffff",
            border: "0.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "1.25rem",
            minHeight: "120px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: metric.bg,
                color: metric.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                {metric.icon}
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>
                  {metric.label}
                </p>
              </div>
            </div>
            <p style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 4px 0", color: "#0f172a" }}>
              {metric.value}
            </p>
            <p style={{ fontSize: "12px", color: metric.descColor || "#64748b", margin: 0, fontWeight: 500 }}>
              {metric.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        gap: "24px",
        marginBottom: "2rem"
      }}>
        <DashboardCharts
          title="Progress Trends"
          subtitle="Submissions vs Completions from database"
          datasets={{
            daily: charts.dailyProgressTrends || [],
            weekly: charts.weeklyProgressTrends || [],
            monthly: charts.progressTrends || []
          }}
          role={activeRole.toLowerCase()}
          type="progress"
        />

        <DashboardCharts
          title="Avg. Evaluation Score"
          subtitle="Weekly average from database"
          datasets={{
            daily: charts.dailyScores || [],
            weekly: charts.weeklyScores || [],
            monthly: charts.monthlyScores || []
          }}
          role={activeRole.toLowerCase()}
          type="score"
        />
      </div>



      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Recent Submissions</h3>
          {pendingSubmissions.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>No pending submissions in database queue.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingSubmissions.slice(0, 5).map((sub) => (
                <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #f8fafc', borderRadius: '8px', background: '#fafafa' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>{sub.trainee?.firstName || sub.trainee?.name || 'Trainee'}</strong>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{sub.assignment?.title || 'Assignment Task'}</div>
                  </div>
                  <span style={{ padding: '6px 14px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '12px' }}>
                    {sub.status || 'Pending Review'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{dbData.pendingReviews} submissions awaiting review</span>
              <button type="button" style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }} onClick={() => (window.location.href = '/evaluations')}>Review Now</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{dbData.totalTrainees} trainees · {dbData.totalPaths} paths</span>
              <button type="button" style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }} onClick={() => (window.location.href = '/users')}>View Users</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{dbData.totalPaths} learning paths</span>
              <button type="button" style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }} onClick={() => (window.location.href = '/learning-paths')}>Edit Paths</button>
            </div>
          </div>
        </div>
      </section>

      {showInviteModal && (
        <InviteUserModal
          accessToken={accessToken}
          currentUser={currentUser}
          onClose={() => setShowInviteModal(false)}
          onInvited={addInvitedUser}
        />
      )}
    </div>
  );
}
