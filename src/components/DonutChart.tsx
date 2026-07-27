import React from "react";
import Svg, { Circle as SvgCircle } from "react-native-svg";

type PieDatum = { name: string; value: number; color: string };

/**
 * Fixes the original bug: the arc used to be hardcoded at 70% fill
 * (`strokeDasharray={`${251 * 0.7} 251`}`) regardless of the actual
 * data passed in — so it looked "70% full" even with zero issues.
 *
 * This version:
 * 1. Draws one arc segment per category, sized to its real percentage.
 * 2. Renders only the grey background ring when there's no data,
 *    instead of a fake colored arc.
 */
export default function DonutChart({ data }: { data: PieDatum[] }) {
  const radius = 40;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  let cumulativePercent = 0;

  return (
    <Svg width="100" height="100" viewBox="0 0 100 100">
      {/* base track */}
      <SvgCircle
        cx="50"
        cy="50"
        r={radius}
        stroke="#f1f1f1"
        strokeWidth={strokeWidth}
        fill="none"
      />

      {hasData &&
        data.map((item, idx) => {
          const segmentLength = (item.value / 100) * circumference;
          const dashArray = `${segmentLength} ${circumference - segmentLength}`;
          // negative offset walks the segment start clockwise from 12 o'clock
          const dashOffset = -((cumulativePercent / 100) * circumference);
          cumulativePercent += item.value;

          return (
            <SvgCircle
              key={idx}
              cx="50"
              cy="50"
              r={radius}
              stroke={item.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap={data.length === 1 ? "round" : "butt"}
              rotation="-90"
              origin="50, 50"
            />
          );
        })}
    </Svg>
  );
}
