const COUNT = new Intl.NumberFormat("en-US");

/** A count with thousands separators: "1,234". */
export const fmtCount = (n: number) => COUNT.format(n);
