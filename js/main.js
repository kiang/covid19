var sidebar = new ol.control.Sidebar({ element: 'sidebar', position: 'right' });
var jsonFiles, filesLength, fileKey = 0;

var projection = ol.proj.get('EPSG:3857');
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
for (var z = 0; z < 20; ++z) {
  // generate resolutions and matrixIds arrays for this WMTS
  resolutions[z] = size / Math.pow(2, z);
  matrixIds[z] = z;
}

var sidebarTitle = document.getElementById('sidebarTitle');
var content = document.getElementById('sidebarContent');
var cityMeta = {};

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.221507, 23.000694]),
  zoom: 14
});

var vectorPoints = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'https://kiang.github.io/nidss.cdc.gov.tw/data/points.json',
    format: new ol.format.GeoJSON({
      featureProjection: appView.getProjection()
    })
  }),
  style: pointStyle,
  zIndex: 100
});

var city = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'https://kiang.github.io/taiwan_basecode/city/city.topo.json',
    format: new ol.format.TopoJSON({
      featureProjection: appView.getProjection()
    })
  }),
  style: cityStyle,
  zIndex: 50
});

var map = new ol.Map({
  layers: [city, vectorPoints],
  target: 'map',
  view: appView
});

map.addControl(sidebar);
var pointClicked = false;
map.on('singleclick', function (evt) {
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      firstPosDone = true;
      currentFeature = feature;
      if (lastFeature) {
        if(lastFeatureType === 'point') {
          lastFeature.setStyle(pointStyle);
        } else {
          lastFeature.setStyle(cityStyle);
        }
      }
      var p = feature.getProperties();
      if (p.COUNTYNAME) {
        var cityKey = p.COUNTYNAME + p.TOWNNAME;
        var message = '';
        message += '<table class="table table-dark"><tbody>';
        message += '<tr><th scope="row">確診數量</th><td>' + cityMeta[cityKey].confirmed + '</td></tr>';
        message += '<tr><th scope="row">人口</th><td>' + cityMeta[cityKey].population + '</td></tr>';
        message += '<tr><th scope="row">比率</th><td>' + cityMeta[cityKey].rate + '(每萬人口)</td></tr>';
        message += '</tbody></table>';
        sidebarTitle.innerHTML = p.COUNTYNAME + p.TOWNNAME;
        currentFeature.setStyle(cityStyle);
        lastFeatureType = 'area';
      } else {
        var message = '';
        message += '<table class="table table-dark"><tbody>';
        for(k in p) {
          if(k !== 'geometry') {
            message += '<tr><th scope="row">' + k + '</th><td>' + p[k] + '</td></tr>';
          }
        }
        message += '</tbody></table>';
        sidebarTitle.innerHTML = p['站名'];
        currentFeature.setStyle(pointStyle);
        lastFeatureType = 'point';
      }

      lastFeature = currentFeature;
      content.innerHTML = message;
      sidebar.open('home');
      pointClicked = true;
    }
  });
});

var showPoints = false;
function pointStyle(f) {
  if(false === showPoints) {
    return null;
  }
  var p = f.getProperties(), stroke, radius;
  if (f === currentFeature) {
    stroke = new ol.style.Stroke({
      color: '#000',
      width: 5
    });
    radius = 25;
  } else {
    stroke = new ol.style.Stroke({
      color: '#fff',
      width: 2
    });
    radius = 15;
  }

  return new ol.style.Style({
    image: new ol.style.RegularShape({
      radius: radius,
      points: 3,
      fill: new ol.style.Fill({
        color: '#AAAA33'
      }),
      stroke: stroke
    })
  })
}

function cityStyle(f) {
  var p = f.getProperties();
  var color = 'rgba(255,255,255,0.5)';
  var strokeWidth = 1;
  if (f === currentFeature) {
    strokeWidth = 5;
  }
  var cityKey = p.COUNTYNAME + p.TOWNNAME;
  if (cityMeta[cityKey] && cityMeta[cityKey].confirmed) {
    if (cityMeta[cityKey].rate > 10) {
      color = 'rgba(153,52,4,0.6)';
    } else if (cityMeta[cityKey].rate > 5) {
      color = 'rgba(217,95,14,0.6)';
    } else if (cityMeta[cityKey].rate > 1) {
      color = 'rgba(254,153,41,0.6)';
    } else if (cityMeta[cityKey].confirmed > 0) {
      color = 'rgba(254,217,142,0.6)';
    }
  }
  var baseStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: 'rgba(0,0,0,0.8)',
      width: strokeWidth
    }),
    fill: new ol.style.Fill({
      color: color
    }),
    text: new ol.style.Text({
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      fill: new ol.style.Fill({
        color: 'rgba(176,0,25,1)'
      })
    })
  });
  if (cityMeta[cityKey]) {
    baseStyle.getText().setText(p.TOWNNAME + ' ' + cityMeta[cityKey].confirmed.toString() + "\n(" + cityMeta[cityKey].rate.toString() + ')');
  }
  return baseStyle;
}

var currentFeature = false;
var lastFeature = false;
var lastFeatureType = '';

var geolocation = new ol.Geolocation({
  projection: appView.getProjection()
});

geolocation.setTracking(true);

geolocation.on('error', function (error) {
  console.log(error.message);
});

var positionFeature = new ol.Feature();

positionFeature.setStyle(new ol.style.Style({
  image: new ol.style.Circle({
    radius: 6,
    fill: new ol.style.Fill({
      color: '#3399CC'
    }),
    stroke: new ol.style.Stroke({
      color: '#fff',
      width: 2
    })
  })
}));

var firstPosDone = false;
geolocation.on('change:position', function () {
  var coordinates = geolocation.getPosition();
  positionFeature.setGeometry(coordinates ? new ol.geom.Point(coordinates) : null);
  if (false === firstPosDone) {
    appView.setCenter(coordinates);
    firstPosDone = true;
  }
});

new ol.layer.Vector({
  map: map,
  source: new ol.source.Vector({
    features: [positionFeature]
  })
});

$('#btn-geolocation').click(function () {
  var coordinates = geolocation.getPosition();
  if (coordinates) {
    appView.setCenter(coordinates);
  } else {
    alert('目前使用的設備無法提供地理資訊');
  }
  return false;
});

$('#btn-pointShow').click(function() {
  if(false === showPoints) {
    showPoints = true;
  } else {
    showPoints = false;
  }
  vectorPoints.getSource().refresh();
});

$.get('https://kiang.github.io/nidss.cdc.gov.tw/data/2021/19CoV.json', {}, function (r) {
  $('span#metaTotal').html(r.meta.total);
  $('span#metaModified').html(r.meta.modified);
  var c = r.data;
  for (c1 in c) {
    for (c2 in c[c1]) {
      var cityKey = c1 + c2;
      switch (c1) {
        case '台南市':
          cityKey = '臺南市' + c2;
          break;
        case '台北市':
          cityKey = '臺北市' + c2;
          break;
        case '台中市':
          cityKey = '臺中市' + c2;
          break;
        case '台東縣':
          if (c2 !== '台東市') {
            cityKey = '臺東縣' + c2;
          } else {
            cityKey = '臺東縣臺東市';
          }
          break;
        case '屏東縣':
          if (c2 === '霧台鄉') {
            cityKey = c1 + '霧臺鄉';
          }
          break;
        case '雲林縣':
          if (c2 === '台西鄉') {
            cityKey = c1 + '臺西鄉';
          }
          break;
      }
      cityMeta[cityKey] = {
        confirmed: c[c1][c2],
        population: 0,
        rate: 0.0,
      };
    }
  }
  $.get('https://kiang.github.io/tw_population/json/city/2021/04.json', {}, function (c) {
    for (code in c) {
      if (cityMeta[c[code].area]) {
        cityMeta[c[code].area].population = c[code].population;
        if (cityMeta[c[code].area].confirmed > 0) {
          cityMeta[c[code].area].rate = Math.round(cityMeta[c[code].area].confirmed / cityMeta[c[code].area].population * 100000) / 10;
        }
      }
    }
    city.getSource().refresh();
  })
});

