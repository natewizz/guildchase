const KEYRUNE_ALIASES: Record<string, string> = {
  CST: "CSP",
  DD1: "EVG",
  DVD: "DDC",
  GVL: "DDD",
  JVC: "DD2",
  SUM: "PSUM",
};

const SCRYFALL_SYMBOLS: Record<string, string> = {
  ITP: "https://svgs.scryfall.io/sets/x2ps.svg",
  PHUK: "https://svgs.scryfall.io/sets/phuk.svg",
  PLST: "https://svgs.scryfall.io/sets/planeswalker.svg",
  TRK: "https://svgs.scryfall.io/sets/trk.svg",
};

export function SetSymbol({ code, size = "ss-2x", className = "" }: { code: string | null; size?: string; className?: string }) {
  if (!code) return null;
  const normalized = code.toUpperCase();
  const scryfallSymbol = SCRYFALL_SYMBOLS[normalized];
  if (scryfallSymbol) {
    const classes = ["set-symbol-image", size, className].filter(Boolean).join(" ");
    return <img className={classes} src={scryfallSymbol} alt="" aria-hidden="true" />;
  }
  if (normalized === "RQS") {
    const classes = ["set-symbol-code", size, className].filter(Boolean).join(" ");
    return <span className={classes} aria-hidden="true">RQS</span>;
  }
  const symbolCode = KEYRUNE_ALIASES[normalized] ?? normalized;
  const classes = ["ss", `ss-${symbolCode.toLowerCase()}`, size, className].filter(Boolean).join(" ");
  return <i className={classes} aria-hidden="true" />;
}
