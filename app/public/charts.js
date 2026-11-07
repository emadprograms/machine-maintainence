// Charts, drawn by hand.
//
// There is no charting library here for the same reason there is no framework:
// the app ships nothing, fetches nothing, and has to run on a machine with no
// internet. A bar chart is rectangles and text, which is a few dozen lines of SVG.
//
// These functions return a string and touch no DOM at all. That is deliberate:
// the smoke test can import this file in Node and check the geometry and the
// escaping — the two things that go wrong in a chart — without a browser, which
// is the one thing this project cannot test.

/** Everything that reaches the document as text goes through here first. */
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/**
 * The top of the y axis: the smallest round number at or above the real maximum.
 * Without it the tallest bar touches the ceiling and the axis reads "0 / 3.5 / 7".
 */
function axisTop(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s >= scaled) ?? 10;
  return step * magnitude;
}

const WIDTH = 360;
const PAD = { left: 40, right: 8, top: 10, bottom: 24 };

/**
 * A bar chart. Several series stack on top of each other (parts under labour,
 * say), so one column answers "how much in total" and "how much of which".
 *
 * labels  — one string per column, shown under the axis
 * series  — [{ name, values: [number, …], tone: 'brand' | 'soft' }], bottom first
 */
export function stackedBars({ labels = [], series = [], title = '', height = 170,
  format = (n) => String(Math.round(num(n))) }) {
  const columns = labels.length;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;

  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + num(s.values?.[i]), 0));
  const top = axisTop(Math.max(0, ...totals));
  const scale = (v) => (num(v) / top) * plotH;

  const column = columns ? plotW / columns : plotW;
  const barWidth = Math.max(6, column * 0.56);

  // Three gridlines: zero, half, the top. More lines than that is noise on a
  // chart this small, and fewer leaves the reader guessing at the scale.
  const grid = [0, 0.5, 1].map((f) => {
    const y = baseline - f * plotH;
    return `<line class="chart-grid" x1="${PAD.left}" y1="${y.toFixed(1)}"
      x2="${WIDTH - PAD.right}" y2="${y.toFixed(1)}" />
    <text class="chart-axis" x="${PAD.left - 8}" y="${(y + 4).toFixed(1)}"
      text-anchor="end">${esc(format(top * f))}</text>`;
  }).join('');

  const bars = labels.map((label, i) => {
    const x = PAD.left + i * column + (column - barWidth) / 2;
    const centre = PAD.left + i * column + column / 2;
    let stacked = 0;   // pixels already drawn from the baseline up
    const pieces = series.map((s, si) => {
      const value = num(s.values?.[i]);
      const h = scale(value);
      if (h <= 0) return '';
      const y = baseline - stacked - h;
      stacked += h;
      return `<rect class="chart-bar t-${esc(s.tone || 'brand')}" x="${x.toFixed(1)}"
        y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="2">
        <title>${esc(label)} — ${esc(s.name)}: ${esc(format(value))}</title>
      </rect>`;
    }).join('');
    return `${pieces}<text class="chart-axis" x="${centre.toFixed(1)}" y="${height - 7}"
      text-anchor="middle">${esc(label)}</text>`;
  }).join('');

  // One sentence a screen reader can read instead of trying to describe a picture.
  const spoken = title
    ? `${title}. ${labels.map((l, i) => `${l}: ${format(totals[i])}`).join(', ')}.`
    : '';

  return `<svg class="chart-svg" viewBox="0 0 ${WIDTH} ${height}" role="img"
    aria-label="${esc(spoken)}" preserveAspectRatio="xMidYMid meet">
    <title>${esc(title)}</title>
    ${grid}${bars}
  </svg>`;
}

/** The key under a chart, one dot per series. Nothing is drawn without it: a
 *  reader who cannot tell the two colours apart is looking at noise. */
export function legend(series = []) {
  return `<ul class="chart-legend">${series.map((s) =>
    `<li><span class="chart-dot t-${esc(s.tone || 'brand')}"></span>${esc(s.name)}</li>`).join('')}</ul>`;
}
