const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

function renderMap(props) {
  const panes = new Map();
  const shapes = [];
  const PaneContext = React.createContext("overlayPane");
  function Pane({ name, style, children }) {
    panes.set(name, style.zIndex);
    return React.createElement(PaneContext.Provider, { value: name }, children);
  }
  function shape(kind) {
    return function Shape(props) {
      const pane = React.useContext(PaneContext);
      shapes.push({ kind, pane, ...props });
      return React.createElement(React.Fragment, null, props.children);
    };
  }
  const container = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  const leaflet = {
    Pane,
    Polygon: shape("polygon"),
    CircleMarker: shape("circle"),
    MapContainer: container,
    Popup: container,
    Tooltip: container,
    Marker: container,
    TileLayer: () => null,
    useMap: () => ({}),
    useMapEvents: () => ({}),
  };
  const module = { exports: {} };
  const js = ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/components/FireMap.tsx"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const requireMock = (name) => {
    if (name === "react-leaflet") return leaflet;
    if (name === "leaflet") return { divIcon: (value) => value };
    if (name === "leaflet/dist/leaflet.css") return {};
    if (name === "@/components/AppState")
      return {
        useApp: () => ({
          desaList: [
            {
              id: "village",
              nama: "Test village",
              risk: "tinggi",
              alasan: "Test indicator",
            },
          ],
          loadMapData: async () => {},
        }),
      };
    if (name === "@/lib/ui-data")
      return {
        riskVar: { tinggi: "var(--risk-high)" },
        riskLabel: { tinggi: "Tinggi" },
      };
    if (name === "next/image") return () => null;
    return require(name);
  };
  new Function("require", "module", "exports", js)(
    requireMock,
    module,
    module.exports,
  );
  renderToStaticMarkup(
    React.createElement(module.exports.default, {
      showRisk: true,
      showHotspots: true,
      hideFalse: true,
      showReports: false,
      regions: [
        {
          id: "village",
          level: "desa",
          name: "Test village",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [114, -2],
                [115, -2],
                [115, -3],
                [114, -2],
              ],
            ],
          },
        },
      ],
      regionLevels: ["desa"],
      ...props,
    }),
  );
  return { panes, shapes };
}
const incident = {
  id: "incident",
  regionName: "Test village",
  hotspotCount: 7,
  status: "confirmed",
  latitude: -2.45,
  longitude: 114.1,
  lastDetectedAt: "2026-11-01T00:00:00Z",
};
const hotspot = {
  id: "hotspot",
  latitude: -2.45,
  longitude: 114.1,
  acqAt: "2026-11-01T00:00:00Z",
  confidenceLevel: "high",
  frp: 12,
  satellite: "NOAA",
  instrument: "VIIRS",
};

test("DBSCAN incident renders with risk visible even when no hotspot is loaded", () => {
  const { shapes } = renderMap({
    publicHotspots: [],
    publicIncidents: [incident],
  });
  assert.ok(
    shapes.some((s) => s.kind === "polygon" && s.pane === "barawatch-risk"),
  );
  const circles = shapes.filter((s) => s.kind === "circle");
  assert.equal(circles.length, 1);
  assert.deepEqual(circles[0].center, [incident.latitude, incident.longitude]);
  assert.equal(circles[0].pane, "barawatch-incidents");
});

test("risk and boundaries stay below clickable hotspot and incident layers", () => {
  const { panes, shapes } = renderMap({
    publicHotspots: [hotspot],
    publicIncidents: [incident],
    onSelectPublicHotspot: () => {},
  });
  const circles = shapes.filter((s) => s.kind === "circle");
  assert.equal(circles.length, 2);
  assert.ok(panes.get("barawatch-risk") > panes.get("barawatch-boundaries"));
  for (const circle of circles)
    assert.ok(panes.get(circle.pane) > panes.get("barawatch-risk"));
  assert.ok(panes.get("barawatch-incidents") > panes.get("barawatch-hotspots"));
  assert.equal(
    typeof circles.find((s) => s.pane === "barawatch-hotspots").eventHandlers
      .click,
    "function",
  );
});
