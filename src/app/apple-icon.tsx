/**
 * @file apple-icon.tsx
 * @description Apple 图标路由（GET /apple-icon.png），iOS 设备添加到主屏幕时使用。
 * 通过 next/og 的 ImageResponse 在服务端动态渲染 180x180 PNG（书本线条 logo + 深色圆角底）。
 */
import { ImageResponse } from "next/og";

/** 响应内容类型：声明该路由输出 PNG 图片 */
export const contentType = "image/png";

/**
 * 生成 Apple 图标
 * @returns 180x180 的 ImageResponse（PNG 图片流）
 */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090b",
        borderRadius: 40,
      }}
    >
      {/* 书本造型 logo（与站点 favicon 主题一致），居中渲染 */}
      <svg
        width={104}
        height={104}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fafafa"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    </div>,
    { width: 180, height: 180 },
  );
}
