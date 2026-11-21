import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** The public GitHub Pages address of the game. */
export const playUrl = "https://vetematts.github.io/ShiftHappens/";

/** A QR code for any address, drawn as one SVG path. */
export function QrCode({ text, className, label, level = "M", margin = 2 }: {
  text: string; className?: string; label?: string;
  /** Error correction: "L" gives fewer, bigger squares that scan from further away on a clean screen. */
  level?: "L" | "M" | "Q" | "H";
  /** White border around the code, in squares. */
  margin?: number;
}) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, level);
    code.addData(text);
    code.make();
    const count = code.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!code.isDark(row, col)) continue;
        let end = col;
        while (end + 1 < count && code.isDark(row, end + 1)) end++;
        d += `M${col} ${row}h${end - col + 1}v1h-${end - col + 1}z`;
        col = end;
      }
    }
    return { size: count, path: d };
  }, [text, level]);
  return (
    <svg className={className} viewBox={`${-margin} ${-margin} ${size + margin * 2} ${size + margin * 2}`} role="img"
      aria-label={label ?? `QR code for ${text}`} shapeRendering="crispEdges">
      <rect x={-margin} y={-margin} width={size + margin * 2} height={size + margin * 2} fill="#fff" rx={1.5} />
      <path d={path} fill="#2a2433" />
    </svg>
  );
}

export function PlayQr({ className }: { className?: string }) {
  return <QrCode text={playUrl} className={className} />;
}
