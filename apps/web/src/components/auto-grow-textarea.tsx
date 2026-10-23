import { type TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  // Obergrenze in Zeilen, danach scrollt das Feld
  maxRows?: number;
}

// Textfeld, das mit dem Inhalt wächst; von Hand weiter vergrößerbar.
export function AutoGrowTextarea({ value, rows = 6, maxRows = 20, style, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Höhe hängt am Inhalt
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = "auto";
    const max = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
  }, [value, maxRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      style={{ resize: "vertical", ...style }}
      {...rest}
    />
  );
}
