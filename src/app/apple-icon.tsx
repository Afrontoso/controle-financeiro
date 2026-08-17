import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Ícone para iOS. Gerado em build em vez de um PNG versionado, para acompanhar
 * os tokens de marca sem precisar reexportar imagem.
 */
export default function AppleIcon() {
  const bars = [
    { height: 39, color: "rgba(250, 250, 249, 0.55)" },
    { height: 62, color: "rgba(250, 250, 249, 0.8)" },
    { height: 90, color: "#2f9e51" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 8,
          paddingBottom: 45,
          background: "#1c1c1e",
        }}
      >
        {bars.map((bar) => (
          <div
            key={bar.height}
            style={{
              width: 28,
              height: bar.height,
              borderRadius: 8,
              background: bar.color,
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
