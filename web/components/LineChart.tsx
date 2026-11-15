"use client";

import {
  AreaSeries,
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

export interface ChartPoint {
  t: number;
  v: number;
}

export interface ChartLine {
  price: number;
  color: string;
  title: string;
}

interface Props {
  points: ChartPoint[];
  color?: string;
  height?: number;
  lines?: ChartLine[];
  precision?: number;
}

/** Area chart over millisecond timestamps; keeps the last value per second. */
export function LineChart({ points, color = "#e59b07", height = 280, lines = [], precision = 2 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#7b5f3c" },
      grid: { vertLines: { color: "#e6d1a0" }, horzLines: { color: "#e6d1a0" } },
      rightPriceScale: { borderColor: "#c9ac6c" },
      timeScale: { borderColor: "#c9ac6c", timeVisible: true, secondsVisible: true },
      crosshair: { horzLine: { labelBackgroundColor: "#8b5a2b" }, vertLine: { labelBackgroundColor: "#8b5a2b" } },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
    });
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [precision]);

  useEffect(() => {
    seriesRef.current?.applyOptions({ lineColor: color, topColor: `${color}55`, bottomColor: `${color}05` });
  }, [color]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const bySecond = new Map<number, number>();
    for (const p of points) bySecond.set(Math.floor(p.t / 1000), p.v);
    series.setData([...bySecond].map(([time, value]) => ({ time: time as UTCTimestamp, value })));
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach((l) => series.removePriceLine(l));
    priceLinesRef.current = lines.map((l) =>
      series.createPriceLine({ price: l.price, color: l.color, title: l.title, lineStyle: LineStyle.Dashed, lineWidth: 1 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
