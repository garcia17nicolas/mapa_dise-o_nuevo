console.log('✅ Script mapa.js cargado');

(async () => {
  try {
    console.log('✅ Highcharts disponible:', typeof Highcharts !== 'undefined');
    
    // Cargar el GeoJSON del mapa de Colombia
    const geojson = await fetch(
      'https://code.highcharts.com/mapdata/countries/co/co-all.geo.json'
    ).then(res => res.json());

    console.log('✅ GeoJSON cargado con', geojson.features.length, 'departamentos');

    // Crear el mapa
    const chart = Highcharts.mapChart('mapa', {
      chart: {
        map: geojson,
        borderWidth: 1,
        backgroundColor: '#ffffff'
      },

      title: {
        text: 'Mapa de Colombia'
      },

      subtitle: {
        text: 'Haz click en un departamento para hacer zoom | Click derecho para alejarse'
      },

      colorAxis: {
        min: 0,
        max: 100,
        type: 'linear',
        minColor: '#e8f4f8',
        maxColor: '#003d5c'
      },

      tooltip: {
        enabled: true,
        headerFormat: '',
        pointFormat: '<b>{point.name}</b><br/>Valor: {point.value:.0f}'
      },

      mapNavigation: {
        enabled: true,
        buttonOptions: {
          verticalAlign: 'bottom'
        }
      },

      series: [
        {
          type: 'map',
          name: 'Departamentos',
          mapData: geojson,
          
          // Generar datos para cada feature del mapa
          data: geojson.features.map((feature, idx) => ({
            name: feature.properties.name,
            value: Math.round(Math.random() * 100)
          })),

          // Mostrar nombres en el mapa
          dataLabels: {
            enabled: true,
            format: '{point.name}',
            style: {
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#000',
              textOutline: '1px #fff'
            }
          },

          // Estilos normales
          color: '#dcdcdc',
          borderColor: '#666',
          borderWidth: 0.5
        }
      ]
    });

    console.log('✅ Mapa creado');

    // Agregar hover manualmente a los paths del SVG
    setTimeout(() => {
      const paths = document.querySelectorAll('#mapa svg path.highcharts-point');
      console.log('✅ Paths encontrados:', paths.length);

      paths.forEach((path, idx) => {
        const point = chart.series[0].points[idx];
        
        if (point) {
          path.style.cursor = 'pointer';
          
          path.addEventListener('mouseenter', () => {
            console.log('✅ HOVER:', point.name);
            path.style.fill = '#FF0000';
            path.style.stroke = '#000';
            path.style.strokeWidth = '2';
          });

          path.addEventListener('mouseleave', () => {
            console.log('❌ SALISTE:', point.name);
            path.style.fill = '';
            path.style.stroke = '';
            path.style.strokeWidth = '';
          });

          // CLICK PARA ZOOM
          path.addEventListener('click', () => {
            console.log('🖱️ CLICK:', point.name);
            zoomToDepartment(point.name, geojson);
          });

          // CLICK DERECHO PARA ZOOM OUT
          path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            console.log('🔍 ZOOM OUT');
            zoomOutToFullMap();
          });
        }
      });

      console.log('✅ Eventos de hover y zoom agregados');
    }, 500);

    // ===== FUNCIONES DE ZOOM =====

    function zoomToDepartment(departmentName, geojson) {
      const feature = geojson.features.find(f => f.properties.name === departmentName);
      if (!feature) return;

      const bbox = feature.bbox || getBbox(feature.geometry.coordinates);
      
      console.log(`🔍 Zoom a ${departmentName}:`, bbox);

      // Aplicar zoom
      chart.xAxis[0].setExtremes(bbox[0], bbox[2]);
      chart.yAxis[0].setExtremes(bbox[1], bbox[3]);

      // Mostrar botón de zoom out
      showZoomOutButton();
    }

    function zoomOutToFullMap() {
      console.log('🔍 Volviendo al mapa completo');
      
      // Resetear ejes al rango original
      chart.xAxis[0].setExtremes(null, null);
      chart.yAxis[0].setExtremes(null, null);

      hideZoomOutButton();
    }

    function showZoomOutButton() {
      let btn = document.getElementById('zoomOutBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'zoomOutBtn';
        btn.innerHTML = '🔍 Zoom Out';
        btn.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 10px 15px;
          background-color: #FF6B6B;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          z-index: 1000;
        `;
        btn.onclick = zoomOutToFullMap;
        document.getElementById('mapa').style.position = 'relative';
        document.getElementById('mapa').parentElement.appendChild(btn);
      }
      btn.style.display = 'block';
    }

    function hideZoomOutButton() {
      const btn = document.getElementById('zoomOutBtn');
      if (btn) btn.style.display = 'none';
    }

    function getBbox(coordinates) {
      // Calcular bounding box de las coordenadas
      let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

      function processCoord(coord) {
        if (typeof coord[0] === 'number') {
          minLon = Math.min(minLon, coord[0]);
          maxLon = Math.max(maxLon, coord[0]);
          minLat = Math.min(minLat, coord[1]);
          maxLat = Math.max(maxLat, coord[1]);
        } else {
          coord.forEach(processCoord);
        }
      }

      processCoord(coordinates);
      return [minLon, minLat, maxLon, maxLat];
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
