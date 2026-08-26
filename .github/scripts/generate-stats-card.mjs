import fs from "node:fs";

const USERNAME = "Deipedra34";
const ACCENT = "#7c3aed";
const BG = "#0d1117";
const BORDER = "#21262d";
const TEXT = "#c9d1d9";
const MUTED = "#8b949e";
const TOKEN = process.env.GITHUB_TOKEN;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchJSON(url) {
  const headers = { "User-Agent": BROWSER_UA, Accept: "application/vnd.github+json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
  return res.text();
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function getContributionStats() {
  const html = await fetchText(`https://github.com/users/${USERNAME}/contributions`);

  const totalMatch = html.match(/(\d[\d,]*)\s+contributions\s+in the last year/);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : 0;

  const dayRegex = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
  const days = [];
  let m;
  while ((m = dayRegex.exec(html)) !== null) {
    days.push({ date: m[1], active: m[2] !== "0" });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));

  let longest = 0;
  let run = 0;
  let longestStart = null;
  let longestEnd = null;
  let runStart = null;
  for (const day of days) {
    if (day.active) {
      if (run === 0) runStart = day.date;
      run++;
      if (run > longest) {
        longest = run;
        longestStart = runStart;
        longestEnd = day.date;
      }
    } else {
      run = 0;
    }
  }

  let current = 0;
  let currentStart = null;
  const lastIdx = days.length - 1;
  let endIdx = -1;
  if (days[lastIdx]?.active) endIdx = lastIdx;
  else if (days[lastIdx - 1]?.active) endIdx = lastIdx - 1;

  if (endIdx >= 0) {
    let i = endIdx;
    while (i >= 0 && days[i].active) {
      current++;
      i--;
    }
    currentStart = days[endIdx - current + 1]?.date;
  }
  const currentEnd = endIdx >= 0 ? days[endIdx].date : null;

  return {
    total,
    longest,
    longestRange:
      longestStart && longestEnd
        ? `${fmtDate(new Date(longestStart))} - ${fmtDate(new Date(longestEnd))}`
        : "—",
    current,
    currentRange:
      currentStart && currentEnd
        ? `${fmtDate(new Date(currentStart))} - ${fmtDate(new Date(currentEnd))}`
        : "—",
  };
}

function iconPulseAnimation(indexInCycle, totalSlots, dur) {
  const slot = dur / totalSlots;
  const start = indexInCycle * slot;
  const peak = start + slot * 0.28;
  const end = start + slot * 0.56;
  const kt = [0, start / dur, peak / dur, end / dur, 1].map((v) => v.toFixed(4));
  const vals = ["1", "1", "1.35", "1", "1"];
  return `<animateTransform attributeName="transform" type="scale" additive="sum" values="${vals.join(
    ";"
  )}" keyTimes="${kt.join(";")}" dur="${dur}s" repeatCount="indefinite"/>`;
}

function buildSVG({ followers, publicRepos, stats }) {
  const width = 900;
  const height = 210;
  const cols = [
    { icon: "👥", label: "Followers", value: String(followers), sub: null },
    { icon: "📦", label: "Public Repos", value: String(publicRepos), sub: null },
    { icon: "📊", label: "Total Contributions", value: String(stats.total), sub: "past year" },
    { icon: "🔥", label: "Current Streak", value: String(stats.current), sub: stats.currentRange },
    { icon: "🏆", label: "Longest Streak", value: String(stats.longest), sub: stats.longestRange },
  ];
  const colWidth = width / cols.length;
  const dur = 5;

  const glowXs = cols.map((_, i) => (colWidth * i + colWidth / 2).toFixed(1));
  const glowKeyTimes = [0, 0.16, 0.36, 0.56, 0.76, 1].map((v) => v.toFixed(4)).join(";");
  const glowValues = [...glowXs, glowXs[0]].join(";");
  const glowSplines = Array(5).fill("0.4 0 0.2 1").join(";");

  const columns = cols
    .map((c, i) => {
      const cx = colWidth * i + colWidth / 2;
      const iconY = 56;
      const valueY = 96;
      const labelY = 122;
      const subY = 142;
      const pulse = iconPulseAnimation(i, cols.length, dur);
      const divider =
        i > 0
          ? `<line x1="${colWidth * i}" y1="34" x2="${colWidth * i}" y2="${
              height - 24
            }" stroke="${BORDER}" stroke-width="1"/>`
          : "";
      return `
        ${divider}
        <g transform="translate(${cx} ${iconY})">
          <g>${pulse}<text text-anchor="middle" font-size="26" dominant-baseline="middle">${c.icon}</text></g>
        </g>
        <text x="${cx}" y="${valueY}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="${TEXT}">${c.value}</text>
        <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="13" fill="${MUTED}">${c.label}</text>
        ${
          c.sub
            ? `<text x="${cx}" y="${subY}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" fill="${MUTED}" opacity="0.75">${c.sub}</text>`
            : ""
        }
      `;
    })
    .join("\n");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="rounded">
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12"/>
    </clipPath>
  </defs>
  <g clip-path="url(#rounded)">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${BG}"/>
    <ellipse cx="${glowXs[0]}" cy="30" rx="120" ry="70" fill="url(#glow)">
      <animate attributeName="cx" values="${glowValues}" keyTimes="${glowKeyTimes}" dur="${dur}s" calcMode="spline" keySplines="${glowSplines}" repeatCount="indefinite"/>
    </ellipse>
    ${columns}
  </g>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="none" stroke="${BORDER}"/>
</svg>`;
}

async function main() {
  const [user, stats] = await Promise.all([
    fetchJSON(`https://api.github.com/users/${USERNAME}`),
    getContributionStats(),
  ]);

  const svg = buildSVG({
    followers: user.followers,
    publicRepos: user.public_repos,
    stats,
  });

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync("dist/stats-card.svg", svg, "utf8");
  console.log("stats-card.svg generated:", {
    followers: user.followers,
    publicRepos: user.public_repos,
    ...stats,
  });
}

main().catch((err) => {
  console.log(`::error::${err.stack || err.message}`.replace(/\n/g, "%0A"));
  process.exit(1);
});
