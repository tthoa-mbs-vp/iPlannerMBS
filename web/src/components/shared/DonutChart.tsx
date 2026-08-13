interface DonutSlice {
  status: string;
  value: number;
  label?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  colorFor: (status: string) => string;
  size?: number;
  thickness?: number;
}

export default function DonutChart({ data, colorFor, size = 96, thickness = 14 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const slices = data.reduce<{ status: string; value: number; label?: string; dash: number; offset: number }[]>((acc, d) => {
    if (d.value <= 0) return acc;
    const dash = (d.value / total) * circumference;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    acc.push({ ...d, dash, offset });
    return acc;
  }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={thickness}
      />
      {slices.map(({ status, dash, offset }) => (
        <circle
          key={status}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorFor(status) || "#cbd5e1"}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  );
}
