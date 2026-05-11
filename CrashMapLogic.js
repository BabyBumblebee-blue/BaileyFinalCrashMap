var currentBuffer = null;

var map = L.map('map').setView([35.0844, -106.6504], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// This is where ill put the icon i found
var schoolIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/5310/5310672.png',
    iconSize: [22, 25],
    iconAnchor: [11, 25],
    popupAnchor: [0, -25],
});

schoolData.forEach(function(school) {
    var coords = school.LatitudeLongitude.split(',').map(Number);
    
    var marker = L.marker(coords, { icon: schoolIcon })
        .bindPopup("<b>" + school.NAME + " " + school.LEVEL + "</b><br>" + school.ADDRESS)
        .addTo(map);

    // This should make the 1-mile buffer pop up when a school is clicked
    marker.on('click', function(e) {
        // This part will remove the old buffer
        if (currentBuffer) {
            map.removeLayer(currentBuffer);
        }

        // Make a 1-mile circle (1 mile = 1609.34 meters)
        currentBuffer = L.circle(coords, {
            radius: 1609.34, 
            color: 'rgb(255, 140, 0)',
            dashArray: '5, 10',    // Creates the dashed line effect
            fillColor: 'rgb(252, 147, 18)',
            fillOpacity: 0.15,
            weight: 2,
            interactive: false
        }).addTo(map);

        // count ONLY crashes within this buffer. How do i make it update the info bar at the top with this info?
        var counts = { tot: 0, fat: 0, ped: 0, cyc: 0 };

        crashLayer.eachLayer(function(layer) {
            var distance = map.distance(coords, layer.getLatLng());
            if (distance <= 1609.34) {
                counts.tot++;
                var props = layer.feature.properties;

                // IMPROVED FATALITY CHECK: Checks for the word "Fatal" OR if anyone was killed
                if (props.SEVERITY === "Fatal" || props.KILLED > 0) {
                    counts.fat++;
                }

                // Check for Pedestrian vs Pedalcycle
                if (props.FHE_ANALYSIS === "Pedestrian" || props.PED_INVOLVED === "Involved") {
                    counts.ped++;
                } else if (props.FHE_ANALYSIS === "Pedalcycle" || props.PEDALCYCLE_INVOLVED === "Involved") {
                    counts.cyc++;
                }
            }
        });

       
        document.getElementById('sc-stats').style.display = 'block';
        document.getElementById('sc-name').innerText = school.NAME + " Analysis (1-Mile Radius)";
        document.getElementById('d-tot').innerText = counts.tot;
        document.getElementById('d-fat').innerText = counts.fat;
        document.getElementById('d-ped').innerText = counts.ped;
        document.getElementById('d-cyc').innerText = counts.cyc;
        document.getElementById('back-btn').style.display = 'block';
        
        map.fitBounds(currentBuffer.getBounds());


    });
});

// thisll connect my crash data
function getCrashStyle(feature) {
    var props = feature.properties;
    var isFatal = props.SEVERITY === "Fatal" || props.KILLED > 0;
    var color = "rgb(47, 113, 229)"; //Pedestrian blue
    var radius = 4;

    if (isFatal) {
        color = "rgb(255, 55, 55)";
        radius = 7;        // Slightly bigger
    } else if (props.FHE_ANALYSIS === "Pedalcycle" || props.PEDALCYCLE_INVOLVED === "Involved") {
        color = "rgb(58, 227, 95)";
    }

    return {
        radius: radius,
        fillColor: color,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };
}

var crashLayer = L.geoJSON(crashData, {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, getCrashStyle(feature));
    },
    onEachFeature: function (feature, layer) {
        layer.bindPopup(`<b>${feature.properties.SEVERITY}</b><br>
                        Type: ${feature.properties.FHE_ANALYSIS}<br>
                        Year: ${feature.properties.YEAR}`);
    }
}).addTo(map);

// this should keep my red dots in the back so i can see them
crashLayer.eachLayer(function(layer) {
    var isFatal = layer.feature.properties.SEVERITY === "Fatal" || layer.feature.properties.KILLED > 0;
    if (!isFatal) {
        layer.bringToFront();
    }
});

// fill in the school search
var schoolSelect = document.getElementById('school-search');
schoolData.sort((a,b) => a.NAME.localeCompare(b.NAME)).forEach((school, index) => {
    var opt = document.createElement('option');
    opt.value = index; 
    opt.innerHTML = school.NAME;
    schoolSelect.appendChild(opt);
});

// Ok, i can zoom to a school, and can get out
function zoomToSchool(index) {
    var backBtn = document.getElementById('back-btn');
    var scStats = document.getElementById('sc-stats');
    var schoolSelect = document.getElementById('school-search');

    if (index === "") {
        map.setView([35.0844, -106.6504], 12);
        if (currentBuffer) map.removeLayer(currentBuffer);
        backBtn.style.display = 'none';
        scStats.style.display = 'none';
        schoolSelect.value = ""; // Resets the dropdown text
        return;
    }
    backBtn.style.display = 'block';

    var school = schoolData[index];
    var coords = school.LatitudeLongitude.split(',').map(Number);
    map.setView(coords, 16);
    
    map.eachLayer(function(layer) {
        if (layer instanceof L.Marker && layer.getLatLng().lat === coords[0]) {
            layer.fire('click');
        }
    });
}

// This will be my filters!
function filterCrashes() {
    var typeVal = document.getElementById('type-filter').value;
    var yearVal = document.getElementById('year-filter').value;

    crashLayer.clearLayers();
    crashLayer.addData(crashData); 

    crashLayer.eachLayer(function(layer) {
        var feature = layer.feature;
        var props = feature.properties;
        
        // Robust Fatality Check
        var isFatal = props.SEVERITY === "Fatal" || props.KILLED > 0;
        
        var matchType = true;
        var matchYear = true;

        // Type Filtering
        if (typeVal === "fatal") {
            matchType = isFatal;
        } else if (typeVal === "pedestrian") {
            matchType = (props.FHE_ANALYSIS === "Pedestrian" || props.PED_INVOLVED === "Involved");
        } else if (typeVal === "pedalcycle") {
            matchType = (props.FHE_ANALYSIS === "Pedalcycle" || props.PEDALCYCLE_INVOLVED === "Involved");
        }

        // Year Filtering
        if (yearVal !== "all") {
            matchYear = props.YEAR.toString() === yearVal;
        }

        if (!matchType || !matchYear) {
            crashLayer.removeLayer(layer);
        }
    });
}

// Modal Toggle Functions
function openAbout() { document.getElementById('modal-overlay').classList.add('open'); }
function closeAbout() { document.getElementById('modal-overlay').classList.remove('open'); }