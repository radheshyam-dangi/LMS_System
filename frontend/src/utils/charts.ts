/** Build SVG polyline/path points from numeric series (0-based empty = flat line). */
export function seriesToPolyline(
  values: number[],
  width: number,
  height: number,
  padX = 10,
  padY = 10,
): { points: string; path: string; max: number; coords: { x: number; y: number; value: number }[] } {
  const max = Math.max(...values, 0);
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const n = Math.max(values.length, 1);

  const coords = values.map((v, i) => {
    const x = padX + (n === 1 ? usableW / 2 : (i / (n - 1)) * usableW);
    const ratio = max > 0 ? v / max : 0;
    const y = padY + usableH - ratio * usableH;
    return { x, y, value: v };
  });

  if (coords.length === 0) {
    return {
      points: '',
      path: `M ${padX},${height - padY} L ${width - padX},${height - padY}`,
      max: 0,
      coords: [],
    };
  }

  const points = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`)
    .join(' ');

  return { points, path, max, coords };
}

export function seriesToAreaPath(
  values: number[],
  width: number,
  height: number,
  padX = 40,
  padY = 20,
): string {
  const { path, max } = seriesToPolyline(values, width, height, padX, padY);
  if (!values.length || max === 0) {
    const y = height - padY;
    return `M ${padX},${y} L ${width - padX},${y} L ${width - padX},${height} L ${padX},${height} Z`;
  }
  return `${path} L ${width - padX},${height - 5} L ${padX},${height - 5} Z`;
}

export function donutSlices(
  items: { name: string; percent: number; count: number }[],
  radius = 40,
  cx = 50,
  cy = 50,
) {
  const colors = ['#4f46e5', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  const total = items.reduce((s, i) => s + (i.percent || i.count), 0);
  if (total <= 0) {
    return [
      {
        name: 'No data',
        color: '#e2e8f0',
        d: describeArc(cx, cy, radius, 0, 359.9),
        percent: 0,
        count: 0,
      },
    ];
  }

  let angle = -90;
  return items.map((item, idx) => {
    const value = item.percent || item.count;
    const sweep = (value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return {
      name: item.name,
      color: colors[idx % colors.length],
      d: describeArc(cx, cy, radius, start, end),
      percent: item.percent,
      count: item.count,
    };
  });
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? '0' : '1';
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}
