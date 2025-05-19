// GeoJsonLayerToMap

import maplibregl from 'maplibre-gl';

export function addGeoJsonLayerToMap(
  map: maplibregl.Map,
  division: { Division: string; DivisionName: string; Geojson: string },
  index: number
) {
  const geojsonData = JSON.parse(division.Geojson);
  const sourceId = `floorplan-${index}`;
  const layerId = `room-extrusion-${index}`;

  map.addSource(sourceId, {
    type: 'geojson',
    data: geojsonData,
  });

  map.addLayer({
    id: layerId,
    type: 'fill-extrusion',
    source: sourceId,
    paint: {
      'fill-extrusion-color': [
        'case',
        ['==', ['geometry-type'], 'Polygon'], '#add8e6',
        '#00008b'
      ],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base_height'],
      'fill-extrusion-opacity': 0.6,
    },
  });
}
