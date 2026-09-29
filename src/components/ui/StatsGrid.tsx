/**
 * @file StatsGrid.tsx
 * @description 数据指标网格，用于个人主页等位置并排展示「N 篇文章 / N 获赞」类统计
 */
import type { StatsGridProps } from "@shared";

/**
 * StatsGrid 指标网格
 * @param props {@link StatsGridProps}
 * @returns 等分列布局的统计项列表；用下标作 key，因为 items 为展示用静态配置且无稳定 id
 */
export function StatsGrid({ items, className = "" }: StatsGridProps) {
  return (
    <div className={`stats-grid ${className}`}>
      {items.map((item, index) => (
        // 单项：数值在上、标签在下
        <div key={index} className="stat-item">
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
