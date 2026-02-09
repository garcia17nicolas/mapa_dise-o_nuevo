console.log('✅ Script mapa.js cargado');

(async () => {
  // Helper: fetch local geojson or remote fallback
  async function loadGeoJSON(pathLocal, fallbackUrl) {
    try {
      const r = await fetch(pathLocal);
      if (r.ok) return await r.json();
    } catch (e) {
      console.warn('No se pudo cargar local:', pathLocal, e);
    }

    try {
      const r2 = await fetch(fallbackUrl);
      if (r2.ok) return await r2.json();
    } catch (e) {
      console.error('No se pudo cargar fallback:', fallbackUrl, e);
    }
    return null;
  }

  // Small safe function to get a feature's display name
  function featureName(feature) {
    return (feature.properties && (feature.properties.MPIO_CNMBR || feature.properties.name || feature.properties.NOMBRE || feature.properties.NOMBRE_MUNIC)) || feature.id || 'Sin nombre';
  }

  // Build chart after loading geojson
  try {
    const geojson = await loadGeoJSON('./municipios.geojson', 'https://code.highcharts.com/mapdata/countries/co/co-all.geo.json');
    if (!geojson) throw new Error('No GeoJSON disponible');

    // Create chart
    const chart = Highcharts.mapChart('mapa', {
      chart: { map: geojson, animation: true, backgroundColor: '#ffffff' },
      title: { text: geojson.features && geojson.features.length > 30 ? 'Mapa' : 'Municipios' },
      subtitle: { text: 'Hover sobre un polígono para ver su nombre' },
      mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
      tooltip: { enabled: false },
      series: [{
        type: 'map',
        name: 'Áreas',
        mapData: geojson,
        joinBy: null,
        allAreas: false,
        color: '#d9eef6',
        borderColor: '#ffffff',
        borderWidth: 0.8,
        data: geojson.features.map((f, i) => ({
          name: featureName(f),
          value: 0,
          // preserve properties for later
          properties: f.properties
        })),
        dataLabels: { enabled: false },
        states: { hover: { color: 'rgba(70,130,180,0.5)' } },
        point: {
          events: {
            mouseOver: function () {
              // Log to console
              try { console.log('HOVER:', this.name); } catch (e) {}
              // Show HTML label
              try { showHoverLabel(this, chart); } catch (e) {}
              // Use Highcharts hover state to highlight the polygon (keeps highlight confined)
              try { this.setState('hover'); } catch (e) {}
            },
            mouseOut: function () {
              try { console.log('SALISTE:', this.name); } catch (e) {}
              try { hideHoverLabel(); } catch (e) {}
              try { this.setState(''); } catch (e) {}
            },
            click: function () {
              try { window.location.href = 'municipio.html?dept=' + encodeURIComponent(this.name); } catch (e) {}
            }
          }
        }
      }]
    });

    // Create floating HTML label inside #mapa
    const mapEl = document.getElementById('mapa');
    let hoverDiv = document.getElementById('mapHoverLabel');
    if (!hoverDiv) {
      hoverDiv = document.createElement('div');
      hoverDiv.id = 'mapHoverLabel';
      hoverDiv.style.position = 'absolute';
      hoverDiv.style.pointerEvents = 'none';
      hoverDiv.style.padding = '6px 10px';
      hoverDiv.style.background = 'rgba(0,0,0,0.75)';
      hoverDiv.style.color = '#fff';
      hoverDiv.style.borderRadius = '6px';
      hoverDiv.style.fontSize = '13px';
      hoverDiv.style.fontWeight = '700';
      hoverDiv.style.transform = 'translate(-50%, -120%)';
      hoverDiv.style.transition = 'opacity 120ms ease, transform 120ms ease';
      hoverDiv.style.opacity = '0';
      hoverDiv.style.zIndex = '2000';
      hoverDiv.style.whiteSpace = 'nowrap';
      mapEl.style.position = mapEl.style.position || 'relative';
      mapEl.appendChild(hoverDiv);
    }

    function showHoverLabel(point, chartRef) {
      if (!point || !point.name) return;
      const name = point.name;
      let px = 0, py = 0;
      try {
        if (typeof point.plotX === 'number' && typeof point.plotY === 'number') {
          px = chartRef.plotLeft + point.plotX;
          py = chartRef.plotTop + point.plotY;
        } else if (point.shapeArgs) {
          const sa = point.shapeArgs;
          px = chartRef.plotLeft + (sa.x || 0) + ((sa.width || 0) / 2);
          py = chartRef.plotTop + (sa.y || 0) + ((sa.height || 0) / 2);
        }
      } catch (e) { /* silent */ }
      hoverDiv.textContent = name;
      hoverDiv.style.left = px + 'px';
      hoverDiv.style.top = py + 'px';
      hoverDiv.style.opacity = '1';
      hoverDiv.style.transform = 'translate(-50%, -120%) scale(1)';
    }

    function hideHoverLabel() {
      if (!hoverDiv) return;
      hoverDiv.style.opacity = '0';
      hoverDiv.style.transform = 'translate(-50%, -120%) scale(0.95)';
    }

    console.log('✅ Mapa cargado con', (geojson.features && geojson.features.length) || 0, 'features');

  } catch (err) {
    console.error('Error inicializando mapa:', err);
  }
})();
