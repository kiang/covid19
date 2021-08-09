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

var attribution = new ol.control.Attribution({
  collapsible: false,
  collapsed: true
});

var city = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'https://kiang.github.io/taiwan_basecode/city/city.topo.json',
    format: new ol.format.TopoJSON({
      featureProjection: appView.getProjection()
    }),
    attributions: '<span id="mapDataDay">mapDataDay</span>'
  }),
  style: cityStyle,
  zIndex: 50
});

var map = new ol.Map({
  layers: [city, vectorPoints],
  target: 'map',
  view: appView,
  controls: ol.control.defaults({ attribution: false }).extend([attribution])
});

map.addControl(sidebar);
var pointClicked = false;
var townPool = {};
map.on('singleclick', function (evt) {
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      firstPosDone = true;
      currentFeature = feature;
      if (lastFeature) {
        if (lastFeatureType === 'point') {
          lastFeature.setStyle(pointStyle);
        } else {
          lastFeature.setStyle(cityStyle);
        }
      }
      if (chart1 !== null) {
        chart1.destroy();
      }
      if (chart2 !== null) {
        chart2.destroy();
      }
      if (chart3 !== null) {
        chart3.destroy();
      }
      var p = feature.getProperties();
      var message = '';
      if (p.COUNTYNAME) {
        var cityKey = p.COUNTYNAME + p.TOWNNAME;
        if (cityMeta[cityKey]) {
          message += '<table class="table table-dark"><tbody>';
          message += '<tr><th scope="row">確診數量</th><td>' + cityMeta[cityKey].confirmed + '</td></tr>';
          message += '<tr><th scope="row">人口</th><td>' + cityMeta[cityKey].population + '</td></tr>';
          message += '<tr><th scope="row">比率</th><td>' + cityMeta[cityKey].rate + '(每萬人口)</td></tr>';
          message += '</tbody></table>';
          sidebarTitle.innerHTML = p.COUNTYNAME + p.TOWNNAME;
          currentFeature.setStyle(cityStyle);
          lastFeatureType = 'area';

          if (!townPool[cityKey]) {
            $.getJSON('https://kiang.github.io/od.cdc.gov.tw/data/od/onset/town/' + townKeys[cityKey] + '.json', {}, function (r) {
              townPool[cityKey] = r;
              showOdCharts(cityKey);
            });
          } else {
            showOdCharts(cityKey);
          }
        }

      } else {
        message += '<table class="table table-dark"><tbody>';
        for (k in p) {
          if (k !== 'geometry') {
            message += '<tr><th scope="row">' + k + '</th><td>' + p[k] + '</td></tr>';
          }
        }
        message += '</tbody></table>';
        message += '<p>快篩站資料由 g0v 社群彙整， g0v 貢獻者以創用 CC 姓名標示 4.0 授權，網址： <a href="http://bit.ly/TaiwanRapidTests" target="_blank">http://bit.ly/TaiwanRapidTests</a></p>';
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

var chart1 = null, chart2 = null, chart3 = null;
function showOdCharts(cityKey) {
  var chartDataPool = {
    data: [],
    categories: [],
    ageKey: [],
    ageSeries: [],
    countAvg: [],
  };
  var skipCount = 20;
  for (k in townPool[cityKey]['days']) {
    if (--skipCount < 0) {
      var ymd = {
        y: k.substring(0, 4),
        m: k.substring(4, 6),
        d: k.substring(6, 8),
      };
      var theDay = new Date(ymd.y, parseInt(ymd.m) - 1, ymd.d);
      var prevDay = new Date();
      var sumDay = townPool[cityKey]['days'][k];
      prevDay.setTime(theDay.getTime() - 86400000);
      for (i = 0; i < 6; i++) {
        var prevKey = getYMD(prevDay);
        if (townPool[cityKey]['days'][prevKey]) {
          sumDay += townPool[cityKey]['days'][prevKey];
        }
        prevDay.setTime(prevDay.getTime() - 86400000);
      }
      chartDataPool.countAvg.push(Math.round(sumDay / 7));
      chartDataPool.categories.push(k.substring(4));
      chartDataPool.data.push(townPool[cityKey]['days'][k]);
    }
  }
  for (k in townPool[cityKey]['age']) {
    chartDataPool.ageKey.push(k);
    chartDataPool.ageSeries.push(townPool[cityKey]['age'][k]);
  }
  chart1 = new ApexCharts(document.querySelector('#odChart1'), {
    chart: {
      height: 300,
      type: 'line'
    },
    series: [
      {
        name: '確診人數',
        type: 'column',
        data: chartDataPool.data
      },
      {
        name: '7日平均',
        type: 'line',
        data: chartDataPool.countAvg,
      }
    ],
    stroke: {
      width: [0, 3]
    },
    title: {
      text: '每日確診(發病日)'
    },
    xaxis: {
      categories: chartDataPool.categories
    }
  });
  chart1.render();

  chart2 = new ApexCharts(document.querySelector('#odChart2'), {
    chart: {
      type: 'pie'
    },
    series: [townPool[cityKey].gender.m, townPool[cityKey].gender.f],
    labels: ['男', '女']
  });
  chart2.render();

  chart3 = new ApexCharts(document.querySelector('#odChart3'), {
    chart: {
      type: 'bar'
    },
    series: [{
      name: '確診人數',
      data: chartDataPool.ageSeries
    }],
    xaxis: {
      categories: chartDataPool.ageKey
    },
    plotOptions: {
      bar: {
        horizontal: true
      }
    }
  });
  chart3.render();
}

var showPoints = false;
function pointStyle(f) {
  if (false === showPoints) {
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

var mapStyle = 'countBased';
function cityStyle(f) {
  var p = f.getProperties();
  var color = '#ffffff';
  var strokeWidth = 1;
  var strokeColor = 'rgba(0,0,0,0.3)';
  if (f === currentFeature) {
    strokeColor = 'rgba(0,0,0,1)';
    strokeWidth = 2;
  }
  var cityKey = p.COUNTYNAME + p.TOWNNAME;
  var keyRate = 0.0;
  var textColor = '#000000';

  switch (mapStyle) {
    case 'countBased':
      if (cityMeta[cityKey] && cityMeta[cityKey].confirmed) {
        keyRate = cityMeta[cityKey].rate;
      }
      if (keyRate > 50) {
        color = '#470115';
      } else if (keyRate > 20) {
        color = '#6f006d';
      } else if (keyRate > 10) {
        color = '#a4005b';
      } else if (keyRate > 5) {
        color = '#d00b33';
      } else if (keyRate > 3) {
        color = '#e75033';
      } else if (keyRate > 1) {
        color = '#ffa133';
      } else if (keyRate > 0) {
        color = '#e3d738';
      }
      break;
    case 'rateBased':
      if (cityMeta[cityKey]) {
        keyRate = cityMeta[cityKey].increaseRate;
      }
      if (keyRate > 50) {
        color = '#470115';
      } else if (keyRate > 20) {
        color = '#6f006d';
      } else if (keyRate > 10) {
        color = '#a4005b';
      } else if (keyRate > 5) {
        color = '#d00b33';
      } else if (keyRate > 3) {
        color = '#e75033';
      } else if (keyRate > 1) {
        color = '#ffa133';
      } else if (keyRate > 0) {
        color = '#e3d738';
      }
      break;
    case 'avgBased':
      if (cityMeta[cityKey]) {
        keyRate = cityMeta[cityKey].avg7;
      }
      if (keyRate > 50) {
        color = '#470115';
      } else if (keyRate > 20) {
        color = '#6f006d';
      } else if (keyRate > 10) {
        color = '#a4005b';
      } else if (keyRate > 5) {
        color = '#d00b33';
      } else if (keyRate > 3) {
        color = '#e75033';
      } else if (keyRate > 1) {
        color = '#ffa133';
      } else if (keyRate > 0) {
        color = '#e3d738';
      }
      break;
  }

  if(keyRate > 5) {
    textColor = '#ffffff';
  }

  var baseStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: strokeColor,
      width: strokeWidth
    }),
    fill: new ol.style.Fill({
      color: color
    }),
    text: new ol.style.Text({
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      fill: new ol.style.Fill({
        color: textColor
      })
    })
  });

  switch (mapStyle) {
    case 'countBased':
      if (cityMeta[cityKey]) {
        baseStyle.getText().setText(p.TOWNNAME + ' ' + cityMeta[cityKey].confirmed.toString() + "\n(" + keyRate.toString() + ')');
      } else {
        baseStyle.getText().setText(p.TOWNNAME + ' 0');
      }
      break;
    case 'rateBased':
      if (keyRate != 0) {
        baseStyle.getText().setText(p.TOWNNAME + ' ' + cityMeta[cityKey].increase.toString() + "\n(" + keyRate.toString() + ')');
      } else {
        baseStyle.getText().setText(p.TOWNNAME + ' 0');
      }
      break;
    case 'avgBased':
      if (keyRate != 0) {
        baseStyle.getText().setText(p.TOWNNAME + ' ' + cityMeta[cityKey].avg7.toString() + "\n(" + keyRate.toString() + ')');
      } else {
        baseStyle.getText().setText(p.TOWNNAME + ' 0');
      }
      break;
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

$('#btn-taiwan').click(function () {
  appView.setCenter(ol.proj.fromLonLat([120.221507, 23.000694]));
  return false;
});

$('#btn-pointShow').click(function () {
  if (false === showPoints) {
    showPoints = true;
  } else {
    showPoints = false;
  }
  vectorPoints.getSource().refresh();
});

var townKeys = {};
var currentDay = '';
var populationDone = false;
var populationPool = {};
$.get('https://kiang.github.io/od.cdc.gov.tw/data/od/onset/2021.json', {}, function (r) {
  showDayPool[r.meta.day] = r;
  showDayUpdate(showDayPool[r.meta.day]);

  $.get('https://kiang.github.io/tw_population/json/city/2021/05.json', {}, function (c) {
    for (code in c) {
      populationPool[c[code].area] = c[code].population;
      if (cityMeta[c[code].area]) {
        cityMeta[c[code].area].population = c[code].population;
        if (cityMeta[c[code].area].confirmed > 0 && cityMeta[c[code].area].population > 0) {
          cityMeta[c[code].area].rate = Math.round(cityMeta[c[code].area].confirmed / cityMeta[c[code].area].population * 1000000) / 100;
        }
      }
    }
    populationDone = true;
    city.getSource().refresh();
  })
});

var showDayPool = {};
function showDayUpdate(r) {
  for (k in cityMeta) {
    cityMeta[k].confirmed = 0;
    cityMeta[k].increase = 0;
    cityMeta[k].rate = 0.0;
    cityMeta[k].increaseRate = 0.0;
    cityMeta[k].avg7 = 0.0;
  }
  $('span#metaDay').html(r.meta.day);
  $('span#mapDataDay').html(r.meta.day);
  $('span#metaTotal').html(r.meta.total);
  $('span#metaModified').html(r.meta.modified);
  currentDay = r.meta.day;
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
      if (!townKeys[cityKey]) {
        townKeys[cityKey] = c1 + c2;
      }
      if (!cityMeta[cityKey]) {
        cityMeta[cityKey] = {
          confirmed: 0,
          population: 0,
          rate: 0.0,
          increaseRate: 0.0,
          increase: 0,
          avg7: 0.0,
        };
        if(populationPool[cityKey]) {
          cityMeta[cityKey].population = populationPool[cityKey];
        }
      }
      cityMeta[cityKey].confirmed = c[c1][c2];
      cityMeta[cityKey].increaseRate = r.rate[c1][c2];
      cityMeta[cityKey].increase = r.increase[c1][c2];
      if(cityMeta[cityKey].population > 0) {
        cityMeta[cityKey].rate = Math.round(cityMeta[cityKey].confirmed / cityMeta[cityKey].population * 1000000) / 100;
      }
      if (r.avg7 && r.avg7[c1] && r.avg7[c1][c2]) {
        cityMeta[cityKey].avg7 = r.avg7[c1][c2];
      }
    }
  }
  if (populationDone) {
    city.getSource().refresh();
  }
}
function showDay(theDay) {
  $('#showingDay').html(theDay);
  if (!showDayPool[theDay]) {
    $.getJSON('https://kiang.github.io/od.cdc.gov.tw/data/od/confirmed/' + theDay + '.json', {}, function (r) {
      showDayPool[r.meta.day] = r;
      showDayUpdate(showDayPool[r.meta.day]);
    }).fail(function () {
      dayEnd.setTime(dayEnd.getTime() - 86400000);
    });
  } else {
    showDayUpdate(showDayPool[theDay]);
  }
}

var today = new Date();
var dayBegin = new Date(2021, 2, 30);
var dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
$('a#btn-Previous').click(function (e) {
  e.preventDefault();
  var cDay = new Date(currentDay.substring(0, 4), parseInt(currentDay.substring(4, 6)) - 1, parseInt(currentDay.substring(6, 8)));
  var newDay = new Date(cDay.getTime() - 86400000);
  if (newDay.getTime() > dayBegin.getTime()) {
    showDay(getYMD(newDay));
  }
});

$('a#btn-Next').click(function (e) {
  e.preventDefault();
  var cDay = new Date(currentDay.substring(0, 4), parseInt(currentDay.substring(4, 6)) - 1, parseInt(currentDay.substring(6, 8)));
  var newDay = new Date(cDay.getTime() + 86400000);
  if (newDay.getTime() < dayEnd.getTime()) {
    showDay(getYMD(newDay));
  } else {
    newDay.setTime(dayBegin.getTime());
    showDay(getYMD(newDay));
  }
});

function getYMD(theTime) {
  var ymd = {
    y: theTime.getFullYear(),
    m: theTime.getMonth() + 1,
    d: theTime.getDate()
  };
  if (ymd.m < 10) {
    ymd.m = '0' + ymd.m;
  }
  if (ymd.d < 10) {
    ymd.d = '0' + ymd.d;
  }
  return '' + ymd.y + ymd.m + ymd.d;
}

$('a#btn-countBased').click(function (e) {
  e.preventDefault();
  mapStyle = 'countBased';
  city.getSource().refresh();
  $('a.btn-switch').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-countBased').removeClass('btn-secondary').addClass('btn-primary');
});

$('a#btn-rateBased').click(function (e) {
  e.preventDefault();
  mapStyle = 'rateBased';
  city.getSource().refresh();
  $('a.btn-switch').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-rateBased').removeClass('btn-secondary').addClass('btn-primary');
});

$('a#btn-avgBased').click(function (e) {
  e.preventDefault();
  mapStyle = 'avgBased';
  city.getSource().refresh();
  $('a.btn-switch').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-avgBased').removeClass('btn-secondary').addClass('btn-primary');
});

var dataPlaying = false;
$('a#btn-play').click(function (e) {
  e.preventDefault();
  dataPlaying = true;
  $('a#btn-pause').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-play').removeClass('btn-secondary').addClass('btn-primary');
  if (dataPlaying) {
    $('a#btn-Next').trigger('click');
    setTimeout(function () {
      if (dataPlaying) {
        $('a#btn-play').trigger('click');
      }
    }, 1000);
  }
});

$('a#btn-pause').click(function (e) {
  e.preventDefault();
  dataPlaying = false;
  $('a#btn-play').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-pause').removeClass('btn-secondary').addClass('btn-primary');
});
