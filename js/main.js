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
var maxMonthlyFee = 20000; // New variable to store the maximum monthly fee

var punishmentData = {};
var punishmentTerms = [];

function pointStyleFunction(f) {
  var p = f.getProperties(), color, stroke, radius, fPoints = 3;
  if (filterCity !== '' && p.city !== filterCity) {
    return null;
  }
  if (filterTown !== '' && p.town !== filterTown) {
    return null;
  }
  if (parseInt(p.monthly) > maxMonthlyFee) {
    return null;
  }
  if (f === currentFeature) {
    stroke = new ol.style.Stroke({
      color: 'rgba(255,0,255,0.5)',
      width: 10
    });
    radius = 35;
    fPoints = 5;
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
  if (!p.is_active) {
    color = '#cccccc';
  } else {
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
  }

  let pointStyle = new ol.style.Style({
    image: new ol.style.RegularShape({
      radius: radius,
      points: fPoints,
      fill: new ol.style.Fill({
        color: color
      }),
      stroke: stroke
    })
  });

  // Only show text if zoom level is 15 or greater
  if (map.getView().getZoom() >= 15) {
    pointStyle.setText(new ol.style.Text({
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      fill: new ol.style.Fill({
        color: 'rgba(0,0,255,0.7)'
      }),
      text: '$' + p.monthly.toString() + '/月'
    }));
  }

  return pointStyle;
}
var sidebarTitle = document.getElementById('sidebarTitle');
var content = document.getElementById('infoBox');

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.221507, 23.000694]),
  zoom: 14
});

var vectorSource = new ol.source.Vector({
  format: new ol.format.GeoJSON({
    featureProjection: appView.getProjection()
  })
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
  vectorSource.refresh();
});
$('select#town').change(function () {
  filterTown = $(this).val();
  vectorSource.refresh();
});

// Add event listener for the monthly fee range slider
$('#monthlyFeeRange').on('input', function() {
  maxMonthlyFee = parseInt($(this).val()) || 0;
  $('#monthlyFeeValue').text(maxMonthlyFee);
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
      var targetHash = '#' + p.id;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      pointClicked = true;
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

function showPos(lng, lat) {
  firstPosDone = true;
  appView.setCenter(ol.proj.fromLonLat([parseFloat(lng), parseFloat(lat)]));
}

var previousFeature = false;
var currentFeature = false;
var slipYears = ['109', '110', '111', '112', '113'];
var slipKeys = ['學費', '雜費', '材料費', '活動費', '午餐費', '點心費', '全學期總收費', '交通費', '課後延托費', '家長會費'];

function showPoint(pointId) {
  firstPosDone = true;
  $('#findPoint').val('');
  var features = vectorPoints.getSource().getFeatures();
  var pointFound = false;
  for (k in features) {
    var p = features[k].getProperties();
    if (p.id === pointId) {
      pointFound = true;
      currentFeature = features[k];
      features[k].setStyle(pointStyleFunction(features[k]));
      if (false !== previousFeature) {
        previousFeature.setStyle(pointStyleFunction(previousFeature));
      }
      previousFeature = currentFeature;
      appView.setCenter(features[k].getGeometry().getCoordinates());
      appView.setZoom(15);
      var lonLat = ol.proj.toLonLat(p.geometry.getCoordinates());
      var message = '<table class="table table-dark">';
      message += '<tbody>';
      message += '<tr><th scope="row" style="width: 100px;">名稱</th><td>' + p.title + '</td></tr>';
      if (p.owner) {
        message += '<tr><th scope="row">負責人</th><td><a href="https://preschools.olc.tw/owners/' + p.owner + '">' + p.owner + '</a></td></tr>';
      }
      message += '<tr><th scope="row">電話</th><td>' + p.tel + '</td></tr>';
      message += '<tr><th scope="row">住址</th><td>' + p.city + p.town + p.address + '</td></tr>';
      if (p.city === '新竹縣' && p.town === '竹北市') {
        message += '<tr><td colspan="2"><a href="https://www.facebook.com/zhubeibetter" target="_blank"><img src="img/zhubeibetter.jpg" alt="竹北幼兒園" style="max-width: 100%; height: auto;"></a></td></tr>';
      }
      if (p.type === '私立' && p.pre_public !== '無') {
        message += '<tr><th scope="row">類型</th><td>' + p.type + '(準公共化)</td></tr>';
      } else {
        message += '<tr><th scope="row">類型</th><td>' + p.type + '</td></tr>';
      }
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

      $('#punishmentBox').html('');
      $('#punishmentItem').hide();
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
          message += '<tr><td id="' + line[1] + '"></td></tr>';
          message += '</tbody></table>';
        }
        $('#punishmentBox').html(message);
        $('#punishmentItem').show();
      });
      setTimeout((p) => {
        $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/data/punish_note/' + p.city + '/' + p.title + '.json', {}, function (r) {
          for (let line of r) {
            $('#' + line[0]).html('備註：' + line[1]);
          }
        });
      }, 300, p);

      $('#vehicleBox').html('');
      $('#vehicleItem').hide();
      if (vehicles[p.id]) {
        var vMessage = '';
        for (let line of vehicles[p.id]) {
          vMessage += '<table class="table table-dark"><tbody>';
          vMessage += '<tr><th>車牌</th><td>' + line.plate_no + '</td></tr>';
          vMessage += '<tr><th>出廠年月</th><td>' + line.on_production_date + '</td></tr>';
          vMessage += '<tr><th>下次定檢日期</th><td>' + line.next_exam_dt + '</td></tr>';
          vMessage += '<tr><th>備註</th><td>' + line.txn_name + '</td></tr>';
          vMessage += '</tbody></table>';
        }
        $('#vehicleBox').html(vMessage);
        $('#vehicleItem').show();
      }

      for (let slipYear of slipYears) {
        $('#slipBox' + slipYear).html('');
        $('#accordion' + slipYear).hide();
        $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/data/slip' + slipYear + '/' + p.city + '/' + p.title + '.json', {}, function (r) {
          var message = '<table class="table table-dark">';
          message += '<tbody>';

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
          $('#slipBox' + slipYear).html(message);
          $('#accordion' + slipYear).show();
        });
      }
      $('#linkPreschool').attr('href', 'https://preschools.olc.tw/preschools/view/' + pointId).html('詳細資訊');

      sidebarTitle.innerHTML = p.title;
      document.title = p.title + ' - 台灣幼兒園地圖';
      content.innerHTML = message;
    }
  }
  sidebar.open('home');
}

var pointsFc;
var adminTree = {};
var findTerms = [];
$.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/preschools.json', {}, function (c) {
  pointsFc = c;
  var vFormat = vectorSource.getFormat();
  vectorSource.addFeatures(vFormat.readFeatures(pointsFc));

  // Find the maximum monthly fee to set the range slider's max value
  var maxFee = 0;
  for (k in pointsFc.features) {
    var p = pointsFc.features[k].properties;
    var monthlyFee = parseInt(p.monthly);
    if (!isNaN(monthlyFee) && monthlyFee > maxFee) {
      maxFee = monthlyFee;
    }
    findTerms.push({
      value: p.id,
      label: p.title + '(' + p.owner + ') ' + p.address
    });
    if (!cityList[p.city]) {
      cityList[p.city] = {};
    }
    if (!cityList[p.city][p.town]) {
      ++cityList[p.city][p.town];
    }
  }
  var cityOptions = '<option value="">--</option>';
  for (city in cityList) {
    cityOptions += '<option>' + city + '</option>';
  }
  $('select#city').html(cityOptions);

  // Update the range slider's max value and initial value
  $('#monthlyFeeRange').attr('max', maxFee);
  $('#monthlyFeeRange').val(maxFee);
  $('#monthlyFeeValue').text(maxFee);
  maxMonthlyFee = maxFee;

  routie(':pointId', showPoint);
  routie('pos/:lng/:lat', showPos);

  $('#findPoint').autocomplete({
    source: findTerms,
    select: function (event, ui) {
      var targetHash = '#' + ui.item.value;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  });
});
var vehicles = {};
$.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/kids_vehicles.json', {}, function (c) {
  vehicles = c;
});

$.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/punish_all.json', {}, function(data) {
    punishmentData = data;
    // Create search terms from punishment data
    for (let key in data) {
        for (let punishment of data[key]) {
            punishmentTerms.push({
                value: punishment.id,
                label: punishment.date + key + ' - ' + punishment.punishment + '(' + punishment.law + ')'
            });
        }
    }
    
    // Initialize autocomplete for punishment search
    $('#findPunish').autocomplete({
        source: punishmentTerms,
        select: function(event, ui) {
            var targetHash = '#' + ui.item.value;
            if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
        }
    });
});