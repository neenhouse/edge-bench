// generate-map.ts — Convert Natural Earth 110m TopoJSON to SVG paths
// Run: deno run --allow-net generate-map.ts

// Equirectangular projection
function project(lon: number, lat: number, width = 1000, height = 520): [number, number] {
  const x = (lon + 180) / 360 * width;
  const y = (90 - lat) / 180 * height;
  return [x, y];
}

// Decode TopoJSON delta-encoded arcs
function decodeArc(arc: number[][], transform: { scale: number[]; translate: number[] }): number[][] {
  const { scale, translate } = transform;
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
}

// Convert a ring (array of coordinate pairs) to SVG path segment
function ringToPath(coords: number[][], width: number, height: number): string {
  const parts: string[] = [];
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const [x, y] = project(lon, lat, width, height);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

// Resolve TopoJSON arc references into coordinate arrays
function resolveArcs(
  arcIndices: number[],
  decodedArcs: number[][][]
): number[][] {
  const coords: number[][] = [];
  for (const idx of arcIndices) {
    let arc: number[][];
    if (idx >= 0) {
      arc = decodedArcs[idx];
    } else {
      // Negative index means reversed arc
      arc = [...decodedArcs[~idx]].reverse();
    }
    // Avoid duplicating the joining point
    const start = coords.length > 0 ? 1 : 0;
    for (let i = start; i < arc.length; i++) {
      coords.push(arc[i]);
    }
  }
  return coords;
}

interface TopoJSON {
  type: string;
  transform: { scale: number[]; translate: number[] };
  arcs: number[][][];
  objects: {
    [key: string]: {
      type: string;
      geometries: Array<{
        type: string;
        arcs: number[][] | number[][][];
        properties?: Record<string, unknown>;
      }>;
    };
  };
}

async function main() {
  // Fetch the 110m countries TopoJSON
  const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
  const res = await fetch(url);
  const topo: TopoJSON = await res.json();

  // Decode all arcs
  const decodedArcs = topo.arcs.map(arc => decodeArc(arc, topo.transform));

  // Get the land object (merged country outlines)
  const objectKey = Object.keys(topo.objects)[0]; // 'countries'
  const geometries = topo.objects[objectKey].geometries;

  const WIDTH = 1000;
  const HEIGHT = 520;

  // Build SVG paths for all countries
  const paths: string[] = [];

  for (const geom of geometries) {
    const pathParts: string[] = [];

    if (geom.type === 'Polygon') {
      const rings = geom.arcs as number[][];
      for (const ring of rings) {
        const coords = resolveArcs(ring, decodedArcs);
        pathParts.push(ringToPath(coords, WIDTH, HEIGHT));
      }
    } else if (geom.type === 'MultiPolygon') {
      const polygons = geom.arcs as number[][][];
      for (const polygon of polygons) {
        for (const ring of polygon) {
          const coords = resolveArcs(ring, decodedArcs);
          pathParts.push(ringToPath(coords, WIDTH, HEIGHT));
        }
      }
    }

    if (pathParts.length > 0) {
      paths.push(pathParts.join(' '));
    }
  }

  // Combine all paths into a single <path> for performance
  const combinedPath = paths.join(' ');

  // Generate graticule lines (30° intervals)
  const graticuleLines: string[] = [];

  // Latitude lines
  for (let lat = -60; lat <= 90; lat += 30) {
    const parts: string[] = [];
    for (let lon = -180; lon <= 180; lon += 5) {
      const [x, y] = project(lon, lat, WIDTH, HEIGHT);
      parts.push(`${lon === -180 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    graticuleLines.push(parts.join(' '));
  }

  // Longitude lines
  for (let lon = -180; lon <= 180; lon += 30) {
    const parts: string[] = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      const [x, y] = project(lon, lat, WIDTH, HEIGHT);
      parts.push(`${lat === -90 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    graticuleLines.push(parts.join(' '));
  }

  const graticulePath = graticuleLines.join(' ');

  // Region dots with accurate positions
  const regions = [
    { id: 'region-us-east', lat: 39.04, lon: -77.49, r: 5, pulse: true, delay: null },
    { id: 'region-us-west', lat: 45.60, lon: -121.18, r: 5, pulse: true, delay: '0.8s' },
    { id: 'region-us-central', lat: 41.26, lon: -95.86, r: 4, pulse: false, delay: null },
    { id: 'region-sa', lat: -23.55, lon: -46.63, r: 5, pulse: true, delay: '1.2s' },
    { id: 'region-eu-west', lat: 53.35, lon: -6.26, r: 5, pulse: true, delay: '0.4s' },
    { id: 'region-eu-north', lat: 60.17, lon: 24.94, r: 4, pulse: false, delay: null },
    { id: 'region-eu-east', lat: 52.23, lon: 21.01, r: 4, pulse: false, delay: null },
    { id: 'region-me', lat: 26.07, lon: 50.55, r: 4, pulse: false, delay: null },
    { id: 'region-af', lat: -26.20, lon: 28.04, r: 4, pulse: false, delay: null },
    { id: 'region-ap', lat: 1.35, lon: 103.82, r: 5, pulse: true, delay: '1.6s' },
    { id: 'region-ap-jp', lat: 35.68, lon: 139.69, r: 5, pulse: true, delay: '0.6s' },
    { id: 'region-ap-hk', lat: 22.32, lon: 114.17, r: 4, pulse: false, delay: null },
    { id: 'region-ap-in', lat: 19.08, lon: 72.88, r: 4, pulse: false, delay: null },
    { id: 'region-ap-kr', lat: 37.57, lon: 126.98, r: 4, pulse: false, delay: null },
    { id: 'region-au', lat: -33.87, lon: 151.21, r: 5, pulse: true, delay: '2.0s' },
  ];

  // Output region dot SVG
  const regionSvg = regions.map(r => {
    const [cx, cy] = project(r.lon, r.lat, WIDTH, HEIGHT);
    const cxStr = cx.toFixed(1);
    const cyStr = cy.toFixed(1);

    let svg = `        <g id="${r.id}">\n`;
    svg += `          <circle class="region-node" cx="${cxStr}" cy="${cyStr}" r="${r.r}"/>`;
    if (r.pulse) {
      const delayAttr = r.delay ? ` style="animation-delay: ${r.delay}"` : '';
      svg += `\n          <circle class="region-pulse" cx="${cxStr}" cy="${cyStr}" r="4"${delayAttr}/>`;
    }
    svg += `\n        </g>`;
    return svg;
  }).join('\n\n');

  // Output the full SVG content (everything inside the <svg> tag)
  console.log(`        <!-- Ocean background -->
        <rect width="1000" height="520" fill="#18181b" rx="6"/>

        <!-- Graticule (30deg grid) -->
        <path class="graticule" d="${graticulePath}"/>

        <!-- Continents (Natural Earth 110m) -->
        <path class="continent" d="${combinedPath}"/>

        <!-- Deno Deploy Region Nodes -->

${regionSvg}

        <!-- Region labels (on hover via CSS title) -->
        <title>EdgeBench World Map — Deno Deploy Regions</title>`);
}

main();
