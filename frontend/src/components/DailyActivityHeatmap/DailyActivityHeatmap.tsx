import React, { useMemo, useState } from "react";

type DailyActivityHeatmapProps = {
  submissions: any[];
  daysToDispay?: number; // E.g., 30 days = 20 weeks
};

export const DailyActivityHeatmap: React.FC<DailyActivityHeatmapProps> = ({
  submissions,
  daysToDispay = 140,
}) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    date: Date;
    count: number;
  } | null>(null);

  const [legendTooltip, setLegendTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    label: string;
  } | null>(null);

  const getCellConfig = () => {
    if (daysToDispay <= 30) return { size: 24, gap: 6 };
    if (daysToDispay <= 90) return { size: 16, gap: 5 };
    return { size: 14, gap: 4 }; // Keep a comfortable size for large timeframes; it will scroll horizontally.
  };
  const { size: cellSize, gap: cellGap } = getCellConfig();

  const { grid, maxCount, months } = useMemo(() => {
    // Helper to get local YYYY-MM-DD string
    const getLocalYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // 1. Initialize data structures
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countsByDate = new Map<string, number>();

    // 2. Count submissions per day
    submissions.forEach((s) => {
      const d = new Date(s.submittedAt || s.createdAt);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        const key = getLocalYMD(d);
        countsByDate.set(key, (countsByDate.get(key) || 0) + 1);
      }
    });

    // 3. Build grid from (today - daysToDisplay) to today
    const gridRows: { date: string; count: number; dayOfWeek: number }[][] = [[], [], [], [], [], [], []];

    // Find the starting date
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysToDispay + 1);

    // Adjust start date to begin on a Sunday for clean columns
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }

    let current = new Date(startDate);
    let max = 0;

    const monthLabels: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    let colIndex = 0;

    let totalGridCount = 0;
    while (current <= today) {
      const key = getLocalYMD(current);
      const count = countsByDate.get(key) || 0;
      const dayOfWeek = current.getDay();

      if (count > max) max = count;
      totalGridCount += count;

      gridRows[dayOfWeek].push({ date: key, count, dayOfWeek });

      // Track months for X-axis labels
      if (dayOfWeek === 0) {
        if (current.getMonth() !== lastMonth) {
          monthLabels.push({ label: current.toLocaleString('default', { month: 'short' }), colIndex });
          lastMonth = current.getMonth();
        }
        colIndex++;
      }

      current.setDate(current.getDate() + 1);
    }

    // Assertion: verify total cells mapped equals total items inside timeframe
    // Note: The grid cuts off anything BEFORE (today - daysToDisplay).
    // So we should only assert against submissions that fall within the rendered grid dates.
    const startTimeMs = startDate.getTime();
    let expectedInGrid = 0;
    submissions.forEach(s => {
      const d = new Date(s.submittedAt || s.createdAt);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        if (d.getTime() >= startTimeMs && d.getTime() <= today.getTime()) {
          expectedInGrid++;
        }
      }
    });

    if (totalGridCount !== expectedInGrid) {
      console.warn(`[DailyActivityHeatmap] Data mismatch! Rendered ${totalGridCount} items but expected ${expectedInGrid} inside the ${daysToDispay}-day window.`);
    }

    return { grid: gridRows, maxCount: max, months: monthLabels };
  }, [submissions, daysToDispay]);

  // Color logic mapping to exact counts requested
  const getColor = (count: number) => {
    if (count === 0) return "#f1f5f9"; // slate-100 (0 items)
    if (count === 1) return "#c7d2fe"; // indigo-200 (1 item)
    if (count >= 2 && count <= 3) return "#818cf8"; // indigo-400 (2-3 items)
    if (count >= 4 && count <= 5) return "#4f46e5"; // indigo-600 (4-5 items)
    return "#312e81"; // indigo-900 (6+ items)
  };

  const getFormattedDate = (dateObj: Date) => {
    return dateObj.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // We add touch events so tooltip closes when tapping outside
  React.useEffect(() => {
    const handleTouchOutside = (e: TouchEvent) => {
      setTooltip(null);
      setHoveredCell(null);
      setLegendTooltip(null);
    };
    document.addEventListener("touchstart", handleTouchOutside);
    return () => document.removeEventListener("touchstart", handleTouchOutside);
  }, []);

  return (
    <div className="daily-activity-heatmap" style={{ position: "relative", width: "100%", overflowX: "auto", padding: "8px 0", WebkitOverflowScrolling: "touch" }}>
      {/* Cell Tooltip */}
      {tooltip && tooltip.visible && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            marginTop: "-8px",
            background: "#1e293b",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            whiteSpace: "nowrap",
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            textAlign: "center"
          }}
        >
          <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>
            {tooltip.count === 0 ? "No activity" : `${tooltip.count} item${tooltip.count === 1 ? '' : 's'} completed`}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '11px' }}>
            {getFormattedDate(tooltip.date)}
          </div>
          <div style={{
            position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            borderTop: '4px solid #1e293b'
          }} />
        </div>
      )}

      {/* Legend Tooltip */}
      {legendTooltip && legendTooltip.visible && (
        <div
          style={{
            position: "fixed",
            left: legendTooltip.x,
            top: legendTooltip.y,
            transform: "translate(-50%, -100%)",
            marginTop: "-8px",
            background: "#1e293b",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            whiteSpace: "nowrap",
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
          }}
        >
          {legendTooltip.label}
          <div style={{
            position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            borderTop: '4px solid #1e293b'
          }} />
        </div>
      )}

      {/* Grid wrapper */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "fit-content" }}>
        {/* Months Label Row */}
        <div style={{ display: "flex", marginLeft: "24px", height: "16px", position: "relative" }}>
          {months.map((m, i) => (
            <span key={i} style={{
              position: "absolute",
              left: `${m.colIndex * (cellSize + cellGap)}px`,
              fontSize: "11px",
              color: "#64748b"
            }}>
              {m.label}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{ display: "flex", gap: "8px" }}>
          {/* Y Axis labels (Mon, Wed, Fri) */}
          <div style={{ display: "flex", flexDirection: "column", gap: `${cellGap}px`, fontSize: "10px", color: "#64748b", marginTop: "8px" }}>
            <div style={{ height: `${cellSize}px`, visibility: "hidden" }}>Sun</div>
            <div style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}>Mon</div>
            <div style={{ height: `${cellSize}px`, visibility: "hidden" }}>Tue</div>
            <div style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}>Wed</div>
            <div style={{ height: `${cellSize}px`, visibility: "hidden" }}>Thu</div>
            <div style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}>Fri</div>
            <div style={{ height: `${cellSize}px`, visibility: "hidden" }}>Sat</div>
          </div>

          {/* SVG Grid (Using HTML divs for easier interaction handling without D3) */}
          <div style={{ display: "flex", flexDirection: "column", gap: `${cellGap}px` }}>
            {grid.map((row, rowIndex) => (
              <div key={rowIndex} style={{ display: "flex", gap: `${cellGap}px` }}>
                {row.map((cell, colIndex) => (
                  <div
                    key={colIndex}
                    tabIndex={0}
                    role="gridcell"
                    aria-label={`${cell.count} items on ${cell.date}`}
                    onTouchStart={(e) => {
                      e.stopPropagation(); // prevent window listener from firing immediately
                      setHoveredCell(cell.date);
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({
                        visible: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        date: new Date(`${cell.date}T00:00:00`),
                        count: cell.count
                      });
                    }}
                    onMouseEnter={(e) => {
                      setHoveredCell(cell.date);
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          visible: true,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          date: new Date(`${cell.date}T00:00:00`),
                          count: cell.count
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredCell(null);
                      setTooltip(null);
                    }}
                    onFocus={(e) => {
                      setHoveredCell(cell.date);
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({
                        visible: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        date: new Date(`${cell.date}T00:00:00`),
                        count: cell.count
                      });
                    }}
                    onBlur={() => {
                      setHoveredCell(null);
                      setTooltip(null);
                    }}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      background: getColor(cell.count),
                      borderRadius: "2px",
                      transition: "transform 0.12s ease-out, border 0.12s ease-out",
                      cursor: "pointer",
                      transform: hoveredCell === cell.date ? "scale(1.15)" : "scale(1)",
                      border: hoveredCell === cell.date ? "1px solid #7c3aed" : "1px solid transparent",
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px", fontSize: "11px", color: "#64748b", marginTop: "8px", marginRight: "16px" }}>
          <span>Less</span>
          {[
            { color: "#f1f5f9", label: "0 completions" },
            { color: "#c7d2fe", label: "1 completion" },
            { color: "#818cf8", label: "2–3 completions" },
            { color: "#4f46e5", label: "4–5 completions" },
            { color: "#312e81", label: "6+ completions" }
          ].map((swatch, idx) => (
            <div
              key={idx}
              onTouchStart={(e) => {
                e.stopPropagation();
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setLegendTooltip({ visible: true, x: rect.left + rect.width / 2, y: rect.top, label: swatch.label });
              }}
              onMouseEnter={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setLegendTooltip({ visible: true, x: rect.left + rect.width / 2, y: rect.top, label: swatch.label });
              }}
              onMouseLeave={() => setLegendTooltip(null)}
              style={{ width: "12px", height: "12px", background: swatch.color, borderRadius: "2px", cursor: "pointer", transition: "transform 0.1s" }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
