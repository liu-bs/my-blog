/**
 * @file StatsGrid.tsx
 * @description 统计数据网格组件，按 items 顺序渲染"数值 + 标签"单元格；用于文章详情页阅读量/评论数、首页汇总数据等展示
 */
import type { StatsGridProps } from "@shared";

/**
 * 统计数据网格
 * @param props.items 统计项数组，每项含 value（数值）与 label（标签）
 * @param props.className 追加到根容器的自定义类名
 * @warning key 使用数组下标，items 顺序变化或增删时可能引发不必要的重渲染，当前均为纯静态展示数据
 */
export function StatsGrid({ items, className = "" }: StatsGridProps) {
  return (
    /* 统计网格外层容器，布局由 .stats-grid 类控制 */
    <div className={`stats-grid ${className}`}>
      {items.map((item, index) => (
        /* 单个统计单元格 */
        <div key={index} className="stat-item">
          {/* 统计数值 */}
          <div className="stat-value">{item.value}</div>
          {/* 数值对应的标签文本 */}
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
