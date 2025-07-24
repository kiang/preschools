// Global variables
var map;
var markers = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 50,
    iconCreateFunction: function(cluster) {
        var childCount = cluster.getChildCount();
        var c = ' marker-cluster-';
        if (childCount < 10) {
            c += 'small';
        } else if (childCount < 100) {
            c += 'medium';
        } else {
            c += 'large';
        }
        return new L.DivIcon({
            html: '<div><span>' + childCount + '</span></div>',
            className: 'marker-cluster' + c,
            iconSize: new L.Point(40, 40)
        });
    }
});

var cityList = {};
var filterCity = '', filterTown = '';
var maxMonthlyFee = 20000;
var punishmentData = {};
var punishmentTerms = [];
var allMarkers = [];
var currentFeature = null;
var isHashUpdateFromClick = false;

// Function to check if coordinates are within Taiwan's main islands
function isWithinTaiwan(lon, lat) {
    var taiwanBounds = {
        north: 26.4,
        south: 21.9,
        east: 122.0,
        west: 119.3
    };
    
    return lat >= taiwanBounds.south && lat <= taiwanBounds.north && 
           lon >= taiwanBounds.west && lon <= taiwanBounds.east;
}

// Function to get marker color based on preschool type
function getMarkerColor(properties) {
    if (!properties.is_active) {
        return '#95a5a6'; // Gray for closed
    }
    
    switch (properties.type) {
        case '公立':
            return '#27ae60'; // Green
        case '私立':
            if (properties.pre_public !== '無') {
                return '#1abc9c'; // Teal for semi-public
            } else {
                return '#3498db'; // Blue for private
            }
        case '非營利':
            return '#f39c12'; // Orange
        default:
            return '#7f8c8d'; // Gray default
    }
}

// Create custom marker icon
function createMarkerIcon(properties, isSelected) {
    var color = getMarkerColor(properties);
    var borderColor = properties.penalty === '有' ? '#e74c3c' : '#ffffff';
    var borderWidth = properties.penalty === '有' ? 3 : 2;
    var size = isSelected ? 20 : 12;
    
    if (isSelected) {
        // Enhanced styling for selected marker
        var hasPenalty = properties.penalty === '有';
        var selectedBorderColor = hasPenalty ? '#e74c3c' : '#007bff';
        var pulseColor = hasPenalty ? '#e74c3c' : '#007bff';
        var glowColor = hasPenalty ? 'rgba(231, 76, 60, 0.8)' : 'rgba(0, 123, 255, 0.8)';
        
        var pulseRing = '<div style="position: absolute; width: ' + (size * 3) + 'px; height: ' + (size * 3) + 'px; border-radius: 50%; border: 3px solid ' + pulseColor + '; opacity: 0.5; top: 50%; left: 50%; transform: translate(-50%, -50%); animation: pulse 1.5s ease-out infinite;"></div>';
        var glowEffect = 'box-shadow: 0 0 20px ' + glowColor + ', 0 4px 8px rgba(0,0,0,0.5);';
        borderWidth = 4;
        
        return L.divIcon({
            className: 'custom-marker selected-marker',
            html: '<div style="position: relative; width: ' + (size * 2) + 'px; height: ' + (size * 2) + 'px;">' +
                  pulseRing +
                  '<div style="background-color: ' + color + '; width: ' + (size * 2) + 'px; height: ' + (size * 2) + 'px; border-radius: 50%; border: ' + borderWidth + 'px solid ' + selectedBorderColor + '; ' + glowEffect + ' position: relative; z-index: 2;"></div>' +
                  '</div>',
            iconSize: [size * 3, size * 3],
            iconAnchor: [size * 1.5, size * 1.5]
        });
    } else {
        return L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: ' + color + '; width: ' + (size * 2) + 'px; height: ' + (size * 2) + 'px; border-radius: 50%; border: ' + borderWidth + 'px solid ' + borderColor + '; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [size * 2, size * 2],
            iconAnchor: [size, size]
        });
    }
}

// Initialize the map
function initMap() {
    // Initialize Leaflet map centered on Taiwan
    map = L.map('map').setView([23.000694, 120.221507], 10);
    
    // Add Taiwan WMTS base layer
    var nlscUrl = 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}';
    L.tileLayer(nlscUrl, {
        attribution: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>',
        maxZoom: 18,
        opacity: 0.8
    }).addTo(map);
    
    // Add marker cluster group to map
    map.addLayer(markers);
    
    // Setup geolocation
    setupGeolocation();
}

// Setup geolocation functionality
function setupGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var lon = position.coords.longitude;
            var lat = position.coords.latitude;
            
            if (isWithinTaiwan(lon, lat)) {
                map.setView([lat, lon], 14);
                
                // Add user location marker
                L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'user-location',
                        html: '<div style="background-color: #3399CC; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                    })
                }).addTo(map);
            }
        });
    }
}

// Geolocation button handler
$('#btn-geolocation').click(function () {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var lon = position.coords.longitude;
            var lat = position.coords.latitude;
            
            if (isWithinTaiwan(lon, lat)) {
                map.setView([lat, lon], 14);
            } else {
                map.setView([23.000694, 120.221507], 14);
            }
            closeFilterPopup();
        }, function() {
            alert('目前使用的設備無法提供地理資訊');
        });
    } else {
        alert('目前使用的設備無法提供地理資訊');
    }
    return false;
});

// Show popup function
function showPopup(properties) {
    var popupTitle = document.getElementById('popupTitle');
    var popupInfo = document.getElementById('popupInfo');
    var popupOverlay = document.getElementById('popupOverlay');
    var popupContent = popupOverlay.querySelector('.popup-content');
    
    popupTitle.innerHTML = properties.title;
    
    var message = '<table class="table table-sm">';
    message += '<tbody>';
    
    // Basic Information
    if (properties.owner) {
        message += '<tr><th scope="row" style="width: 120px;">負責人</th><td><a href="https://preschools.olc.tw/owners/' + properties.owner + '" target="_blank" class="text-decoration-none">' + properties.owner + '</a></td></tr>';
    }
    message += '<tr><th scope="row">電話</th><td>' + (properties.tel || '未提供') + '</td></tr>';
    message += '<tr><th scope="row">住址</th><td>' + properties.city + properties.town + properties.address + '</td></tr>';
    message += '<tr><td colspan="2"><button class="detail-button" onclick="window.open(\'https://preschools.olc.tw/preschools/view/' + properties.id + '\', \'_blank\')">詳細資訊</button></td></tr>';
    
    // Type and Classification
    if (properties.type === '私立' && properties.pre_public !== '無') {
        message += '<tr><th scope="row">類型</th><td>' + properties.type + ' (準公共化)</td></tr>';
    } else {
        message += '<tr><th scope="row">類型</th><td>' + properties.type + '</td></tr>';
    }
    
    if (properties.pre_public && properties.pre_public !== '無') {
        message += '<tr><th scope="row">準公共化</th><td>' + properties.pre_public + '</td></tr>';
    }
    
    // Capacity and other info...
    if (properties.count_approved) {
        message += '<tr><th scope="row">核定人數</th><td>' + properties.count_approved + ' 人</td></tr>';
    }
    
    message += '<tr><th scope="row">每月收費</th><td><strong>$' + properties.monthly + '</strong></td></tr>';
    
    // Website
    if (properties.url && properties.url !== '') {
        message += '<tr><th scope="row">網址</th><td><a href="' + properties.url + '" target="_blank" class="btn btn-sm btn-outline-primary">點我前往</a></td></tr>';
    }
    
    // Status Information
    if (properties.is_active !== undefined) {
        var statusText = properties.is_active ? '營業中' : '已停業';
        var statusClass = properties.is_active ? 'text-success' : 'text-danger';
        message += '<tr><th scope="row">營業狀態</th><td><span class="' + statusClass + '">' + statusText + '</span></td></tr>';
    }
    
    // Penalty Records
    if (properties.penalty) {
        var penaltyClass = properties.penalty === '有' ? 'text-warning' : 'text-success';
        message += '<tr><th scope="row">裁罰記錄</th><td><span class="' + penaltyClass + '">' + properties.penalty + '</span></td></tr>';
    }
    
    message += '</tbody></table>';
    
    // Special promotion for 竹北市 preschools
    if (properties.city === '新竹縣' && properties.town === '竹北市') {
        message += '<div style="text-align: center; margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 6px;">';
        message += '<a href="https://www.facebook.com/zhubeibetter" target="_blank" style="text-decoration: none;">';
        message += '<img src="img/zhubeibetter.jpg" alt="竹北更好" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">';
        message += '</a>';
        message += '</div>';
    }
    
    popupInfo.innerHTML = message;
    
    // Position the popup in center of screen
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var popupWidth = 350;
    var popupMaxHeight = Math.floor(viewportHeight * 0.8);
    
    var x = (viewportWidth - popupWidth) / 2;
    var y = (viewportHeight - popupMaxHeight) / 2;
    
    x = Math.max(20, x);
    y = Math.max(20, y);
    
    if (x + popupWidth > viewportWidth - 20) {
        x = viewportWidth - popupWidth - 20;
    }
    if (y + popupMaxHeight > viewportHeight - 20) {
        y = viewportHeight - popupMaxHeight - 20;
    }
    
    popupContent.style.left = x + 'px';
    popupContent.style.top = y + 'px';
    
    popupContent.classList.remove('arrow-left', 'arrow-right');
    
    var connector = document.getElementById('popupConnector');
    if (connector) {
        connector.style.display = 'none';
    }
    
    popupOverlay.style.display = 'block';
}

// Close popup
function closePopup() {
    var popupOverlay = document.getElementById('popupOverlay');
    popupOverlay.style.display = 'none';
    
    // Keep the marker highlighted even after closing popup
    // The highlight will only be removed when another marker is clicked
}

// Filter functions
function applyFilters() {
    markers.clearLayers();
    
    var filteredMarkers = allMarkers.filter(function(markerData) {
        var p = markerData.properties;
        
        if (filterCity !== '' && p.city !== filterCity) {
            return false;
        }
        if (filterTown !== '' && p.town !== filterTown) {
            return false;
        }
        if (parseInt(p.monthly) > maxMonthlyFee) {
            return false;
        }
        
        return true;
    });
    
    filteredMarkers.forEach(function(markerData) {
        markers.addLayer(markerData.marker);
    });
    
    // Fit map bounds to show all filtered markers
    if (filteredMarkers.length > 0 && (filterCity !== '' || filterTown !== '')) {
        var group = new L.featureGroup(filteredMarkers.map(function(markerData) {
            return markerData.marker;
        }));
        map.fitBounds(group.getBounds(), {
            padding: [20, 20],
            maxZoom: 15
        });
    }
}

// Filter controls
$('select#city').change(function () {
    filterCity = $(this).val();
    var townOptions = '<option value="">--</option>';
    if (filterCity !== '') {
        for (var town in cityList[filterCity]) {
            townOptions += '<option>' + town + '</option>';
        }
    }
    $('select#town').html(townOptions);
    filterTown = '';
    applyFilters();
});

$('select#town').change(function () {
    filterTown = $(this).val();
    applyFilters();
});

$('#monthlyFeeRange').on('input', function() {
    maxMonthlyFee = parseInt($(this).val()) || 0;
    $('#monthlyFeeValue').text(maxMonthlyFee);
    applyFilters();
});

// Close popup when clicking overlay background
document.getElementById('popupOverlay').addEventListener('click', function(e) {
    if (e.target === this || !e.target.closest('.popup-content')) {
        closePopup();
    }
});

// Filter popup functionality
function openFilterPopup() {
    document.getElementById('filterPopup').style.display = 'flex';
}

function closeFilterPopup() {
    document.getElementById('filterPopup').style.display = 'none';
}

document.getElementById('filterPopup').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFilterPopup();
    }
});

// Legend toggle
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

// Load preschool data
function loadPreschoolData() {
    $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/preschools.json', {}, function (data) {
        var maxFee = 0;
        var findTerms = [];
        
        data.features.forEach(function(feature) {
            var p = feature.properties;
            var coords = feature.geometry.coordinates;
            
            // Create marker with permanent label for monthly fee
            var marker = L.marker([coords[1], coords[0]], {
                icon: createMarkerIcon(p, false)
            });
            
            // Add permanent tooltip showing monthly fee
            marker.bindTooltip('$' + p.monthly + '/月', {
                permanent: true,
                direction: 'bottom',
                className: 'fee-label',
                offset: [0, 15],
                opacity: 1
            });
            
            // Store properties with marker
            marker.properties = p;
            
            // Add click handler
            marker.on('click', function(e) {
                // Update marker style
                if (currentFeature) {
                    currentFeature.setIcon(createMarkerIcon(currentFeature.properties, false));
                }
                currentFeature = marker;
                marker.setIcon(createMarkerIcon(p, true));
                
                // Show popup without changing view
                showPopup(p);
                document.title = p.title + ' - 台灣幼兒園地圖';
                
                // Update URL hash
                if (window.location.hash !== '#' + p.id) {
                    isHashUpdateFromClick = true;
                    window.location.hash = '#' + p.id;
                }
            });
            
            // Store marker data
            allMarkers.push({
                marker: marker,
                properties: p
            });
            
            // Build city list
            if (!cityList[p.city]) {
                cityList[p.city] = {};
            }
            if (!cityList[p.city][p.town]) {
                cityList[p.city][p.town] = 1;
            } else {
                cityList[p.city][p.town]++;
            }
            
            // Track max fee
            var monthlyFee = parseInt(p.monthly);
            if (!isNaN(monthlyFee) && monthlyFee > maxFee) {
                maxFee = monthlyFee;
            }
            
            // Build search terms
            findTerms.push({
                value: p.id,
                label: p.title + '(' + p.owner + ') ' + p.address
            });
        });
        
        // Populate city dropdown
        var cityOptions = '<option value="">--</option>';
        for (var city in cityList) {
            cityOptions += '<option>' + city + '</option>';
        }
        $('select#city').html(cityOptions);
        
        // Update fee range slider
        $('#monthlyFeeRange').attr('max', maxFee);
        $('#monthlyFeeRange').val(maxFee);
        $('#monthlyFeeValue').text(maxFee);
        maxMonthlyFee = maxFee;
        
        // Add all markers to cluster group
        allMarkers.forEach(function(markerData) {
            markers.addLayer(markerData.marker);
        });
        
        // Setup autocomplete
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
        
        // Handle initial hash after a delay to ensure everything is loaded
        if (window.location.hash) {
            setTimeout(function() {
                showPoint(window.location.hash.substring(1), true);
            }, 1000);
        }
    });
}

// Show specific point by ID
function showPoint(pointId, fromInitialLoad) {
    // Ensure map is initialized
    if (!map) {
        console.log('Map not yet initialized');
        return;
    }
    
    var found = false;
    
    for (var i = 0; i < allMarkers.length; i++) {
        var markerData = allMarkers[i];
        if (markerData.properties.id === pointId) {
            found = true;
            var marker = markerData.marker;
            
            // Only center and zoom if this is from initial page load
            if (fromInitialLoad) {
                var latlng = marker.getLatLng();
                map.setView(latlng, 15);
                
                // Simulate click on marker after map settles
                setTimeout(function() {
                    marker.fire('click');
                }, 500);
            } else {
                // Just simulate click without changing view
                marker.fire('click');
            }
            
            break;
        }
    }
    
    if (!found) {
        console.log('No feature found with ID:', pointId);
    }
}

// Load punishment data
function loadPunishmentData() {
    $.getJSON('https://kiang.github.io/ap.ece.moe.edu.tw/punish_all.json', {}, function(data) {
        punishmentData = data;
        
        for (var key in data) {
            for (var i = 0; i < data[key].length; i++) {
                var punishment = data[key][i];
                punishmentTerms.push({
                    value: punishment.id,
                    label: punishment.date + key + ' - ' + punishment.punishment + '(' + punishment.law + ')'
                });
            }
        }
        
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
}

// Setup routing
function setupRouting() {
    routie(':pointId', function(pointId) {
        if (isHashUpdateFromClick) {
            // Reset flag and don't do anything (marker click already handled it)
            isHashUpdateFromClick = false;
        } else {
            // This is from direct URL access or autocomplete, so show the point
            showPoint(pointId, false);
        }
    });
    routie('pos/:lng/:lat', function(lng, lat) {
        if (map) {
            map.setView([parseFloat(lat), parseFloat(lng)], 14);
        }
    });
}

// Initialize everything when DOM is ready
$(document).ready(function() {
    initMap();
    loadPreschoolData();
    loadPunishmentData();
    setupRouting();
});

// Make functions available globally
window.closePopup = closePopup;
window.openFilterPopup = openFilterPopup;
window.closeFilterPopup = closeFilterPopup;
window.toggleLegend = toggleLegend;