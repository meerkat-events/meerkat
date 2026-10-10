/**
 * A single-series horizontal bar chart as a labelled list: one row per item,
 * its bar scaled to the largest value and the count at the bar's end. The
 * title names the series, so there is no legend; every value is printed, so
 * the list doubles as its own table. Hovering a row shows its share.
 */
export function BarList(
  { title, items, unit }: {
    title: string;
    items: { label: string; value: number }[];
    /** Noun for the tooltip, e.g. "questions". */
    unit: string;
  },
) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <figure className="m-bars">
      <figcaption>{title}</figcaption>
      <ul>
        {items.map((item) => {
          const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label} title={`${item.label}: ${item.value} ${unit} (${share}%)`}>
              <span className="label">{item.label}</span>
              <span className="track" aria-hidden="true">
                <span className="bar" style={{ width: `${(item.value / max) * 100}%` }} />
              </span>
              <span className="value">{item.value}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
