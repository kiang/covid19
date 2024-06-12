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
  zoom: 10
});

var attribution = new ol.control.Attribution({
  collapsible: false,
  collapsed: true
});

var city = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'https://kiang.github.io/taiwan_basecode/county/topo/20200820.json',
    format: new ol.format.TopoJSON({
      featureProjection: appView.getProjection()
    }),
    attributions: '<span id="mapDataDay">mapDataDay</span>'
  }),
  style: cityStyle,
  zIndex: 50
});

var map = new ol.Map({
  layers: [city],
  target: 'map',
  view: appView,
  controls: ol.control.defaults({ attribution: false }).extend([attribution])
});

map.addControl(sidebar);
var pointClicked = false;
var cityPool = {};
var currentTownCount = {};
var loopingKey = '';
map.on('singleclick', function (evt) {
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      firstPosDone = true;
      currentFeature = feature;
      if (lastFeature) {
        lastFeature.setStyle(cityStyle);
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
        var cityKey = p.COUNTYNAME;
        sidebarTitle.innerHTML = p.COUNTYNAME;
        currentFeature.setStyle(cityStyle);
        if (cityMeta[cityKey]) {
          message += '<table class="table table-dark"><tbody>';
          message += '<tr><th scope="row">確診數量</th><td>' + cityMeta[cityKey].confirmed + '</td></tr>';
          message += '<tr><th scope="row">人口</th><td>' + cityMeta[cityKey].population + '</td></tr>';
          message += '<tr><th scope="row">比率</th><td>' + cityMeta[cityKey].rate + '(每萬人口)</td></tr>';
          message += '</tbody></table>';
          var odCityKey = cityKeys[cityKey];
          loopingKey = cityKey;
          if (!cityPool[cityKey]) {
            currentTownCount[cityKey] = Object.keys(townPool[odCityKey]).length;
            for (town in townPool[odCityKey]) {
              $.getJSON('https://kiang.github.io/od.cdc.gov.tw/data/od2024/onset/town/' + townPool[odCityKey][town] + '.json', {}, function (r) {
                var cityKey = r.city;
                switch (cityKey) {
                  case '台南市':
                    cityKey = '臺南市';
                    break;
                  case '台北市':
                    cityKey = '臺北市';
                    break;
                  case '台中市':
                    cityKey = '臺中市';
                    break;
                  case '台東縣':
                    cityKey = '臺東縣';
                    break;
                }
                if (!cityPool[cityKey]) {
                  cityPool[cityKey] = r;
                } else {
                  for (k in r.days) {
                    cityPool[cityKey].days[k] += r.days[k];
                  }
                  for (k in r.age) {
                    cityPool[cityKey].age[k] += r.age[k];
                  }
                  for (k in r.gender) {
                    cityPool[cityKey].gender[k] += r.gender[k];
                  }
                }
                if (--currentTownCount[cityKey] <= 0) {
                  showOdCharts(loopingKey);
                }
              });
            }
          } else {
            showOdCharts(cityKey);
          }
        } else {
          message += '<table class="table table-dark"><tbody>';
          message += '<tr><th scope="row">確診數量</th><td>0</td></tr>';
          message += '<tr><th scope="row">人口</th><td>' + populationPool[cityKey] + '</td></tr>';
          message += '<tr><th scope="row">比率</th><td>0(每萬人口)</td></tr>';
          message += '</tbody></table>';
        }

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
  for (k in cityPool[cityKey]['days']) {
    if (--skipCount < 0) {
      var ymd = {
        y: k.substring(0, 4),
        m: k.substring(4, 6),
        d: k.substring(6, 8),
      };
      var theDay = new Date(ymd.y, parseInt(ymd.m) - 1, ymd.d);
      var prevDay = new Date();
      var sumDay = cityPool[cityKey]['days'][k];
      prevDay.setTime(theDay.getTime() - 86400000);
      for (i = 0; i < 6; i++) {
        var prevKey = getYMD(prevDay);
        if (cityPool[cityKey]['days'][prevKey]) {
          sumDay += cityPool[cityKey]['days'][prevKey];
        }
        prevDay.setTime(prevDay.getTime() - 86400000);
      }
      chartDataPool.countAvg.push(Math.round(sumDay / 7));
      chartDataPool.categories.push(k.substring(4));
      chartDataPool.data.push(cityPool[cityKey]['days'][k]);
    }
  }
  for (k in cityPool[cityKey]['age']) {
    chartDataPool.ageKey.push(k);
    chartDataPool.ageSeries.push(cityPool[cityKey]['age'][k]);
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
    series: [cityPool[cityKey].gender.m, cityPool[cityKey].gender.f],
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

var colorTable = {
  'countBased': [
    [5120, '#470617'],
    [2560, '#5f0926'],
    [1280, '#64036b'],
    [640, '#75008b'],
    [320, '#af004f'],
    [160, '#d21a34'],
    [80, '#ec6234'],
    [40, '#ffa133'],
    [20, '#ffd02c'],
    [10, '#fffb26'],
    [0, '#89cd43']
  ],
  'rateBased': [
    [10.24, '#470617'],
    [5.12, '#5f0926'],
    [2.56, '#64036b'],
    [1.28, '#75008b'],
    [0.64, '#af004f'],
    [0.32, '#af004f'],
    [0.16, '#d21a34'],
    [0.08, '#ec6234'],
    [0.04, '#ffa133'],
    [0.02, '#ffd02c'],
    [0.01, '#fffb26'],
    [0, '#89cd43']
  ],
  'avgBased': [
    [800, '#470617'],
    [400, '#5f0926'],
    [200, '#64036b'],
    [100, '#75008b'],
    [50, '#af004f'],
    [20, '#d21a34'],
    [10, '#ec6234'],
    [5, '#ffa133'],
    [3, '#ffd02c'],
    [1, '#fffb26'],
    [0, '#89cd43']
  ]
};

function updateColorTable() {
  var tableLines = '';
  for (k in colorTable[mapStyle]) {
    tableLines += '<tr><td style="background-color: ' + colorTable[mapStyle][k][1] + '">&nbsp;&nbsp;</td><td> &gt;' + colorTable[mapStyle][k][0] + '</td></tr>';
  }
  $('table#colorTable').html(tableLines);
}

var mapStyle = 'countBased';
function cityStyle(f) {
  var p = f.getProperties();
  var color = 'rgba(255,255,255,0.5)';
  var strokeWidth = 1;
  if (f === currentFeature) {
    strokeWidth = 5;
  }
  var cityKey = p.COUNTYNAME;
  var keyRate = 0.0;
  var textColor = '#000000';

  switch (mapStyle) {
    case 'countBased':
      if (cityMeta[cityKey] && cityMeta[cityKey].confirmed) {
        keyRate = cityMeta[cityKey].rate;
      }
      break;
    case 'rateBased':
      if (cityMeta[cityKey]) {
        keyRate = cityMeta[cityKey].increaseRate;
      }
      break;
    case 'avgBased':
      if (cityMeta[cityKey]) {
        keyRate = cityMeta[cityKey].avg7;
      }
      break;
  }
  for (k in colorTable[mapStyle]) {
    if (color === 'rgba(255,255,255,0.5)' && keyRate > colorTable[mapStyle][k][0]) {
      color = colorTable[mapStyle][k][1];
    }
  }

  if (keyRate > 5) {
    textColor = '#ffffff';
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
        color: textColor
      })
    })
  });

  switch (mapStyle) {
    case 'countBased':
      if (cityMeta[cityKey]) {
        baseStyle.getText().setText(p.COUNTYNAME + ' ' + cityMeta[cityKey].confirmed.toString() + "\n(" + keyRate.toString() + ')');
      } else {
        baseStyle.getText().setText(p.COUNTYNAME + ' 0');
      }
      break;
    case 'rateBased':
      if (keyRate != 0) {
        baseStyle.getText().setText(p.COUNTYNAME + ' ' + cityMeta[cityKey].increase.toString() + "\n(" + keyRate.toString() + ')');
      } else {
        baseStyle.getText().setText(p.COUNTYNAME + ' 0');
      }
      break;
    case 'avgBased':
      if (keyRate != 0) {
        baseStyle.getText().setText(p.COUNTYNAME + ' ' + cityMeta[cityKey].avg7.toString() + "\n(" + keyRate.toString() + ')');
      } else {
        baseStyle.getText().setText(p.COUNTYNAME + ' 0');
      }
      break;
  }
  return baseStyle;
}

var currentFeature = false;
var lastFeature = false;

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

var cityKeys = {};
var currentDay = '';
var populationDone = false;
var populationPool = {};
$.get('https://kiang.github.io/od.cdc.gov.tw/data/od2024/onset/2024.json', {}, function (r) {
  showDayPool[r.meta.day] = r;
  showDayUpdate(showDayPool[r.meta.day]);
  $.get('https://kiang.github.io/data.moi.gov.tw/json/population/city/2024/05.json', {}, function (c) {
    for (code in c) {
      var cityKey = c[code].area.substring(0, 3);
      if (!populationPool[cityKey]) {
        populationPool[cityKey] = 0;
      }
      populationPool[cityKey] += c[code].population;
      if (cityMeta[cityKey]) {
        cityMeta[cityKey].population += c[code].population;
        if (cityMeta[cityKey].confirmed > 0 && cityMeta[cityKey].population > 0) {
          cityMeta[cityKey].rate = Math.round(cityMeta[cityKey].confirmed / cityMeta[cityKey].population * 1000000) / 100;
        }
      }
    }
    populationDone = true;
    city.getSource().refresh();
  })
});

var showDayPool = {};
var townPool = {};
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
    var cityKey = c1;
    switch (c1) {
      case '台南市':
        cityKey = '臺南市';
        break;
      case '台北市':
        cityKey = '臺北市';
        break;
      case '台中市':
        cityKey = '臺中市';
        break;
      case '台東縣':
        cityKey = '臺東縣';
        break;
    }
    if (!cityKeys[cityKey]) {
      cityKeys[cityKey] = c1;
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
      if (populationPool[cityKey]) {
        cityMeta[cityKey].population = populationPool[cityKey];
      }
    }
    if (!townPool[c1]) {
      townPool[c1] = {};
    }

    var avg7Sum = 0;
    for (c2 in c[c1]) {
      if (!townPool[c1][c2]) {
        townPool[c1][c2] = c1 + c2;
      }
      cityMeta[cityKey].confirmed += c[c1][c2];
      cityMeta[cityKey].increase += r.increase[c1][c2];
      if (r.avg7 && r.avg7[c1] && r.avg7[c1][c2]) {
        avg7Sum += r.avg7[c1][c2] * 7;
      }
    }

    if (cityMeta[cityKey].increase > 0) {
      if (cityMeta[cityKey].increase < cityMeta[cityKey].confirmed) {
        cityMeta[cityKey].increaseRate = Math.round(cityMeta[cityKey].increase / (cityMeta[cityKey].confirmed - cityMeta[cityKey].increase) * 100) / 100;
      } else {
        cityMeta[cityKey].increaseRate = 1.0;
      }
    }
    if (cityMeta[cityKey].population > 0) {
      cityMeta[cityKey].rate = Math.round(cityMeta[cityKey].confirmed / cityMeta[cityKey].population * 1000000) / 100;
    }
    cityMeta[cityKey].avg7 = Math.round(avg7Sum / 7);

  }
  if (populationDone) {
    city.getSource().refresh();
  }
}
function showDay(theDay) {
  $('#showingDay').html(theDay);
  if (!showDayPool[theDay]) {
    $.getJSON('https://kiang.github.io/od.cdc.gov.tw/data/od2024/onset/' + theDay + '.json', {}, function (r) {
      showDayPool[r.meta.day] = r;
      showDayUpdate(showDayPool[r.meta.day]);
    }).fail(function () {
      if (false === btnClicked) {
        dayEnd.setTime(dayEnd.getTime() - 86400000);
      } else {
        var cDay = new Date(theDay.substring(0, 4), parseInt(theDay.substring(4, 6)) - 1, parseInt(theDay.substring(6, 8)));
        var newDay;
        if ('next' === btnClicked) {
          newDay = new Date(cDay.getTime() + 86400000);
          currentDay = getYMD(newDay);
          showDay(getYMD(newDay));
        } else {
          newDay = new Date(cDay.getTime() - 86400000);
          currentDay = getYMD(newDay);
          showDay(getYMD(newDay));
        }
      }
    });
  } else {
    showDayUpdate(showDayPool[theDay]);
  }
}

var btnClicked = false;
var today = new Date();
var dayBegin = new Date(2022, 1, 1);
var dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
$('a#btn-Previous').click(function (e) {
  btnClicked = 'previous';
  e.preventDefault();
  var cDay = new Date(currentDay.substring(0, 4), parseInt(currentDay.substring(4, 6)) - 1, parseInt(currentDay.substring(6, 8)));
  var newDay = new Date(cDay.getTime() - 86400000);
  if (newDay.getTime() > dayBegin.getTime()) {
    showDay(getYMD(newDay));
  }
});

$('a#btn-Next').click(function (e) {
  btnClicked = 'next';
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
  updateColorTable();
});

$('a#btn-rateBased').click(function (e) {
  e.preventDefault();
  mapStyle = 'rateBased';
  city.getSource().refresh();
  $('a.btn-switch').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-rateBased').removeClass('btn-secondary').addClass('btn-primary');
  updateColorTable();
});

$('a#btn-avgBased').click(function (e) {
  e.preventDefault();
  mapStyle = 'avgBased';
  city.getSource().refresh();
  $('a.btn-switch').removeClass('btn-primary').addClass('btn-secondary');
  $('a#btn-avgBased').removeClass('btn-secondary').addClass('btn-primary');
  updateColorTable();
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

updateColorTable();