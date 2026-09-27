export function SetSymbol({ code, size = "ss-2x", className = "" }: { code: string | null; size?: string; className?: string }) {
  if (!code) return null;
  const classes = ["ss", `ss-${code.toLowerCase()}`, size, className].filter(Boolean).join(" ");
  return <i className={classes} aria-hidden="true" />;
}
