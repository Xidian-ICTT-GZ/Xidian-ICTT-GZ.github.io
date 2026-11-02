(function () {
  var element = document.getElementById('map');
  if (!element) return;
  if (!window.L) {
    element.classList.add('map-unavailable');
    element.textContent = '地图暂时无法加载，请参考下方地址。';
    return;
  }
  // Show the general area; the postal address below remains the source of truth.
  var map = L.map(element, { scrollWheelZoom: false }).setView([23.307, 113.568], 15);
  L.tileLayer('https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, OpenStreetMap France'
  }).addTo(map);
})();
