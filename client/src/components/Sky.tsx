// sky, clouds, and mascot

// background clouds (left/top in %, width in px)
const CLOUDS = [
  { left: '-3%', top: '4%', width: 220, opacity: 0.95 },
  { left: '70%', top: '20%', width: 120, opacity: 0.85 },
  { left: '15%', top: '44%', width: 250, opacity: 0.9 },
  { left: '82%', top: '52%', width: 200, opacity: 0.9 },
  { left: '-4%', top: '78%', width: 170, opacity: 0.85 },
  { left: '88%', top: '84%', width: 180, opacity: 0.9 },
  { left: '30%', top: '10%', width: 90, opacity: 0.7 },
];

export function Sky() {
  return (
    <div className="sky-layer" aria-hidden="true">
      <div className="sun" />
      {CLOUDS.map((c, i) => (
        <img key={i} className="sky-cloud" src="/cloud.png" alt=""
          style={{ left: c.left, top: c.top, width: c.width, opacity: c.opacity }} />
      ))}
    </div>
  );
}

export function MascotCloud() {
  return (
    <div className="mascot-cloud">
      <img className="cloud-img" src="/cloud.png" alt="" />
      <img className="mascot-img" src="/mascot-cutout.png" alt="Uma's Library cougar mascot relaxing on a cloud" />
    </div>
  );
}
