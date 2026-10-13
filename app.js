(function (root) {
  'use strict';
  // Omitted selections use defaults; an explicitly empty multi-selection matches nothing.
  function filterCafes(cafes, {
    districts = ['南山', '福田', '宝安'],
    statuses = ['确认还开', '大概率还开', '不确定'], batch = ''
  } = {}) {
    return cafes.filter(cafe => districts.includes(cafe.district)
      && statuses.includes(cafe.status) && (!batch || cafe.batch === batch));
  }
  function hasCoordinates(cafe) {
    return Number.isFinite(cafe.lat) && Number.isFinite(cafe.lng)
      && Math.abs(cafe.lat) <= 90 && Math.abs(cafe.lng) <= 180;
  }
  const api = { filterCafes, hasCoordinates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CafeFilters = api;

  if (typeof document === 'undefined') return;
  const colors = { '确认还开': '#27814f', '大概率还开': '#397ebc', '不确定': '#7b848b', '大概率已关': '#c45049' };
  const confidence = { high: '高', medium: '中', low: '低', none: '未定位' };
  const fieldLabels = {
    district: '区域', address: '地址', view: '景观', power: '插座',
    wifi_mbps: '网速', price: '价格', hours: '营业时间', notes: '备注',
    status: '营业状态', batch: '收录批次', lat: '纬度', lng: '经度',
    coord_confidence: '坐标准确度', coord_source: '坐标来源', source_url: '信息来源'
  };
  function displayValue(value) {
    return value == null || String(value).trim() === '' ? '—' : String(value);
  }
  // Build details with textContent, so source data never becomes executable HTML.
  function cafeDetails(cafe, inDialog = false) {
    const container = document.createElement('article');
    container.className = 'cafe-details';
    const title = document.createElement('h2');
    title.textContent = displayValue(cafe.name);
    if (inDialog) title.id = 'dialog-title';
    container.append(title);
    const badge = document.createElement('p');
    badge.className = 'status-badge';
    badge.textContent = `${displayValue(cafe.district)} · ${displayValue(cafe.status)}`;
    container.append(badge);
    if (cafe.coord_confidence === 'low') {
      const note = document.createElement('p');
      note.className = 'position-note';
      note.textContent = '位置为大致位置';
      container.append(note);
    }
    const list = document.createElement('dl');
    for (const [field, label] of Object.entries(fieldLabels)) {
      const term = document.createElement('dt');
      term.textContent = label;
      const value = document.createElement('dd');
      value.textContent = displayValue(cafe[field]);
      if (field === 'coord_confidence' && cafe[field]) value.textContent = confidence[cafe[field]] || cafe[field];
      if (field === 'wifi_mbps' && cafe[field] != null && cafe[field] !== '') value.textContent += ' Mbps';
      if (field === 'source_url' && /^https?:\/\//i.test(cafe[field] || '')) {
        const link = document.createElement('a');
        link.href = cafe[field];
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = '查看来源 ↗';
        link.setAttribute('aria-label', `查看${displayValue(cafe.name)}的信息来源（新标签页）`);
        value.replaceChildren(link);
      }
      list.append(term, value);
    }
    container.append(list);
    return container;
  }

  let visibleCount = 0;
  root.__visibleCount = () => visibleCount;
  const form = document.getElementById('filters');
  const panel = document.getElementById('filter-panel');
  const dialog = document.getElementById('cafe-dialog');
  const message = document.getElementById('load-message');
  const mobile = root.matchMedia('(max-width: 700px)');
  panel.open = !mobile.matches;
  mobile.addEventListener('change', event => { panel.open = !event.matches; });
  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  form.addEventListener('submit', event => event.preventDefault());

  async function initialize() {
    const response = await fetch('data/cafes.json');
    if (!response.ok) throw new Error('数据加载失败');
    const data = await response.json();
    if (!Array.isArray(data.cafes)) throw new Error('数据格式错误');
    if (!root.L) throw new Error('地图组件加载失败');
    const L = root.L;
    const map = L.map('map', { scrollWheelZoom: false }).setView([22.53, 113.96], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 贡献者'
    }).addTo(map);
    const markers = L.layerGroup().addTo(map);
    const overviewBounds = L.latLngBounds(data.cafes.filter(hasCoordinates).map(c => [c.lat, c.lng]));
    function overview() { map.fitBounds(overviewBounds, { padding: [24, 24], maxZoom: 12 }); }
    overview();
    map.zoomControl._zoomInButton.title = '放大';
    map.zoomControl._zoomOutButton.title = '缩小';
    map.zoomControl._zoomInButton.setAttribute('aria-label', '放大');
    map.zoomControl._zoomOutButton.setAttribute('aria-label', '缩小');
    document.getElementById('overview').addEventListener('click', overview);
    function render() {
      const selection = new FormData(form);
      const visible = filterCafes(data.cafes, {
        districts: selection.getAll('district'), statuses: selection.getAll('status'),
        batch: selection.get('batch')
      });
      markers.clearLayers();
      map.closePopup();
      const located = visible.filter(hasCoordinates);
      visibleCount = located.length;
      document.getElementById('count').textContent = visibleCount;
      document.getElementById('result-note').textContent = visibleCount ? '' : '暂无符合条件的标记';
      for (const cafe of located) {
        const low = cafe.coord_confidence === 'low';
        const marker = L.circleMarker([cafe.lat, cafe.lng], {
          radius: 8, color: colors[cafe.status] || colors['不确定'],
          fillColor: colors[cafe.status] || colors['不确定'], weight: 2,
          dashArray: low ? '3 3' : null, opacity: low ? 0.6 : 1, fillOpacity: low ? 0.3 : 0.75
        }).addTo(markers);
        marker.bindPopup(() => {
          marker.getPopup().options.maxWidth = Math.min(320, root.innerWidth - 72);
          return cafeDetails(cafe);
        }, {
          maxWidth: Math.min(320, root.innerWidth - 72), minWidth: 180,
          autoPanPadding: [12, 12]
        });
        marker.on('popupopen', event => {
          const close = event.popup.getElement().querySelector('.leaflet-popup-close-button');
          close.title = '关闭详情';
          close.setAttribute('aria-label', '关闭详情');
        });
        const path = marker.getElement();
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', `${cafe.name}，${cafe.status}，查看详情`);
        path.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); marker.openPopup(); }
        });
      }
      const unlocated = visible.filter(c => !hasCoordinates(c));
      document.getElementById('unlocated-count').textContent = unlocated.length;
      const list = document.getElementById('unlocated-list');
      list.replaceChildren();
      for (const cafe of unlocated) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = displayValue(cafe.name);
        const caption = document.createElement('small');
        caption.textContent = `${displayValue(cafe.district)} · ${displayValue(cafe.status)}`;
        button.append(caption);
        button.addEventListener('click', () => {
          document.getElementById('dialog-content').replaceChildren(cafeDetails(cafe, true));
          dialog.showModal();
        });
        item.append(button);
        list.append(item);
      }
      if (!unlocated.length) {
        const item = document.createElement('li');
        item.textContent = '暂无符合条件的未定位咖啡店';
        list.append(item);
      }
    }
    form.addEventListener('change', render);
    form.addEventListener('reset', () => root.setTimeout(render, 0));
    new ResizeObserver(() => {
      map.invalidateSize();
      map.closePopup();
    }).observe(document.getElementById('map'));
    render();
    message.hidden = true;
  }
  initialize().catch(error => {
    message.hidden = false;
    message.textContent = `${error.message}，请刷新页面重试。`;
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
