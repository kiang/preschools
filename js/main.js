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

var cityList = {};
var filterCity = '', filterTown = '';
var filterExtent = false;
function pointStyleFunction(f) {
  var p = f.getProperties(), color, stroke, radius;
  if (filterCity !== '' && p.city !== filterCity) {
    return null;
  }
  if (filterTown !== '' && p.town !== filterTown) {
    return null;
  }
  if (f === currentFeature) {
    stroke = new ol.style.Stroke({
      color: '#000',
      width: 5
    });
    radius = 25;
  } else {
    if (p.penalty === '有') {
      stroke = new ol.style.Stroke({
        color: '#f00',
        width: 2
      });
    } else {
      stroke = new ol.style.Stroke({
        color: '#fff',
        width: 2
      });
    }

    radius = 20;
  }
  switch (p.type) {
    case '公立':
      color = '#48c774';
      break;
    case '私立':
      if (p.pre_public !== '無') {
        color = '#57ffdd';
      } else {
        color = '#57ddff';
      }
      break;
    case '非營利':
      color = '#ffdd57';
      break;
  }
  let pointStyle = new ol.style.Style({
    image: new ol.style.RegularShape({
      radius: radius,
      points: 3,
      fill: new ol.style.Fill({
        color: color
      }),
      stroke: stroke
    }),
    text: new ol.style.Text({
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      fill: new ol.style.Fill({
        color: 'rgba(0,0,255,0.7)'
      })
    })
  });
  pointStyle.getText().setText(p.monthly.toString());
  return pointStyle;
}
var sidebarTitle = document.getElementById('sidebarTitle');
var content = document.getElementById('infoBox');
var slip = document.getElementById('slipBox');
var slip109 = document.getElementById('slipBox109');

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.221507, 23.000694]),
  zoom: 14
});

var vectorSource = new ol.source.Vector({
  url: 'https://kiang.github.io/ap.ece.moe.edu.tw/preschools.json',
  format: new ol.format.GeoJSON({
    featureProjection: appView.getProjection()
  })
});
var cityOptionDone = false;
vectorSource.on('change', function () {
  if (vectorSource.getState() == 'ready') {
    vectorSource.forEachFeature(function (f) {
      var p = f.getProperties();
      if (false === cityOptionDone) {
        if (!cityList[p.city]) {
          cityList[p.city] = {};
        }
        if (!cityList[p.city][p.town]) {
          cityList[p.city][p.town] = 0;
        }
        ++cityList[p.city][p.town];
      }
      if (filterTown !== '') {
        if (p.city === filterCity && p.town === filterTown) {
          if (false === filterExtent) {
            filterExtent = f.getGeometry().getExtent();
          } else {
            ol.extent.extend(filterExtent, f.getGeometry().getExtent());
          }
        }
      } else if (filterCity !== '') {
        if (p.city === filterCity) {
          if (false === filterExtent) {
            filterExtent = f.getGeometry().getExtent();
          } else {
            ol.extent.extend(filterExtent, f.getGeometry().getExtent());
          }
        }
      }

    });
    if (false === cityOptionDone) {
      cityOptionDone = true;
      var cityOptions = '<option value="">--</option>';
      for (city in cityList) {
        cityOptions += '<option>' + city + '</option>';
      }
      $('select#city').html(cityOptions);
    }
    if (false !== filterExtent) {
      map.getView().fit(filterExtent);
      filterExtent = false;
    }
  }
});

$('select#city').change(function () {
  filterCity = $(this).val();
  var townOptions = '<option value="">--</option>';
  if (filterCity !== '') {
    for (town in cityList[filterCity]) {
      townOptions += '<option>' + town + '</option>';
    }
  }
  $('select#town').html(townOptions);
  filterTown = '';
  filterExtent = false;
  vectorSource.refresh();
});
$('select#town').change(function () {
  filterTown = $(this).val();
  filterExtent = false;
  vectorSource.refresh();
});

var vectorPoints = new ol.layer.Vector({
  source: vectorSource,
  style: pointStyleFunction
});

var baseLayer = new ol.layer.Tile({
  source: new ol.source.WMTS({
    matrixSet: 'EPSG:3857',
    format: 'image/png',
    url: 'https://wmts.nlsc.gov.tw/wmts',
    layer: 'EMAP',
    tileGrid: new ol.tilegrid.WMTS({
      origin: ol.extent.getTopLeft(projectionExtent),
      resolutions: resolutions,
      matrixIds: matrixIds
    }),
    style: 'default',
    wrapX: true,
    attributions: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>'
  }),
  opacity: 0.8
});

var map = new ol.Map({
  layers: [baseLayer, vectorPoints],
  target: 'map',
  view: appView
});

map.addControl(sidebar);
var pointClicked = false;
map.on('singleclick', function (evt) {
  content.innerHTML = '';
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      var p = feature.getProperties();
      var lonLat = ol.proj.toLonLat(p.geometry.getCoordinates());
      pointClicked = true;

      var message = '<table class="table table-dark">';
      message += '<tbody>';
      message += '<tr><th scope="row" style="width: 100px;">名稱</th><td>' + p.title + '</td></tr>';
      if (p.owner) {
        message += '<tr><th scope="row">負責人</th><td>' + p.owner + '</td></tr>';
      }
      message += '<tr><th scope="row">電話</th><td>' + p.tel + '</td></tr>';
      message += '<tr><th scope="row">住址</th><td>' + p.city + p.town + p.address + '</td></tr>';
      message += '<tr><th scope="row">類型</th><td>' + p.type + '</td></tr>';
      message += '<tr><th scope="row">核定人數</th><td>' + p.count_approved + '</td></tr>';
      if (p.size) {
        message += '<tr><th scope="row">全園總面積</th><td>' + p.size + '</td></tr>';
        message += '<tr><th scope="row">室內總面積</th><td>' + p.size_in + '</td></tr>';
        message += '<tr><th scope="row">室外活動空間總面積</th><td>' + p.size_out + '</td></tr>';
        message += '<tr><th scope="row">使用樓層</th><td>' + p.floor + '</td></tr>';
        message += '<tr><th scope="row">幼童專用車</th><td>' + p.shuttle + '</td></tr>';
        message += '<tr><th scope="row">核准設立日期</th><td>' + p.reg_date + '</td></tr>';
        message += '<tr><th scope="row">設立許可證號</th><td>' + p.reg_no + '</td></tr>';
        message += '<tr><th scope="row">設立許可文號</th><td>' + p.reg_docno + '</td></tr>';
      }
      message += '<tr><th scope="row">五歲免費</th><td>' + p.is_free5 + '</td></tr>';
      message += '<tr><th scope="row">準公共化</th><td>' + p.pre_public + '</td></tr>';
      if (p.url !== '') {
        message += '<tr><th scope="row">網址</th><td><a href="' + p.url + '" target="_blank">' + p.url + '</a></td></tr>';
      }
      message += '<tr><th scope="row">兼辦國小課後照顧</th><td>' + p.is_after + '</td></tr>';
      message += '<tr><th scope="row">裁罰記錄</th><td>' + p.penalty + '</td></tr>';
      message += '<tr><td colspan="2">';
      message += '<hr /><div class="btn-group-vertical" role="group" style="width: 100%;">';
      message += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + lonLat[1] + ',' + lonLat[0] + '&travelmode=driving" target="_blank" class="btn btn-info btn-lg btn-block">Google 導航</a>';
      message += '<a href="https://wego.here.com/directions/drive/mylocation/' + lonLat[1] + ',' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Here WeGo 導航</a>';
      message += '<a href="https://bing.com/maps/default.aspx?rtp=~pos.' + lonLat[1] + '_' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Bing 導航</a>';
      message += '</div></td></tr>';
      message += '</tbody></table>';
      sidebarTitle.innerHTML = p.title;
      content.innerHTML = message;

      if (p.penalty === '有') {
        $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/data/punish/' + p.city + '/' + p.title + '.json', {}, function (r) {
          var message = '';
          for (let line of r) {
            message += '<table class="table table-dark"><tbody>';
            message += '<tr><td>' + line[0] + '</td></tr>';
            message += '<tr><td>' + line[1] + '</td></tr>';
            message += '<tr><td>' + line[2] + '</td></tr>';
            message += '<tr><td>' + line[3] + '</td></tr>';
            message += '<tr><td>' + line[4] + '</td></tr>';
            message += '<tr><td>' + line[5] + '</td></tr>';
            message += '</tbody></table>';
          }
          $('#punishmentBox').html(message);
        });
        $('#punishmentItem').show();
      } else {
        $('#punishmentBox').html('');
        $('#punishmentItem').hide();
      }

      $('#accordion110').hide();
      $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/data/slip/' + p.city + '/' + p.title + '.json', {}, function (r) {
        var message = '<table class="table table-dark">';
        message += '<tbody>';
        let slipKeys = ['學費', '雜費', '材料費', '活動費', '午餐費', '點心費', '全學期總收費', '交通費', '課後延托費', '家長會費'];
        for (y in r.slip) {
          for (p in r.slip[y]) {
            message += '<tr><td colspan="2">';
            message += y + '歲 - ' + p + ' / ' + r.slip[y][p].months + '個月';
            message += '</td></tr>';
            let blockToShow = false;
            for (let slipKey of slipKeys) {
              if (r.slip[y][p].class['全日班'][slipKey] && r.slip[y][p].class['全日班'][slipKey]['單價'] != '') {
                blockToShow = true;
              }
            }
            if (blockToShow) {
              message += '<tr><td colspan="2" style="text-align:right;">全日班</td></tr>';
              message += '<tr><td colspan="2" class="table-responsive"><table class="table-dark" style="width:100%;">'
              message += '<tr><th>項目</th><th>收費期間</th><th>單價</th><th>小計</th></tr>';
              for (let slipKey of slipKeys) {
                if (r.slip[y][p].class['全日班'][slipKey]) {
                  message += '<tr><td>' + slipKey + '</td><td>' + r.slip[y][p].class['全日班'][slipKey]['收費期間'] + '</td><td>' + r.slip[y][p].class['全日班'][slipKey]['單價'] + '</td><td>' + r.slip[y][p].class['全日班'][slipKey]['小計'] + '</td></tr>';
                }
              }
              message += '</table></td></tr>';
            }
            blockToShow = false;
            for (let slipKey of slipKeys) {
              if (r.slip[y][p].class['半日班'][slipKey] && r.slip[y][p].class['半日班'][slipKey]['單價'] != '') {
                blockToShow = true;
              }
            }
            if (blockToShow) {
              message += '<tr><td colspan="2" style="text-align:right;">半日班</td></tr>';
              message += '<tr><td colspan="2" class="table-responsive"><table class="table-dark" style="width:100%;">'
              message += '<tr><th>項目</th><th>收費期間</th><th>單價</th><th>小計</th></tr>';
              for (let slipKey of slipKeys) {
                if (r.slip[y][p].class['半日班'][slipKey]) {
                  message += '<tr><td>' + slipKey + '</td><td>' + r.slip[y][p].class['半日班'][slipKey]['收費期間'] + '</td><td>' + r.slip[y][p].class['半日班'][slipKey]['單價'] + '</td><td>' + r.slip[y][p].class['半日班'][slipKey]['小計'] + '</td></tr>';
                }
              }
              message += '</table></td></tr>';
            }
          }
        }
        message += '</tbody></table>';
        slip.innerHTML = message;
        $('#accordion110').show();
      });

      $('#accordion109').hide();
      $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/data/slip109/' + p.city + '/' + p.title + '.json', {}, function (r) {
        var message = '<table class="table table-dark">';
        message += '<tbody>';
        let slipKeys = ['學費', '雜費', '材料費', '活動費', '午餐費', '點心費', '全學期總收費', '交通費', '課後延托費', '家長會費'];
        for (y in r.slip) {
          for (p in r.slip[y]) {
            message += '<tr><td colspan="2">';
            message += y + '歲 - ' + p + ' / ' + r.slip[y][p].months + '個月';
            message += '</td></tr>';
            let blockToShow = false;
            for (let slipKey of slipKeys) {
              if (r.slip[y][p].class['全日班'][slipKey] && r.slip[y][p].class['全日班'][slipKey]['單價'] != '') {
                blockToShow = true;
              }
            }
            if (blockToShow) {
              message += '<tr><td colspan="2" style="text-align:right;">全日班</td></tr>';
              message += '<tr><td colspan="2" class="table-responsive"><table class="table-dark" style="width:100%;">'
              message += '<tr><th>項目</th><th>收費期間</th><th>單價</th><th>小計</th></tr>';
              for (let slipKey of slipKeys) {
                if (r.slip[y][p].class['全日班'][slipKey]) {
                  message += '<tr><td>' + slipKey + '</td><td>' + r.slip[y][p].class['全日班'][slipKey]['收費期間'] + '</td><td>' + r.slip[y][p].class['全日班'][slipKey]['單價'] + '</td><td>' + r.slip[y][p].class['全日班'][slipKey]['小計'] + '</td></tr>';
                }
              }
              message += '</table></td></tr>';
            }
            blockToShow = false;
            for (let slipKey of slipKeys) {
              if (r.slip[y][p].class['半日班'][slipKey] && r.slip[y][p].class['半日班'][slipKey]['單價'] != '') {
                blockToShow = true;
              }
            }
            if (blockToShow) {
              message += '<tr><td colspan="2" style="text-align:right;">半日班</td></tr>';
              message += '<tr><td colspan="2" class="table-responsive"><table class="table-dark" style="width:100%;">'
              message += '<tr><th>項目</th><th>收費期間</th><th>單價</th><th>小計</th></tr>';
              for (let slipKey of slipKeys) {
                if (r.slip[y][p].class['半日班'][slipKey]) {
                  message += '<tr><td>' + slipKey + '</td><td>' + r.slip[y][p].class['半日班'][slipKey]['收費期間'] + '</td><td>' + r.slip[y][p].class['半日班'][slipKey]['單價'] + '</td><td>' + r.slip[y][p].class['半日班'][slipKey]['小計'] + '</td></tr>';
                }
              }
              message += '</table></td></tr>';
            }
          }
        }
        message += '</tbody></table>';
        slip109.innerHTML = message;
        $('#accordion109').show();
      });
      sidebar.open('home');
    }
  });
});

var previousFeature = false;
var currentFeature = false;

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