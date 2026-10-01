/**
 * @file StatsGrid.tsx
 * @description 统计数据网格：按传入条目渲染「数值 + 标签」组合，网格布局由 stats-grid 类控制
 */
import type { StatsGridProps } from "@shared";

/**
 * StatsGrid 统计网格
 * @param props {@link StatsGridProps} 统计条目（数值 + 标签）数组
 */
export function StatsGrid({ items, className = "" }: StatsGridProps) {
  return (
    <div className={`stats-grid ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="stat-item">
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
