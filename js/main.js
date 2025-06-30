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
var maxMonthlyFee = 20000;

var punishmentData = {};
var punishmentTerms = [];

function pointStyleFunction(f) {
  var p = f.getProperties(), color, stroke, radius, shadowColor;
  if (filterCity !== '' && p.city !== filterCity) {
    return null;
  }
  if (filterTown !== '' && p.town !== filterTown) {
    return null;
  }
  if (parseInt(p.monthly) > maxMonthlyFee) {
    return null;
  }
  
  var isSelected = f === currentFeature;
  var hasPenalty = p.penalty === '有';
  
  // Enhanced styling based on state
  if (isSelected) {
    stroke = new ol.style.Stroke({
      color: '#007bff',
      width: 6
    });
    radius = 20;
    shadowColor = 'rgba(0, 123, 255, 0.5)';
  } else {
    stroke = new ol.style.Stroke({
      color: hasPenalty ? '#e74c3c' : '#ffffff',
      width: hasPenalty ? 3 : 2
    });
    radius = 12;
    shadowColor = hasPenalty ? 'rgba(231, 76, 60, 0.3)' : 'rgba(0, 0, 0, 0.2)';
  }

  // Improved color scheme with better contrast
  if (!p.is_active) {
    color = '#95a5a6';
    shadowColor = 'rgba(149, 165, 166, 0.3)';
  } else {
    switch (p.type) {
      case '公立':
        color = '#27ae60'; // Darker green for better visibility
        break;
      case '私立':
        if (p.pre_public !== '無') {
          color = '#1abc9c'; // Teal for semi-public
        } else {
          color = '#3498db'; // Blue for private
        }
        break;
      case '非營利':
        color = '#f39c12'; // Orange for non-profit
        break;
      default:
        color = '#7f8c8d';
    }
  }

  // Create main marker style with shadow effect
  let styles = [];
  
  // Add pulsing effect for selected marker
  if (isSelected) {
    let pulseStyle = new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius + 8,
        fill: new ol.style.Fill({
          color: 'rgba(0, 123, 255, 0.2)'
        }),
        stroke: new ol.style.Stroke({
          color: 'rgba(0, 123, 255, 0.4)',
          width: 2
        })
      }),
      zIndex: 998
    });
    styles.push(pulseStyle);
  }
  
  let pointStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: radius,
      fill: new ol.style.Fill({
        color: color
      }),
      stroke: stroke
    }),
    zIndex: isSelected ? 1000 : 100
  });
  styles.push(pointStyle);

  // Add inner dot for better definition
  let innerDotStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: radius * 0.4,
      fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0.8)'
      })
    }),
    zIndex: isSelected ? 1001 : 101
  });
  styles.push(innerDotStyle);

  // Enhanced text styling that appears at zoom 13+
  if (map.getView().getZoom() >= 13) {
    var textColor = '#2c3e50';
    var backgroundColor = 'rgba(255, 255, 255, 0.9)';
    
    if (map.getView().getZoom() >= 15) {
      // Show full price info at high zoom
      pointStyle.setText(new ol.style.Text({
        font: 'bold 12px "Arial", sans-serif',
        fill: new ol.style.Fill({
          color: textColor
        }),
        stroke: new ol.style.Stroke({
          color: backgroundColor,
          width: 3
        }),
        text: '$' + p.monthly.toString() + '/月',
        offsetY: radius + 15,
        textAlign: 'center',
        backgroundFill: new ol.style.Fill({
          color: backgroundColor
        }),
        padding: [2, 4, 2, 4]
      }));
    } else {
      // Show simplified price at medium zoom
      pointStyle.setText(new ol.style.Text({
        font: 'bold 10px "Arial", sans-serif',
        fill: new ol.style.Fill({
          color: textColor
        }),
        stroke: new ol.style.Stroke({
          color: backgroundColor,
          width: 2
        }),
        text: '$' + (Math.round(p.monthly / 1000) * 1000).toString(),
        offsetY: radius + 12,
        textAlign: 'center'
      }));
    }
  }

  // Return array of styles for layered effect
  return styles;
}

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.221507, 23.000694]),
  zoom: 14
});

var vectorSource = new ol.source.Vector({
  format: new ol.format.GeoJSON({
    featureProjection: appView.getProjection()
  })
});

// Filter controls functionality
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

// Geolocation functionality
$('#btn-geolocation').click(function () {
  var coordinates = geolocation.getPosition();
  if (coordinates) {
    appView.setCenter(coordinates);
    closeFilterPopup();
  } else {
    alert('目前使用的設備無法提供地理資訊');
  }
  return false;
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

var pointClicked = false;
var isHashUpdate = false; // Flag to prevent double execution

map.on('singleclick', function (evt) {
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      // Reset previous feature styling
      if (currentFeature && currentFeature !== feature) {
        currentFeature.setStyle(null); // Reset to default style
        vectorSource.refresh(); // Force refresh to apply default styling
      }
      
      // Set new current feature and update its styling
      currentFeature = feature;
      feature.setStyle(pointStyleFunction(feature));
      
      var p = feature.getProperties();
      
      // Show popup at click position first
      showPopup(p, evt.pixel);
      
      // Update URL hash (this will trigger showPoint but we'll prevent duplicate popup)
      var targetHash = '#' + p.id;
      if (window.location.hash !== targetHash) {
        isHashUpdate = true;
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

// Popup functionality
function showPopup(p, clickPixel) {
  console.log('showPopup called with:', p.title, 'clickPixel:', clickPixel);
  var popupTitle = document.getElementById('popupTitle');
  var popupInfo = document.getElementById('popupInfo');
  var popupOverlay = document.getElementById('popupOverlay');
  var popupContent = popupOverlay.querySelector('.popup-content');
  
  console.log('Popup elements found:', {
    popupTitle: !!popupTitle,
    popupInfo: !!popupInfo, 
    popupOverlay: !!popupOverlay,
    popupContent: !!popupContent
  });
  
  popupTitle.innerHTML = p.title;
  
  var message = '<table class="table table-sm">';
  message += '<tbody>';
  
  // Basic Information
  if (p.owner) {
    message += '<tr><th scope="row" style="width: 120px;">負責人</th><td>' + p.owner + '</td></tr>';
  }
  message += '<tr><th scope="row">電話</th><td>' + (p.tel || '未提供') + '</td></tr>';
  message += '<tr><th scope="row">住址</th><td>' + p.city + p.town + p.address + '</td></tr>';
  message += '<tr><td colspan="2"><button class="detail-button" onclick="window.open(\'https://preschools.olc.tw/preschools/view/' + p.id + '\', \'_blank\')">詳細資訊</button></td></tr>';
  
  // Type and Classification
  if (p.type === '私立' && p.pre_public !== '無') {
    message += '<tr><th scope="row">類型</th><td>' + p.type + ' (準公共化)</td></tr>';
  } else {
    message += '<tr><th scope="row">類型</th><td>' + p.type + '</td></tr>';
  }
  
  if (p.pre_public && p.pre_public !== '無') {
    message += '<tr><th scope="row">準公共化</th><td>' + p.pre_public + '</td></tr>';
  }
  
  // Capacity and Size Information
  if (p.count_approved) {
    message += '<tr><th scope="row">核定人數</th><td>' + p.count_approved + ' 人</td></tr>';
  }
  
  if (p.size) {
    message += '<tr><th scope="row">全園總面積</th><td>' + p.size + ' 平方公尺</td></tr>';
  }
  if (p.size_in) {
    message += '<tr><th scope="row">室內總面積</th><td>' + p.size_in + ' 平方公尺</td></tr>';
  }
  if (p.size_out) {
    message += '<tr><th scope="row">室外活動空間</th><td>' + p.size_out + ' 平方公尺</td></tr>';
  }
  if (p.floor) {
    message += '<tr><th scope="row">使用樓層</th><td>' + p.floor + '</td></tr>';
  }
  
  // Registration Information
  if (p.reg_date) {
    message += '<tr><th scope="row">核准設立日期</th><td>' + p.reg_date + '</td></tr>';
  }
  if (p.reg_no) {
    message += '<tr><th scope="row">設立許可證號</th><td>' + p.reg_no + '</td></tr>';
  }
  if (p.reg_docno) {
    message += '<tr><th scope="row">設立許可文號</th><td>' + p.reg_docno + '</td></tr>';
  }
  
  // Fees and Services
  message += '<tr><th scope="row">每月收費</th><td><strong>$' + p.monthly + '</strong></td></tr>';
  
  if (p.is_free5 && p.is_free5 !== '無') {
    message += '<tr><th scope="row">五歲免費</th><td>' + p.is_free5 + '</td></tr>';
  }
  
  if (p.is_after && p.is_after !== '無') {
    message += '<tr><th scope="row">國小課後照顧</th><td>' + p.is_after + '</td></tr>';
  }
  
  if (p.shuttle && p.shuttle !== '無') {
    message += '<tr><th scope="row">幼童專用車</th><td>' + p.shuttle + '</td></tr>';
  }
  
  // Website
  if (p.url && p.url !== '') {
    message += '<tr><th scope="row">網址</th><td><a href="' + p.url + '" target="_blank" class="text-decoration-none">' + p.url + '</a></td></tr>';
  }
  
  // Status Information
  if (p.is_active !== undefined) {
    var statusText = p.is_active ? '營業中' : '已停業';
    var statusClass = p.is_active ? 'text-success' : 'text-danger';
    message += '<tr><th scope="row">營業狀態</th><td><span class="' + statusClass + '">' + statusText + '</span></td></tr>';
  }
  
  // Penalty Records
  if (p.penalty) {
    var penaltyClass = p.penalty === '有' ? 'text-warning' : 'text-success';
    message += '<tr><th scope="row">裁罰記錄</th><td><span class="' + penaltyClass + '">' + p.penalty + '</span></td></tr>';
  }
  
  message += '</tbody></table>';
  
  popupInfo.innerHTML = message;
  
  // Position the popup
  console.log('Positioning popup, clickPixel provided:', !!clickPixel);
  if (clickPixel) {
    var mapElement = document.getElementById('map');
    var mapRect = mapElement.getBoundingClientRect();
    
    var markerX = clickPixel[0] + mapRect.left;
    var markerY = clickPixel[1] + mapRect.top;
    
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var popupWidth = 350; // max-width from CSS
    var popupHeight = 400; // max-height from CSS
    
    var x, y;
    var isOnLeft = false;
    
    // Standard side positioning
    x = markerX + 30; // 30px offset to the right of marker
    y = markerY - 20;  // 20px offset above marker
    
    // Adjust if popup would go off right edge
    if (x + popupWidth > viewportWidth) {
      x = markerX - popupWidth - 30; // Place to the left instead
      isOnLeft = true;
      popupContent.classList.add('arrow-right');
      popupContent.classList.remove('arrow-left');
    } else {
      popupContent.classList.add('arrow-left');
      popupContent.classList.remove('arrow-right');
    }
    
    // Adjust if popup would go off bottom edge
    if (y + popupHeight > viewportHeight) {
      y = viewportHeight - popupHeight - 20;
    }
    
    // Adjust if popup would go off top edge
    if (y < 20) {
      y = 20;
    }
    
    popupContent.style.left = x + 'px';
    popupContent.style.top = y + 'px';
    
    // Create connector line
    var connector = document.getElementById('popupConnector');
    if (!connector) {
      connector = document.createElement('div');
      connector.id = 'popupConnector';
      connector.className = 'popup-connector';
      popupOverlay.appendChild(connector);
    }
    
    // Calculate line position and rotation
    var popupCenterX = x + (isOnLeft ? popupWidth : 0);
    var popupCenterY = y + 40; // Connect to upper part of popup
    
    var deltaX = markerX - popupCenterX;
    var deltaY = markerY - popupCenterY;
    var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    var angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    
    connector.style.left = Math.min(markerX, popupCenterX) + 'px';
    connector.style.top = Math.min(markerY, popupCenterY) + 'px';
    connector.style.width = distance + 'px';
    connector.style.height = '3px';
    connector.style.transformOrigin = '0 50%';
    connector.style.transform = 'rotate(' + angle + 'deg)';
    connector.style.display = 'block';
  }
  
  console.log('Setting popupOverlay display to block');
  console.log('Final popup position:', popupContent.style.left, popupContent.style.top);
  console.log('Popup overlay display style:', popupOverlay.style.display);
  popupOverlay.style.display = 'block';
  
  // Check if popup is actually visible after setting display
  setTimeout(function() {
    var computedStyle = window.getComputedStyle(popupOverlay);
    console.log('Popup overlay computed display:', computedStyle.display);
    console.log('Popup overlay computed visibility:', computedStyle.visibility);
    console.log('Popup overlay computed z-index:', computedStyle.zIndex);
  }, 100);
}

function closePopup() {
  var popupOverlay = document.getElementById('popupOverlay');
  var connector = document.getElementById('popupConnector');
  
  popupOverlay.style.display = 'none';
  
  if (connector) {
    connector.style.display = 'none';
  }
  
  // Reset current feature styling
  if (currentFeature) {
    currentFeature.setStyle(null); // Reset to default style
    vectorSource.refresh(); // Force refresh to apply default styling
    currentFeature = false;
  }
}

// Close popup when clicking overlay background
document.getElementById('popupOverlay').addEventListener('click', function(e) {
  console.log('Popup overlay clicked, target:', e.target, 'this:', this);
  console.log('Target class:', e.target.className);
  console.log('Closest popup-content:', e.target.closest('.popup-content'));
  
  // Close if clicking on the overlay itself or any area outside the popup content
  if (e.target === this || !e.target.closest('.popup-content')) {
    console.log('Closing popup due to overlay click');
    closePopup();
  } else {
    console.log('Not closing popup - click was inside content');
  }
});

// Filter popup functionality
function openFilterPopup() {
  var filterPopup = document.getElementById('filterPopup');
  filterPopup.style.display = 'flex';
}

function closeFilterPopup() {
  var filterPopup = document.getElementById('filterPopup');
  filterPopup.style.display = 'none';
}

// Close filter popup when clicking overlay background
document.getElementById('filterPopup').addEventListener('click', function(e) {
  if (e.target === this) {
    closeFilterPopup();
  }
});

function showPos(lng, lat) {
  firstPosDone = true;
  appView.setCenter(ol.proj.fromLonLat([parseFloat(lng), parseFloat(lat)]));
}

var previousFeature = false;
var currentFeature = false;
var slipYears = ['113'];
var slipKeys = ['學費', '雜費', '材料費', '活動費', '午餐費', '點心費', '全學期總收費', '交通費', '課後延托費', '家長會費'];

function showPoint(pointId) {
  console.log('showPoint called with ID:', pointId);
  firstPosDone = true;
  var features = vectorPoints.getSource().getFeatures();
  console.log('Total features found:', features.length);
  var pointFound = false;
  for (k in features) {
    var p = features[k].getProperties();
    if (p.id === pointId) {
      console.log('Found matching feature:', p.title, 'with ID:', p.id);
      pointFound = true;
      
      // If this is called from a hash update due to direct click, don't show popup again
      if (isHashUpdate) {
        console.log('Skipping due to isHashUpdate flag');
        isHashUpdate = false;
        document.title = p.title + ' - 台灣幼兒園地圖';
        return;
      }
      
      console.log('Setting map center and zoom...');
      var targetFeature = features[k]; // Capture the feature reference
      var targetCoords = targetFeature.getGeometry().getCoordinates();
      
      appView.setCenter(targetCoords);
      appView.setZoom(15);
      
      // Wait for map to settle, then simulate a click at the marker's center
      setTimeout(function() {
        console.log('Timeout triggered, calculating pixel coordinates...');
        var pixel = map.getPixelFromCoordinate(targetCoords);
        console.log('Pixel coordinates:', pixel);
        
        // Instead of trying to find the feature at pixel coordinates,
        // let's directly trigger the popup since we already have the feature
        console.log('Directly showing popup for target feature...');
        
        // Reset previous feature styling
        if (currentFeature && currentFeature !== targetFeature) {
          currentFeature.setStyle(null);
          vectorSource.refresh();
        }
        
        // Set new current feature and update its styling
        currentFeature = targetFeature;
        targetFeature.setStyle(pointStyleFunction(targetFeature));
        
        var p = targetFeature.getProperties();
        console.log('About to call showPopup with:', p.title, 'ID:', p.id);
        showPopup(p, pixel);
        console.log('Popup should now be visible');
      }, 1000); // Increased delay to 1 second
      
      document.title = p.title + ' - 台灣幼兒園地圖';
    }
  }
  if (!pointFound) {
    console.log('No feature found with ID:', pointId);
  }
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
  // Populate city dropdown
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
  
  // Check if there's a hash in the URL on initial load
  if (window.location.hash) {
    var pointId = window.location.hash.substring(1); // Remove the # symbol
    if (pointId) {
      // Small delay to ensure everything is properly initialized
      setTimeout(function() {
        showPoint(pointId);
      }, 100);
    }
  }

  // Initialize autocomplete for preschool search
  $('#findPoint').autocomplete({
    source: findTerms,
    select: function (event, ui) {
      var targetHash = '#' + ui.item.value;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      closeFilterPopup();
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
            closeFilterPopup();
        }
    });
});

// Legend toggle functionality
function toggleLegend() {
  var legend = document.getElementById('mapLegend');
  var toggleBtn = legend.querySelector('.legend-toggle');
  
  if (legend.classList.contains('collapsed')) {
    legend.classList.remove('collapsed');
    toggleBtn.textContent = '−';
  } else {
    legend.classList.add('collapsed');
    toggleBtn.textContent = '+';
  }
}