import { ImageResponse } from "next/og";

export const contentType = "image/png";

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
