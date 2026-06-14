type Props = {
  /** Rendered pixel size (width & height) in px. */
  size?: number;
  className?: string;
};

// "Nibble" logo: a rounded square with a bite scoop taken out of the top-right
// corner — the universal "something got nibbled" symbol. 16x16 grid.
//   '.' transparent   'X' solid fill
const GRID = [
  "...XXXXX........",
  "..XXXXXX........",
  ".XXXXXXX...XX...",
  ".XXXXXXX..XXXX..",
  "XXXXXXXX...XXXX.",
  "XXXXXXXXX...XXXX",
  "XXXXXXXXXX...XXX",
  "XXXXXXXXXXXX..XX",
  "XXXXXXXXXXXXXXXX",
  "XXXXXXXXXXXXXXXX",
  "XXXXXXXXXXXXXXXX",
  ".XXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXX.",
  "..XXXXXXXXXXXX..",
  "...XXXXXXXXXX...",
  ".....XXXXXX.....",
];

const FILL = "#1a1a1a";
const SIZE = 16;

/** Monochrome pixel-art "bite notch" mark for Nibble. */
function NibbleMark({ size = 64, className }: Props) {
  const cells: { x: number; y: number }[] = [];
  GRID.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "X") cells.push({ x, y });
    });
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Nibble"
    >
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={FILL} />
      ))}
    </svg>
  );
}

export default NibbleMark;
