var routes;
var inactiveRoutes = [];
var stops;
var buses;
var alerts;

var excludeList = ['cam', 'ccexp', 'connect', 'penn', 'pennexpr']
var excludeMyIDs = ['41231', '4088', '4063', '4056', '4098']
var routeItem = "popupItem route";
var busItem = "popupItem bus"
var stopItem = "popupItem stop"
var alertItem = "popupItem alert"

var routesReal = {};
var stopsReal = {};
var busesReal = {};
var alertsReal = [];

var routesLoaded = false;
var stopsLoaded = false;
var busesLoaded = false;
var alertsLoaded = false;

var selectedRoutes = {};
var currentRoutes = [];
var stopsOrdered = [];
var hasBuses = [];
addEventListener(map.load, initialise());

var stopsHashMap = {};
var errorMessage = "PassioGO! is being slow :)\nIt's still loading.";

function stillLoading() { alert(this.errorMessage) };

function failure() {
    $("#status").show();
    this.errorMessage = 'Passio servers dead, ggwp :(';
    document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>We Don't Know Why</h3></br>But basically their service is down.</div>`;
}

async function initialise() {
    document.getElementById('busSearch').addEventListener('input', function(event){filterBuses(event.data)});
    document.getElementById('stopSearch').addEventListener('input', function(event){filterStops(event.data)});
    $.ajaxSetup({
        type: 'POST',
        timeout: 30000,
        error: function (xhr) {
            this.errorMessage = ("Timed Out. Passio dead :(");
        }
    })
    let tempScope = this;
    document.getElementById('routesButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('stopsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('alertsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('busesButton').addEventListener('click', stillLoading.bind(tempScope));
    var deviceId = (Math.floor(Math.random() * (10 ** 8))).toString()

    await $.post("https://passio3.com/www/mapGetData.php?getRoutes=1&deviceId=" + deviceId + "&wTransloc=1",
        { json: '{"systemSelected0":"1268","amount":1}' },
        function (data) {
            if (Object.keys(JSON.parse(data)).includes('error')) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                return;
            }
            setRoutes(JSON.parse(data));
            loadRoutes();
        }).fail(failure.bind(this));
    await $.post("https://passio3.com/www/mapGetData.php?getStops=1&deviceId=" + deviceId + "&wTransloc=1",
        { json: '{"s0":"1268","sA":1}' },
        function (data) {
            if (Object.keys(JSON.parse(data)).includes('error')) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                return;
            }
            setStops(JSON.parse(data));
            loadStops();
        }).fail(failure.bind(this));
    await $.post("https://passio3.com/www/goServices.php?getAlertMessages=1&deviceId=" + deviceId,
        { json: '{"systemSelected0":"1268", "amount":1}' },
        function (data) {
            if (Object.keys(JSON.parse(data)).includes('error')) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                return;
            }
            setAlerts(JSON.parse(data));
            loadAlerts();
        }).fail(failure.bind(this));
    await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1",
        { json: '{"s0":"1268","sA":1}' },
        function (data) {
            if (Object.keys(JSON.parse(data)).includes('error')) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                return;
            }
            setBusesFirst(JSON.parse(data));
        }).fail(failure.bind(this));
    await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1",
        { json: '{"s0":"1268","sA":1}' },
        function (data) {
            setBuses(JSON.parse(data));
            updateBuses();
        }).fail(failure.bind(this));
    setInterval(async function () {
        await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1",
            { json: '{"s0":"1268","sA":1}' },
            function (data) {
                setBuses(JSON.parse(data));
                updateBuses();
            }).fail(failure.bind(this));
    }, 10000);

    document.getElementById('routesButton').replaceWith(document.getElementById('routesButton').cloneNode(true));
    document.getElementById('stopsButton').replaceWith(document.getElementById('stopsButton').cloneNode(true));
    document.getElementById('busesButton').replaceWith(document.getElementById('busesButton').cloneNode(true));
    document.getElementById('alertsButton').replaceWith(document.getElementById('alertsButton').cloneNode(true));
    document.getElementById('routesButton').addEventListener('click', openRoutes.bind(this));
    document.getElementById('stopsButton').addEventListener('click', openStops.bind(this));
    document.getElementById('alertsButton').addEventListener('click', openAlerts.bind(this));
    document.getElementById('busesButton').addEventListener('click', openBuses.bind(this));

    var userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('Android')) {
        $("#stylesheet").attr("href", "styleMobile.css");
        console.info("mobile");
    } else {
        console.info("pc");
    }
    map.on('zoomend', fixSizes.bind(this));
    $("#status").hide();
};

function setRoutes(what) {
    this.routes = what;
}

function setAlerts(what) {
    this.alerts = what;
}

function setBuses(what) {
    this.trueSetBuses(what);
    this.bussyDeletion();
    
}

function trueSetBuses(what) {
    this.buses = what;
    var busesExclusively = this.buses['buses'];
    var busIds = Object.keys(busesExclusively);
    for(var routs of Object.keys(this.routesReal)){
        this.routesReal[routs].active = false;
    }
    for (var busId of busIds) {
        let currentBus = busesExclusively[busId][0];
        this.busesReal[currentBus['busName']] = {
            num: currentBus['busName'],
            route: currentBus['route'],
            routeId: currentBus['routeId'],
            active: !Boolean(currentBus['outOfService']),
            fullness: parseInt(currentBus['paxLoad'] / currentBus['totalCap']),
            id: currentBus['busId'],
            position: [currentBus['longitude'], currentBus['latitude']],
            bearing: currentBus['calculatedCourse']
        }
    }
}

function showBusOnMap(which){
    console.log(which);
    $("#stopsList").hide();
    $("#routesList").hide();
    $("#busesList").hide();
    console.log(this.busMarkers[which])
    map.setCenter(this.busesReal[which].position);
    map.setZoom(16);
}

async function setBusesFirst(what) {
    this.trueSetBuses(what);
    await this.bussyDeletion();
    for(var rout of Object.keys(this.routesReal).toSorted()){
        this.routesReal[rout].active = (this.routesReal[rout].buses.length > 0);
        console.log(rout, this.routesReal[rout].buses.length > 0, this.routesReal[rout].active)
    }
    var current = $("#busesList").find('[class="popupList"]')[0];
    for(let rout of Object.keys(this.routesReal).toSorted()){
        if(this.routesReal[rout].active){
            this.routesReal[rout].buses.sort();
            for(let x = 0; x<this.routesReal[rout].buses.length; x++){
                console.log(x)
                console.log(this.busesReal[this.routesReal[rout].buses[x]]);
                if(this.busesReal[this.routesReal[rout].buses[x]].active){
                    current.append(document.createElement('div'))
                    current.lastChild.className = this.busItem;
                    current.lastChild.id = this.routesReal[rout].buses[x];
                    current.lastChild.innerHTML = this.routesReal[rout].buses[x] + " | " + this.busesReal[this.routesReal[rout].buses[x]].route
                    let bruh = (this.routesReal[rout].buses[x]);
                    current.lastChild.addEventListener('click', function(){showBusOnMap(bruh)}.bind(this));
                }
            }
        }
    }
    $(document.getElementById('routesList')).find('[class="popupList"]')[0].innerHTML = "";
    var current = $(document.getElementById('routesList')).find('[class="popupList"]')[0];
    for(var rout of Object.keys(this.routesReal).toSorted()){
        if(this.routesReal[rout].active){
            current.append(document.createElement("div"));
            current.lastChild.className = routeItem;
            current.lastChild.id = this.routesReal[rout].full;
            current.lastChild.innerHTML = this.routesReal[rout].full + " | " + this.routesReal[rout].short.toUpperCase();
            current.lastChild.append(document.createElement('div'));
            current.lastChild.lastChild.className = 'routeSelector';
            let nam = this.routesReal[rout].full;
            current.lastChild.style.borderColor = this.routesReal[rout].color;
            let hihi = current.lastChild.lastChild;
            let hi = current.lastChild;
            hihi.addEventListener('click', function (e) { selectRoute(nam) }.bind(this));
            hi.addEventListener("click", function (e) { if (hi === e.target) { showRoute(nam) } }.bind(this));
            this.renderRoute(this.routesReal[rout].full);
        }
    }
    current.append(document.createElement("div"));
    current.lastChild.className = "popupItem bus";
    current.lastChild.innerText = "-- Inactive Routes --"
    for(var rout of Object.keys(this.routesReal).toSorted()){
        if(!this.routesReal[rout].active){
            current.append(document.createElement("div"));
            current.lastChild.className = routeItem;
            current.lastChild.id = this.routesReal[rout].full;
            current.lastChild.innerHTML = this.routesReal[rout].full + " | " + this.routesReal[rout].short.toUpperCase();
            current.lastChild.append(document.createElement('div'));
            current.lastChild.lastChild.className = 'routeSelector';
            let nam = this.routesReal[rout].full;
            current.lastChild.style.borderColor = this.routesReal[rout].color;
            let hihi = current.lastChild.lastChild;
            let hi = current.lastChild;
            hihi.addEventListener('click', function (e) { selectRoute(nam) }.bind(this));
            hi.addEventListener("click", function (e) { if (hi === e.target) { showRoute(nam) } }.bind(this));
            this.renderRoute(this.routesReal[rout].full)
        }
    }
}

function bussyDeletion() {
    var toDelete = [];
    for (let busReal of Object.keys(this.busesReal)) {
        let flag = true;
        if (Object.keys(this.routesReal).includes(this.busesReal[busReal].route))
        {
            this.routesReal[this.busesReal[busReal].route].buses.push(busReal);
            this.routesReal[this.busesReal[busReal].route].active = true;
            this.hasBuses.push(this.busesReal[busReal].route);
            flag = false;
        }
        if (flag) {
            toDelete.push(busReal);
        }
    }
    for (var to of toDelete) {
        delete this.busesReal[to];
    }
}

function setStops(what) {
    this.stops = what;
}


function openStops() {
    closeAll();
    $("#stopsList").show();
}

function openRoutes() {
    closeAll();
    $("#routesList").show();
}

function openBuses() {
    closeAll();
    $("#busesList").show();
}

function openAlerts() {
    closeAll();
    $('#alertsList').show();
}

function closeAll() {
    $(".popup").hide();
}

var busMarkers = {};

function updateBuses() {
    for (var rout of Object.keys(this.routesReal)){
        this.routesReal[rout].buses = [];
    }
    for (var bus of Object.keys(this.busesReal).toSorted()) {
        if (this.busesReal[bus].active || Object.keys(this.routes).includes(busesReal[bus].route)) {
            this.routesReal[busesReal[bus].route].buses.push(bus);
            if (document.getElementById("bus" + bus) === null) {
                let div = document.createElement('div');
                div.id = "bus" + bus;
                div.className = 'busMarker';
                let inner = "";
                inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" stroke="#FFFFFF" fill="${this.routesReal[this.busesReal[bus].route].color}" stroke-width="1em">\n`
                inner += "<path d='" + arc({ x: 0, y: 0, r: 45 }) + "'></path>\n";
                inner += '</svg>\n'; 
                inner += `<img style="transform: rotate(${this.busesReal[bus].bearing}deg);" src="assets/busPointer.svg?sanitize=true" height='20px' width='20px'>`
                div.innerHTML = inner;
                div.addEventListener('click', function () { showBusDetails(bus) }.bind(this));
                busMarkers[bus] = [new mapboxgl.Marker(div), []];
                busMarkers[bus][0].setLngLat(this.busesReal[bus].position)
                busMarkers[bus][0].addTo(map);
            } else {
                this.busMarkers[bus][1] = generateMovement([this.busMarkers[bus][0].getLngLat().lng, this.busMarkers[bus][0].getLngLat().lat], this.busesReal[bus].position);
            }
            this.frame = 0;
            console.log('joever');
            schmooveBus(bus, busMarkers[bus][1]);
            document.getElementById("bus"+bus).lastChild.setAttribute('style', `padding: ${0.2*(zoomb * busRatio)}px; transform: rotate(${this.busesReal[bus].bearing}deg);`);
            ;
        }
    }
}

async function schmooveBus(bus, frames) {
    for (let frame of frames) {
        this.busMarkers[bus][0].setLngLat(frame);
        await sleep(16);
    }
}

function showBusDetails(which) {

}

function loadRoutes() {
    let current = $("#routesList").find('[class="popupList"]')[0];
    var temp = [];
    this.routes.sort(function (a, b) {
        return a['nameOrig'].localeCompare(b['nameOrig']);
    });
    for (var i = 0; i < this.routes.length; i++) {
        if (!(excludeMyIDs.includes(this.routes[i].myid))) {
            if (Object.keys(this.routes[i]).includes("serviceTime")) {
                this.inactiveRoutes.push(this.routes[i]);
            } else {
                temp.push(this.routes[i]);
            }
        }
    }
    this.routes = temp;
    for (let i = 0; i < this.routes.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = routeItem;
        current.lastChild.id = this.routes[i].nameOrig;
        current.lastChild.innerHTML = this.routes[i].nameOrig + " | " + this.routes[i].shortName.toUpperCase();
        current.lastChild.append(document.createElement('div'));
        current.lastChild.lastChild.className = 'routeSelector';
        let nam = this.routes[i].nameOrig;
        current.lastChild.style.borderColor = this.routes[i].color;
        let hihi = current.lastChild.lastChild;
        let hi = current.lastChild;
        hihi.addEventListener('click', function (e) { selectRoute(nam) }.bind(this));
        hi.addEventListener("click", function (e) { if (hi === e.target) { showRoute(this.routes[i].nameOrig) } }.bind(this));
        this.routesReal[this.routes[i].nameOrig] = {
            id: this.routes[i].myid.toString(),
            short: this.routes[i].shortName,
            full: this.routes[i].nameOrig,
            path: [],
            buses: [],
            coords: [],
            centre: [this.routes[i].longitude, this.routes[i].latitude],
            zoom: this.routes[i].distance,
            active: true,
            color: this.routes[i].color
        };
    }
    for (let i = 0; i < this.inactiveRoutes.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = routeItem;
        current.lastChild.id = this.inactiveRoutes[i].nameOrig;
        current.lastChild.innerHTML = this.inactiveRoutes[i].nameOrig + " | " + this.inactiveRoutes[i].shortName.toUpperCase();
        current.lastChild.append(document.createElement('div'));
        current.lastChild.lastChild.className = 'routeSelector';
        let nam = this.inactiveRoutes[i].nameOrig;
        current.lastChild.style.borderColor = this.inactiveRoutes[i].color;
        let hihi = current.lastChild.lastChild;
        let hi = current.lastChild;
        hihi.addEventListener('click', function (e) { selectRoute(nam) }.bind(this));
        hi.addEventListener("click", function (e) { if (hi === e.target) { showRoute(this.inactiveRoutes[i].nameOrig) } }.bind(this));
        this.routesReal[this.inactiveRoutes[i].nameOrig] = {
            id: this.inactiveRoutes[i].myid.toString(),
            short: this.inactiveRoutes[i].shortName,
            full: this.inactiveRoutes[i].nameOrig,
            path: [],
            buses: [],
            coords: [],
            centre: [this.inactiveRoutes[i].longitude, this.inactiveRoutes[i].latitude],
            zoom: this.inactiveRoutes[i].distance,
            active: false,
            color: this.inactiveRoutes[i].color
        };
    };
    for (var el of document.getElementsByClassName('route')) {
        el.onclick = function () {
            $(el.lastChild).show();
        }
    }
    this.routesLoaded = true;
}

function loadStops() {
    var keys = Object.keys(this.stops['routes']);
    for (var i = 0; i < keys.length; i++) {
        if (Object.keys(this.routesReal).includes(this.stops['routes'][keys[i]][0])) {
            this.routesReal[this.stops['routes'][keys[i]][0]].path = this.stops['routes'][keys[i]].slice(2);
        };
    };
    keys = Object.keys(this.stops['stops']);
    for (var key of keys) {
        this.stopsReal[this.stops['stops'][key]['name']] = {
            id: this.stops['stops'][key]['id'],
            lat: this.stops['stops'][key]['latitude'],
            long: this.stops['stops'][key]['longitude'],
            routes: [],
            full: this.stops['stops'][key]['name']
        }
        this.stopsHashMap[this.stops['stops'][key]['id']] = this.stops['stops'][key]['name'];
    }
    this.stopsOrdered = Object.keys(this.stopsReal);
    this.stopsOrdered.sort();
    keys = Object.keys(this.routesReal);
    for (var key of keys) {
        for (var i = 0; i < this.routesReal[key].path.length; i++) {
            var currentStop = this.routesReal[key].path[i][1];
            for (var j = 0; j < this.stopsOrdered.length; j++) {
                var stopToEdit = this.stopsReal[this.stopsOrdered[j]].id;
                if (stopToEdit === currentStop) {
                    this.stopsReal[this.stopsOrdered[j]].routes.push(key);
                }
            }
        }
    }
    keys = Object.keys(this.routesReal);
    for (var key of keys) {
        var subkeys = Object.keys(this.stops.routePoints);
        for (var subkey of subkeys) {
            if (this.routesReal[key].id == subkey) {
                for (var point of this.stops.routePoints[subkey]) {
                    this.routesReal[key].coords.push([point.lng, point.lat]);
                }
            }
        }
        renderRoute(key);
    }
    for (var stop of Object.keys(this.stopsReal)) {
        let stoppe = stopsReal[stop];
        if (stoppe.long < -75.6 || stoppe.long > -74.3 || stoppe.lat > 40.6 || stoppe.lat < 40.4) {
            delete stopsReal[stop];
        }
    }
    stopsOrdered = Object.keys(stopsReal);
    stopsOrdered.sort();
    var current = $("#stopsList").find('[class="popupList"]')[0];
    keys = this.stopsOrdered;
    var inactiveNames = [];
    for (var inactive of inactiveRoutes) {
        inactiveNames.push(inactive.nameOrig);
    }
    for (let i = 0; i < keys.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = stopItem;
        servicedByRoute = "";
        for (var route of this.stopsReal[keys[i]].routes) {
            if (!(inactiveNames.includes(route))) {
                servicedByRoute += "| " + route + " |";
            }
        }
        current.lastChild.innerHTML = keys[i] + "</br><p style='font-size: 1.5vh; font-weight: normal;'>" + servicedByRoute + "</p>";
        current.lastChild.addEventListener('click', function () { showStopOnMap(keys[i]) })
    }
    // bounds [-74.6, 40.4], [-74.3, 40.6]
    for (var stop of this.stopsOrdered) {
        if (stopsReal[stop].routes != [])
            renderCircle(stopsReal[stop].routes, stop);
    }
    this.stopsLoaded = true;
}

function loadAlerts() {
    for (var msg of this.alerts.msgs) {
        this.alertsReal.push({
            id: msg.id,
            heading: msg.name,
            message: msg.html,
            time: msg.createdF
        });
    }
    var current = $("#alertsList").find('[class="popupList"]')[0];
    for (var alert of this.alertsReal) {
        current.append(document.createElement('div'));
        current.lastChild.className = alertItem;
        current.lastChild.innerHTML = alert.heading + " | <span style='font-size: 1.5vh;'>" + alert.time + "</span></br><p style='font-size: 1.5vh';>" + alert.message + "</p>";
    }
}

function showRoute(which) {
    let toEdit = document.getElementById(which).lastChild;
    $(toEdit).slideToggle();
}

function selectRoute(which) {
    var box = $(document.getElementById(which)).find('[class="routeSelector"]')[0];
    if (Object.keys(selectedRoutes).includes(which)) {
        delete selectedRoutes[which];
        box.style.backgroundColor = "";
    } else {
        selectedRoutes[which] = this.routesReal[which];
        box.style.backgroundColor = box.parentNode.style.borderColor;
    }
    displayRoutes();
    for(var bus of Object.keys(this.busesReal)){
        document.getElementById("bus"+bus).style.display = "none";
    }
    for(let route of Object.keys(selectedRoutes)){
        for(var bus of this.routesReal[route].buses){
            document.getElementById("bus"+bus).style.display = "block";
        }
    }
}

function displayRoutes() {
    for (var key of this.currentRoutes) {
        try {
            map.removeLayer(key);
            map.removeLayer(key + "bg");
            map.removeSource(key);
        } catch {
            { };
        }
    }
    for (var toShow of Object.keys(this.selectedRoutes)) {
        map.addSource(this.selectedRoutes[toShow].full, {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': this.selectedRoutes[toShow].coords
                }
            }
        });
        var color = this.selectedRoutes[toShow].color;
        var red = lighten(parseInt(color.substring(1, 3), 16));
        var green = lighten(parseInt(color.substring(3, 5), 16));
        var blue = lighten(parseInt(color.substring(5, 7), 16));
        color = RGBtoHex(red, green, blue);
        map.addLayer({
            'id': this.selectedRoutes[toShow].full + "bg",
            'type': 'line',
            'source': this.selectedRoutes[toShow].full,
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': color,
                'line-width': 5
            }
        })
        map.addLayer({
            'id': this.selectedRoutes[toShow].full,
            'type': 'line',
            'source': this.selectedRoutes[toShow].full,
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': this.selectedRoutes[toShow].color,
                'line-width': 5
            }
        })
    }
    this.currentRoutes = Object.keys(this.selectedRoutes);
}

const ratio = 1.5;
const busRatio = 3;
var zoomb = map.getZoom();

function fixSizes() {
    for (var mapRoute of this.currentRoutes) {
        map.setPaintProperty(mapRoute, 'line-width', (ratio * zoomb) / 5);
        map.setPaintProperty(mapRoute + "bg", 'line-width', (ratio * zoomb) / 5);
    }
    for (var marker of document.querySelectorAll('.stopMarker')) {
        for (var svug of marker.childNodes) {
            marker.setAttribute('style', `height: ${(zoomb * ratio).toString()}px; width: ${(zoomb * ratio).toString()}px;`)
            $(svug).attr('height', (zoomb * ratio).toString() + "px");
            $(svug).attr('width', (ratio * zoomb).toString() + "px")
        }
    }
    for (var marker of document.querySelectorAll('.busMarker')) {
        marker.style.height = `${(zoomb * busRatio).toString()}px`;
        marker.style.width = `${(zoomb * busRatio).toString()}px`;
        $(marker.firstChild).attr('height', (zoomb * busRatio).toString() + "px");
        $(marker.firstChild).attr('width', (zoomb * busRatio).toString() + "px");
        marker.lastChild.style.height = (0.8* (zoomb * busRatio)).toString() + "px";
        marker.lastChild.style.width = (0.8* (zoomb * busRatio)).toString() + "px";
        marker.lastChild.style.padding = `${0.1*(zoomb * busRatio)}px`;
    }
}

function lighten(what) {
    var temp = what;
    temp += 120;
    if (temp > 255) {
        temp = 255;
    }
    return temp;
}

function renderRoute(routeName) {
    var newNode = document.getElementById(routeName).appendChild(document.createElement('div'))
    var inner = "<ol style='font-weight: lighter; font-size: 2.25vh'>\n";
    var paath = this.routesReal[routeName].path;
    for (var stop of paath) {
        inner += `<li onclick='showStopOnMap("${this.stopsHashMap[stop[1]]}")'>` + this.stopsHashMap[stop[1]] + "</li>";
    }
    inner += '</ol>';
    newNode.innerHTML = inner;
    $(newNode).hide();
}

function renderCircle(routeList, stopName) {
    let routList = []
    let inRoutes = []
    for (var inRoute of this.inactiveRoutes) {
        inRoutes.push(inRoute.nameOrig)
    }
    for (var rout of routeList) {
        if (inRoutes.includes(rout)) {
            { }
        } else {
            routList.push(rout);
        }
    }
    let svg = document.createElement('div');
    svg.className = 'stopMarker';
    svg.id = 'stop: ' + stopName;
    let inner = '';
    if (routList.length > 0) {
        for (var i = 0; i < routList.length; i++) {
            inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "${routesReal[routList[i]].color}" stroke="#FFFFFF" stroke-width="0.3em">\n`
            inner += "<path d='" + arc({ x: 0, y: 0, r: 50, start: ((360 / routList.length) * i), end: ((360 / routList.length) * (i + 1)) }) + "'></path>\n";
            inner += '</svg>\n';
        }
    } else {
        inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "#FFFFFFF" stroke="#FFFFFF" stroke-width="0.3em">\n`
        inner += "<path d='" + arc({ x: 0, y: 0, r: 50 }) + "'></path>\n";
        inner += '</svg>\n';
    }
    svg.innerHTML = inner;
    svg.addEventListener('click', function () { showStopDetails(stopName) }.bind(this));
    new mapboxgl.Marker(svg).setLngLat([stopsReal[stopName].long, stopsReal[stopName].lat]).addTo(map);
}

function showStopDetails(stopName) {

}

function showStopOnMap(stopName) {
    $("#stopsList").hide();
    $("#routesList").hide();
    map.setCenter([this.stopsReal[stopName].long, this.stopsReal[stopName].lat])
    map.setZoom(16);
}

function filterBuses(bus){
    var busess = $($("#busesList").find('[class="popupList"]')[0]).find('div');
    var bus = document.getElementById('busSearch').value;
    if(bus===""){
        for(var item of Object.keys(busess)){
            if(typeof busess[item] === "object"){
                $(busess[item]).show();
            }
        }
    } else {
        for(var item of Object.keys(buses).slice(0, Object.keys(buses).length-4)){
            if(typeof busess[item] === "object"){
                if(!stopss[item].innerText.toLowerCase().includes(stop.toLowerCase())){
                    $(busess[item]).hide();
                } else{
                    $(busess[item]).show();
                }
            }
        }
    }
}

function filterStops(stop){
    var stopss = $($("#stopsList").find('[class="popupList"]')[0]).find('div');
    var stop = document.getElementById('stopSearch').value;
    if(stop===""){
        for(var item of Object.keys(stopss)){
            if(typeof stopss[item] === "object"){
                $(stopss[item]).show();
            }
        }
    } else {
        for(var item of Object.keys(stopss).slice(0, Object.keys(stopss).length-4)){
            if(typeof stopss[item] === "object"){
                if(!stopss[item].innerText.toLowerCase().includes(stop.toLowerCase())){
                    $(stopss[item]).hide();
                } else{
                    $(stopss[item]).show();
                }
            }
        }
    }
}

// --------------------------------------------------------------------------

const point = (x, y, r, angel) => [
    (x + Math.sin(angel) * r).toFixed(2),
    (y - Math.cos(angel) * r).toFixed(2),
];

const full = (x, y, R, r) => {
    if (r <= 0) {
        return `M ${x - R} ${y} A ${R} ${R} 0 1 1 ${x + R} ${y} A ${R} ${R} 1 1 1 ${x - R} ${y} Z`;
    }
    return `M ${x - R} ${y} A ${R} ${R} 0 1 1 ${x + R} ${y} A ${R} ${R} 1 1 1 ${x - R} ${y} M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} A ${r} ${r} 1 1 1 ${x - r} ${y} Z`;
};

const part = (x, y, R, r, start, end) => {
    const [s, e] = [(start / 360) * 2 * Math.PI, (end / 360) * 2 * Math.PI];
    const P = [
        point(x, y, r, s),
        point(x, y, R, s),
        point(x, y, R, e),
        point(x, y, r, e),
    ];
    const flag = e - s > Math.PI ? '1' : '0';
    return `M ${P[0][0]} ${P[0][1]} L ${P[1][0]} ${P[1][1]} A ${R} ${R} 0 ${flag} 1 ${P[2][0]} ${P[2][1]} L ${P[3][0]} ${P[3][1]} A ${r} ${r}  0 ${flag} 0 ${P[0][0]} ${P[0][1]} Z`;
};

const arc = (opts = {}) => {
    const { x = 0, y = 0 } = opts;
    let {
        R = 0, r = 0, start, end,
    } = opts;

    [R, r] = [Math.max(R, r), Math.min(R, r)];
    if (R <= 0) return '';
    if (start !== +start || end !== +end) return full(x, y, R, r);
    if (Math.abs(start - end) < 0.000001) return '';
    if (Math.abs(start - end) % 360 < 0.000001) return full(x, y, R, r);

    [start, end] = [start % 360, end % 360];

    if (start > end) end += 360;
    return part(x, y, R, r, start, end);
};

function colorToHex(color) {
    var hexadecimal = color.toString(16);
    return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
}

const RGBtoHex = (red, green, blue) => {
    return "#" + colorToHex(red) + colorToHex(green) + colorToHex(blue);
}

const dashArraySequence = [
    [0, 4, 3],
    [0.5, 4, 2.5],
    [1, 4, 2],
    [1.5, 4, 1.5],
    [2, 4, 1],
    [2.5, 4, 0.5],
    [3, 4, 0],
    [0, 0.5, 3, 3.5],
    [0, 1, 3, 3],
    [0, 1.5, 3, 2.5],
    [0, 2, 3, 2],
    [0, 2.5, 3, 1.5],
    [0, 3, 3, 1],
    [0, 3.5, 3, 0.5]
];

let step = 0;

function animateDashArray(timestamp) {
    // Update line-dasharray using the next value in dashArraySequence. The
    // divisor in the expression `timestamp / 50` controls the animation speed.
    const newStep = parseInt(
        (timestamp / 50) % dashArraySequence.length
    );

    if (newStep !== step) {
        for (var mapRoute of this.currentRoutes) {
            map.setPaintProperty(
                mapRoute,
                'line-dasharray',
                dashArraySequence[step]
            );
        }
        step = newStep;
    }

    // Request the next frame of the animation.
    requestAnimationFrame(animateDashArray);
}

// start the animation
animateDashArray(0);

Array.prototype.removeAt = function (iIndex) {
    var vItem = this[iIndex];
    if (vItem) {
        this.splice(iIndex, 1);
    }
    return vItem;
};

function generateMovement(startPoint, endPoint) {
    var speedFactor = 100;
    var difflong = endPoint[0] - startPoint[0];
    var difflat = endPoint[1] - startPoint[1];

    var sflong = difflong / speedFactor;
    var sflat = difflat / speedFactor;

    var lineCoordinates = [];

    for (let i = 0; i < 100; i++) {
        lineCoordinates.push([startPoint[0] + (sflong * (i + 1)), startPoint[1] + (sflat * (i + 1))])
    }

    return lineCoordinates;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
