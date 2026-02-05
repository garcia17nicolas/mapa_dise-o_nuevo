// municipio.js - Lee datos publicados desde la API (público)
const API_BASE = 'http://localhost:3000/api';

(function(){
  function qs(key){
    const params = new URLSearchParams(location.search);
    return params.get(key);
  }

  const dept = qs('dept') || 'Desconocido';
  const title = document.getElementById('title');
  if(title) title.textContent = `Municipio: ${dept}`;

  const form = document.getElementById('infoForm');
  const filterYear = document.getElementById('filterYear');
  const clearFilter = document.getElementById('clearFilter');
  const entriesDiv = document.getElementById('entries');

  // Ocultar el formulario (solo lectura en la vista pública)
  if(form) form.style.display = 'none';

  function escapeHtml(s){ 
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); 
  }

  async function loadAndRender(year) {
    if (!entriesDiv) return;
    try {
      const res = await fetch(`${API_BASE}/municipio/${encodeURIComponent(dept)}`);
      const entries = await res.json();
      
      entriesDiv.innerHTML = '';
      const filtered = year ? entries.filter(e => String(e.year) === String(year)) : entries;
      
      if (filtered.length === 0) { 
        entriesDiv.innerHTML = '<p style="color:#999;">No hay información disponible.</p>'; 
        return; 
      }
      
      filtered.forEach(e => {
        const el = document.createElement('div');
        el.className = 'entry';
        el.innerHTML = `
          <div class="controls"><strong>Año: ${e.year}</strong></div>
          <p>${escapeHtml(e.text)}</p>
        `;
        if (e.fileName && e.fileData) {
          const a = document.createElement('a');
          a.href = e.fileData;
          a.download = e.fileName;
          a.textContent = 'Descargar archivo (' + e.fileName + ')';
          a.style.display = 'block';
          a.style.marginTop = '10px';
          el.appendChild(a);
        }
        entriesDiv.appendChild(el);
      });
    } catch (err) {
      console.error('Error cargando datos:', err);
      entriesDiv.innerHTML = '<p style="color:red;">Error al cargar información.</p>';
    }
  }

  function populateYearFilter(){
    if (!filterYear) return;
    fetch(`${API_BASE}/municipio/${encodeURIComponent(dept)}`)
      .then(res => res.json())
      .then(entries => {
        const years = new Set(entries.map(e => e.year));
        const now = new Date().getFullYear();
        for (let y = now; y >= 2000; y--) { years.add(y); }
        const arr = Array.from(years).sort((a, b) => b - a);
        filterYear.innerHTML = '<option value="">-- Todos los años --</option>' + arr.map(y => `<option value="${y}">${y}</option>`).join('');
      })
      .catch(err => console.error('Error cargando años:', err));
  }

  if (filterYear) filterYear.addEventListener('change', () => loadAndRender(filterYear.value || null));
  if (clearFilter) clearFilter.addEventListener('click', () => { if (filterYear) filterYear.value = ''; loadAndRender(null); });

  // Inicializar
  console.log('✅ Vista pública del municipio:', dept);
  populateYearFilter();
  loadAndRender(null);

})();
