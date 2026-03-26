console.log('✅ Script mapa.js cargado');

// ✅ VERIFICAR que Highcharts esté disponible
if (typeof Highcharts === 'undefined') {
  console.error('❌ ERROR: Highcharts no está cargado. Asegúrate de incluir el script de Highcharts ANTES de mapa.js');
  alert('Error: Highcharts no se cargó correctamente. Revisa la consola.');
  throw new Error('Highcharts is not defined');
}

console.log('✅ Highcharts detectado correctamente');

(async () => {
  // Ocultar loading cuando termine
  function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }

  // Mostrar error visual
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

  // Helper: fetch local geojson or remote fallback
  async function loadGeoJSON(pathLocal, fallbackUrl) {
    console.log('🔍 Intentando cargar:', pathLocal);
    
    // Primero intentar local
    try {
      const r = await fetch(pathLocal);
      if (r.ok) {
        const data = await r.json();
        console.log('✅ GeoJSON local cargado:', pathLocal);
        return data;
      }
      console.warn('⚠️ No se pudo cargar local (status:', r.status, ')');
    } catch (e) {
      console.warn('⚠️ Error cargando local:', pathLocal, e.message);
    }

    // Intentar fallback
    console.log('🔍 Intentando fallback:', fallbackUrl);
    try {
      const r2 = await fetch(fallbackUrl);
      if (r2.ok) {
        const data = await r2.json();
        console.log('✅ GeoJSON fallback cargado:', fallbackUrl);
        return data;
      }
      console.error('❌ Fallback falló (status:', r2.status, ')');
    } catch (e) {
      console.error('❌ Error cargando fallback:', fallbackUrl, e.message);
    }
    
    return null;
  }

  // Small safe function to get a feature's display name
  function featureName(feature) {
    if (!feature || !feature.properties) return 'Sin nombre';
    
    const props = feature.properties;
    return props.MPIO_CNMBR || 
           props.NOMBRE_MPIO || 
           props.name || 
           props.NOMBRE || 
           props.NOMBRE_MUNIC || 
           feature.id || 
           'Sin nombre';
  }

  // Build chart after loading geojson
  try {
    // Intentar cargar GeoJSON
    const geojson = await loadGeoJSON(
      './municipios.geojson',
      'https://raw.githubusercontent.com/caticoa3/colombia_mapa/master/co_2018_MGN_MPIO_POLITICO.geojson'
    );

    if (!geojson) {
      throw new Error('No se pudo cargar ningún archivo GeoJSON (ni local ni remoto)');
    }

    if (!geojson.features || geojson.features.length === 0) {
      throw new Error('El GeoJSON no contiene features válidos');
    }

    console.log('📊 Features encontrados:', geojson.features.length);

    // Filtrar solo el Cauca si estamos usando el archivo de Colombia completo
    let caucaGeoJSON = geojson;
    if (geojson.features.length > 50) {
      console.log('🔍 Detectado archivo de Colombia completo, filtrando solo Cauca...');
      const caucaFeatures = geojson.features.filter(f => {
        return f.properties && f.properties.DPTO_CCDGO === "19";
      });
      
      if (caucaFeatures.length === 0) {
        throw new Error('No se encontraron municipios del Cauca en el GeoJSON');
      }

      caucaGeoJSON = {
        type: "FeatureCollection",
        features: caucaFeatures
      };
      
      console.log('✅ Filtrado completado:', caucaFeatures.length, 'municipios del Cauca');
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
        
        data: caucaGeoJSON.features.map((f, i) => {
          const name = featureName(f);
          
          // Función para calcular el centroide de la geometría
          function getCentroid(geometry) {
            if (!geometry || !geometry.coordinates) return null;
            
            let sumLat = 0, sumLon = 0, count = 0;
            
            function extractCoords(coords, depth = 0) {
              if (depth === 0 && Array.isArray(coords[0])) {
                if (typeof coords[0][0] === 'number') {
                  // Array de coordenadas
                  coords.forEach(coord => {
                    sumLon += coord[0];
                    sumLat += coord[1];
                    count++;
                  });
                } else {
                  // Array de arrays (Polygon o MultiPolygon)
                  coords.forEach(ring => extractCoords(ring, depth + 1));
                }
              }
            }
            
            extractCoords(geometry.coordinates);
            return count > 0 ? { lon: sumLon / count, lat: sumLat / count } : null;
          }
          
          // Obtener centro del municipio
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
              try {
                console.log('🖱️ HOVER:', this.name);
                showHoverLabel(this, chart);
                this.setState('hover');
              } catch (e) {
                console.error('Error en mouseOver:', e);
              }
            },
            
            mouseOut: function () {
              try {
                console.log('👋 SALISTE:', this.name);
                hideHoverLabel();
                this.setState('');
              } catch (e) {
                console.error('Error en mouseOut:', e);
              }
            },
            
            click: function () {
              try {
                console.log('🖱️ CLICK:', this.name);
                // Redirigir a página de detalles del municipio
                const municipio = encodeURIComponent(this.name);
                window.location.href = `municipio.html?dept=${municipio}`;
              } catch (e) {
                console.error('Error en click:', e);
                alert('Detalles del municipio: ' + this.name);
              }
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

    console.log('✅ Mapa cargado exitosamente con', caucaGeoJSON.features.length, 'municipios');
    console.log('🎉 Todo funcionando correctamente!');

    // ===== CARGAR ENTRADAS Y FILTRAR POR AÑO =====
    let allEntries = [];
    let availableYears = [];
    
    // Función para cargar todas las entradas de todos los municipios
    async function loadAllEntries() {
      console.log('📥 Cargando entradas de todos los municipios...');
      
      const municipios = chart.series[0].data;
      allEntries = [];
      
      for (const municipio of municipios) {
        try {
          const response = await fetch(`/api/municipio/${encodeURIComponent(municipio.name)}`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              data.forEach(entry => {
                allEntries.push({
                  municipio: municipio.name,
                  ...entry
                });
              });
            }
          }
        } catch (e) {
          console.warn(`⚠️ Error cargando entradas de ${municipio.name}:`, e);
        }
      }
      
      console.log('✅ Total de entradas cargadas:', allEntries.length);
      extractYears();
    }
    
    // Función para extraer años únicos de las entradas
    function extractYears() {
      const yearsSet = new Set();
      
      allEntries.forEach(entry => {
        if (entry.year) {
          yearsSet.add(parseInt(entry.year));
        } else if (entry.createdAt) {
          const year = new Date(entry.createdAt).getFullYear();
          yearsSet.add(year);
        }
      });
      
      availableYears = Array.from(yearsSet).sort((a, b) => a - b);
      
      if (availableYears.length > 0) {
        const minYear = Math.min(...availableYears);
        const maxYear = Math.max(...availableYears);
        const yearSlider = document.getElementById('yearSlider');
        
        yearSlider.min = minYear;
        yearSlider.max = maxYear;
        yearSlider.value = maxYear;
        document.getElementById('yearDisplay').textContent = maxYear;
        
        console.log('📅 Años disponibles:', availableYears, 'Rango:', minYear, '-', maxYear);
      }
      
      updateMapColors(parseInt(document.getElementById('yearSlider').value));
    }
    
    // Función para actualizar los colores del mapa según el año
    function updateMapColors(selectedYear) {
      console.log('🎨 Actualizando colores para año:', selectedYear);
      
      // Contar entradas por municipio para el año seleccionado
      const entriesByMunicipio = {};
      const municipios = chart.series[0].data;
      
      // Inicializar contador
      municipios.forEach(m => {
        entriesByMunicipio[m.name] = 0;
      });
      
      // Contar entradas del año seleccionado
      allEntries.forEach(entry => {
        const entryYear = entry.year ? parseInt(entry.year) : null;
        if (entryYear === selectedYear) {
          entriesByMunicipio[entry.municipio]++;
        }
      });
      
      // Actualizar colores basados en cantidad de entradas
      municipios.forEach(punto => {
        const count = entriesByMunicipio[punto.name] || 0;
        
        // Definir color basado en cantidad
        let newColor = punto.color || '#d9eef6';
        
        if (count === 0) {
          // Sin entradas: color gris suave
          newColor = '#e8e8e8';
        } else if (count === 1) {
          // 1 entrada: amarillo claro (F4D35E)
          newColor = '#FFE082';
        } else if (count <= 3) {
          // 2-3 entradas: amarillo medio
          newColor = '#FDD835';
        } else if (count <= 5) {
          // 4-5 entradas: naranja
          newColor = '#FB8C00';
        } else if (count <= 10) {
          // 6-10 entradas: rojo-naranja
          newColor = '#F4511E';
        } else {
          // > 10 entradas: rojo intenso (D97373)
          newColor = '#D97373';
        }
        
        punto.update({ color: newColor });
      });
      
      // Actualizar tooltip de información
      updateChartInfo(selectedYear, entriesByMunicipio);
    }
    
    // Función para actualizar información del mapa
    function updateChartInfo(year, entriesByMunicipio) {
      const totalEntries = Object.values(entriesByMunicipio).reduce((a, b) => a + b, 0);
      const municipiosConDatos = Object.values(entriesByMunicipio).filter(c => c > 0).length;
      
      console.log(`📊 Año ${year}: ${totalEntries} entradas en ${municipiosConDatos} municipios`);
    }
    
    // Event listener del slider de años
    const yearSlider = document.getElementById('yearSlider');
    if (yearSlider) {
      yearSlider.addEventListener('input', function() {
        const year = parseInt(this.value);
        document.getElementById('yearDisplay').textContent = year;
        updateMapColors(year);
      });
    }
    
    // Cargar todas las entradas al iniciar
    await loadAllEntries();

  } catch (err) {
    console.error('❌ Error inicializando mapa:', err);
    showError(err.message);
  }
})();
