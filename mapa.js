if (typeof Highcharts === 'undefined') {
  alert('Error: Highcharts no se cargó correctamente. Revisa la consola.');
  throw new Error('Highcharts is not defined');
}

(async () => {
  // Ocultar loading cuando termine
  function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }

  function showError(message) {
    hideLoading();
    const mapaDiv = document.getElementById('mapa');
    mapaDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; color: #721c24; background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px;">
        <h3 style="margin-bottom: 10px;">❌ Error al cargar el mapa</h3>
        <p style="margin-bottom: 15px;">${message}</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
          🔄 Recargar página
        </button>
      </div>
    `;
  }

  async function loadGeoJSON(pathLocal, fallbackUrl) {
    try {
      const r = await fetch(pathLocal);
      if (r.ok) return await r.json();
    } catch (_) {}
    try {
      const r2 = await fetch(fallbackUrl);
      if (r2.ok) return await r2.json();
    } catch (_) {}
    return null;
  }

  function featureName(feature) {
    if (!feature || !feature.properties) return 'Sin nombre';
    const p = feature.properties;
    return p.MPIO_CNMBR || p.NOMBRE_MPIO || p.name || p.NOMBRE || p.NOMBRE_MUNIC || feature.id || 'Sin nombre';
  }

  // Calcular centroide de una geometría GeoJSON
  function getCentroid(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    let sumLat = 0, sumLon = 0, count = 0;
    function extractCoords(coords, depth) {
      if (depth === 0 && Array.isArray(coords[0])) {
        if (typeof coords[0][0] === 'number') {
          coords.forEach(c => { sumLon += c[0]; sumLat += c[1]; count++; });
        } else {
          coords.forEach(ring => extractCoords(ring, depth + 1));
        }
      }
    }
    extractCoords(geometry.coordinates, 0);
    return count > 0 ? { lon: sumLon / count, lat: sumLat / count } : null;
  }

  try {
    const geojson = await loadGeoJSON(
      './municipios.geojson',
      'https://raw.githubusercontent.com/caticoa3/colombia_mapa/master/co_2018_MGN_MPIO_POLITICO.geojson'
    );

    if (!geojson) throw new Error('No se pudo cargar ningún archivo GeoJSON (ni local ni remoto)');
    if (!geojson.features || geojson.features.length === 0) throw new Error('El GeoJSON no contiene features válidos');

    let caucaGeoJSON = geojson;
    if (geojson.features.length > 50) {
      const caucaFeatures = geojson.features.filter(f => f.properties && f.properties.DPTO_CCDGO === "19");
      if (caucaFeatures.length === 0) throw new Error('No se encontraron municipios del Cauca en el GeoJSON');
      caucaGeoJSON = { type: "FeatureCollection", features: caucaFeatures };
    }

    hideLoading();

    // Create chart
    const chart = Highcharts.mapChart('mapa', {
      chart: {
        map: caucaGeoJSON,
        animation: true,
        backgroundColor: '#ffffff'
      },
      
      title: {
        text: caucaGeoJSON.features.length > 30 ? '' : 'Municipios del Cauca',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333'
        }
      },
      
      subtitle: {
        text: caucaGeoJSON.features.length + ' municipios',
        style: {
          fontSize: '14px',
          color: '#666'
        }
      },
      
      mapNavigation: {
        enabled: true,
        buttonOptions: {
          verticalAlign: 'bottom',
          align: 'left'
        }
      },
      
      tooltip: {
        enabled: false // Usaremos nuestro tooltip personalizado
      },
      
      colorAxis: {
        min: 0,
        minColor: '#e3f2fd',
        maxColor: '#1976d2'
      },
      
      series: [{
        type: 'map',
        name: 'Municipios',
        mapData: caucaGeoJSON,
        joinBy: null,
        allAreas: false,
        color: '#d9eef6',
        borderColor: '#2c3e50',
        borderWidth: 1.2,
        
        data: caucaGeoJSON.features.map((f) => {
          const name = featureName(f);
          const center = getCentroid(f.geometry);
          
          // Nombres de municipios para clasificarlos manualmente si es necesario
          const regionColors = {
            // ORIENTE (Azul - #5DADE2)
            oriente: '#5DADE2',
            // OCCIDENTE (Verde - #58D68D)
            occidente: '#58D68D',
            // SUR (Amarillo - #F4D35E)
            sur: '#F4D35E',
            // CENTRO (Naranja - #F8A855)
            centro: '#F8A855',
            // NORTE (Rojo - #D97373)
            norte: '#D97373'
          };
          
          // Clasificar municipio por región según su nombre y coordenadas
          let region = 'centro';
          const munName = name.toUpperCase();
          
          // Clasificación basada en información proporcionada
          const orienteMunicipios = ['CALDONO', 'INZÁ', 'JAMBALÓ', 'PÁEZ', 'PURACÉ', 'SILVIA', 'TORIBÍO', 'TOTORÓ'];
          const occidenteMunicipios = ['GUAPI', 'LÓPEZ DE MICAY', 'TIMBIQUÍ'];
          const surMunicipios = ['ALMAGUER', 'ARGELIA', 'BALBOA', 'BOLÍVAR', 'FLORENCIA', 'LA VEGA', 'MERCADERES', 'PATÍA', 'PIAMONTE', 'SAN SEBASTIÁN', 'SANTA ROSA', 'SUCRE'];
          const centroMunicipios = ['CAJIBÍO', 'EL TAMBO', 'LA SIERRA', 'MORALES', 'PIENDAMÓ', 'POPAYÁN', 'ROSAS', 'SOTARÁ', 'TIMBÍO'];
          const norteMunicipios = ['BUENOS AIRES', 'CALOTO', 'CORINTO', 'GUACHENÉ', 'MIRANDA', 'PADILLA', 'PUERTO TEJADA', 'SANTANDER DE QUILICHAO', 'SUÁREZ', 'VILLA RICA'];
          
          // Asignar región según municipio
          if (orienteMunicipios.some(m => munName.includes(m))) {
            region = 'oriente';
          } else if (occidenteMunicipios.some(m => munName.includes(m))) {
            region = 'occidente';
          } else if (surMunicipios.some(m => munName.includes(m))) {
            region = 'sur';
          } else if (centroMunicipios.some(m => munName.includes(m))) {
            region = 'centro';
          } else if (norteMunicipios.some(m => munName.includes(m))) {
            region = 'norte';
          }
          
          return {
            name: name,
            value: 0,
            properties: f.properties,
            region: region,
            color: regionColors[region]
          };
        }),
        
        dataLabels: {
          enabled: false
        },
        
        states: {
          hover: {
            color: '#4682b4',
            borderColor: '#1e3a5f',
            borderWidth: 2
          }
        },
        
        point: {
          events: {
            mouseOver: function () {
              showHoverLabel(this, chart);
              this.setState('hover');
            },

            mouseOut: function () {
              hideHoverLabel();
              this.setState('');
            },

            click: function () {
              window.location.href = `municipio.html?dept=${encodeURIComponent(this.name)}`;
            }
          }
        }
      }],
      
      credits: {
        enabled: true,
        text: 'Nasa Kiwe - Departamento del Cauca',
        style: {
          fontSize: '10px'
        }
      }
    });

    // ===== TOOLTIP FLOTANTE PERSONALIZADO =====
    const mapEl = document.getElementById('mapa');
    let hoverDiv = document.getElementById('mapHoverLabel');
    
    if (!hoverDiv) {
      hoverDiv = document.createElement('div');
      hoverDiv.id = 'mapHoverLabel';
      hoverDiv.style.cssText = `
        position: absolute;
        pointer-events: none;
        padding: 8px 14px;
        background: linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(40,40,40,0.9) 100%);
        color: #fff;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transform: translate(-50%, -120%);
        transition: opacity 150ms ease, transform 150ms ease;
        opacity: 0;
        z-index: 2000;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
      `;
      
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
      } catch (e) {
        console.warn('Error calculando posición del tooltip:', e);
      }
      
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


  } catch (err) {
    console.error('❌ Error inicializando mapa:', err);
    showError(err.message);
  }
})();
