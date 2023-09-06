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
addEventListener(map.load, initialise());

var stopsHashMap = {};
var errorMessage = "PassioGO! is being slow :)\nIt's still loading.";

function stillLoading(){alert(this.errorMessage)};

async function initialise(){
    $.ajaxSetup({
        type: 'POST',
        timeout: 30000,
        error: function(xhr) {
            $('#display_error')
            this.errorMessage = ("Timed Out. Passio dead :(");
        }
    })
    let tempScope = this;
    document.getElementById('routesButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('stopsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('alertsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('busesButton').addEventListener('click', stillLoading.bind(tempScope));
    var deviceId = (Math.floor(Math.random()*(10**8))).toString()
    
    await $.post("https://passio3.com/www/mapGetData.php?getRoutes=1&deviceId="+deviceId+"&wTransloc=1",
        {json:'{"systemSelected0":"1268","amount":1}'},
        function(data){
            if(Object.keys(JSON.parse(data)).includes('error')){
                this.errorMessage = "Passio servers dead, ggwp :(";
                return;
            }
            setRoutes(JSON.parse(data));
            loadRoutes();
        }).fail(function(){this.errorMessage = 'Passio servers dead, ggwp :(';}.bind(this));
    await $.post("https://passio3.com/www/mapGetData.php?getStops=1&deviceId="+deviceId+"&wTransloc=1",
        {json:'{"s0":"1268","sA":1}'},
        function(data){
            setStops(JSON.parse(data));
            loadStops();
        });
    await $.post("https://passio3.com/www/goServices.php?getAlertMessages=1&deviceId="+deviceId,
        {json:'{"systemSelected0":"1268", "amount":1}'},
        function(data){
            setAlerts(JSON.parse(data));
            loadAlerts();
        });
    setInterval(async function(){
        await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId="+deviceId+"&wTransloc=1",
            {json:'{"s0":"1268","sA":1}'},
            function(data){
                setBuses(JSON.parse(data));
                updateBuses();
            });
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
    if(userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('Android')){
        $("#stylesheet").attr("href", "styleMobile.css");
        console.info("mobile");
    }else{
        console.info("pc");
    }
    map.on('zoomend', fixSizes.bind(this));
};

function setRoutes(what){
    this.routes = what;
}

function setAlerts(what){
    this.alerts = what;
}

function setBuses(what){
    this.buses = what;
}

function setStops(what){
    this.stops = what;
}


function openStops(){
    closeAll();
    $("#stopsList").show();
}

function openRoutes(){
    closeAll();
    $("#routesList").show();
}

function openBuses(){
    closeAll();
    $("#busesList").show();
}

function openAlerts(){
    closeAll();
    $('#alertsList').show();
}

function closeAll(){
    $(".popup").hide();
}

function updateBuses(){
    return;
}

function loadRoutes(){
    let current = $("#routesList").find('[class="popupList"]')[0];
    var temp = [];
    this.routes.sort(function(a, b){
        return a['nameOrig'].localeCompare(b['nameOrig']);
    });
    for(var i = 0; i<this.routes.length; i++){
        if(!(excludeMyIDs.includes(this.routes[i].myid))){
            if(Object.keys(this.routes[i]).includes("serviceTime")){
                this.inactiveRoutes.push(this.routes[i]);
            } else{
                temp.push(this.routes[i]);
            }
        }
    }
    this.routes = temp;
    for(let i = 0; i<this.routes.length; i++){
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
        hihi.addEventListener('click', function(e){console.log(e.target); selectRoute(nam)}.bind(this));
        hi.addEventListener("click", function(e) {if(hi === e.target) {showRoute(this.routes[i].nameOrig)}}.bind(this));
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
    for(let i = 0; i<this.inactiveRoutes.length; i++){
        current.append(document.createElement("div"));
        current.lastChild.className = routeItem;
        current.lastChild.id = this.inactiveRoutes[i].nameOrig;
        current.lastChild.innerHTML = "<s>"+ this.inactiveRoutes[i].nameOrig + " | " + this.inactiveRoutes[i].shortName.toUpperCase()+"</s>";
        current.lastChild.append(document.createElement('div'));
        current.lastChild.lastChild.className = 'routeSelector';
        let nam = this.inactiveRoutes[i].nameOrig;
        current.lastChild.style.borderColor = this.inactiveRoutes[i].color;
        let hihi = current.lastChild.lastChild;
        let hi = current.lastChild;
        hihi.addEventListener('click', function(e){console.log(e.target); selectRoute(nam)}.bind(this));
        hi.addEventListener("click", function(e) {if(hi === e.target) {showRoute(this.inactiveRoutes[i].nameOrig)}}.bind(this));
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
    for(var el of document.getElementsByClassName('route')){
        el.onclick = function(){
            $(el.lastChild).show();
        }
    }
    this.routesLoaded = true;
}

function loadStops(){
    var keys = Object.keys(this.stops['routes']);
    for(var i = 0; i<keys.length; i++){
        if(Object.keys(this.routesReal).includes(this.stops['routes'][keys[i]][0])){
            this.routesReal[this.stops['routes'][keys[i]][0]].path = this.stops['routes'][keys[i]].slice(2);
        };
    };
    keys = Object.keys(this.stops['stops']);
    for(var key of keys){
        this.stopsReal[this.stops['stops'][key]['name']] = {
            id: this.stops['stops'][key]['id'],
            lat: this.stops['stops'][key]['latitude'],
            long: this.stops['stops'][key]['longitude'],
            routes: []
        }
        this.stopsHashMap[this.stops['stops'][key]['id']] = this.stops['stops'][key]['name'];
    }
    keys = Object.keys(this.routesReal);
    for(var key of keys){
        for(var i = 0; i<this.routesReal[key].path.length; i++){
            var currentStop = this.routesReal[key].path[i][1];
            for(var j = 0; j<Object.keys(this.stopsReal).length; j++){
                var stopToEdit = this.stopsReal[Object.keys(this.stopsReal)[j]].id;
                if(stopToEdit === currentStop){
                    this.stopsReal[Object.keys(this.stopsReal)[j]].routes.push(key);
                }
            }
        }
    }
    keys = Object.keys(this.stopsReal);
    for(var key of keys){
        if(this.stopsReal[key].routes.length === 0){
            delete this.stopsReal[key];
        }
    }
    keys = Object.keys(this.routesReal);
    for(var key of keys){
        var subkeys = Object.keys(this.stops.routePoints);
        for(var subkey of subkeys){
            if(this.routesReal[key].id == subkey){
                for(var point of this.stops.routePoints[subkey]){
                    this.routesReal[key].coords.push([point.lng, point.lat]);
                }
            }
        }
        renderRoute(key);
    }
    var current = $("#stopsList").find('[class="popupList"]')[0];
    var keys = Object.keys(this.stopsReal);
    var inactiveNames = [];
    for(var inactive of inactiveRoutes){
        inactiveNames.push(inactive.nameOrig);
    }
    for(let i = 0; i<keys.length; i++){
        current.append(document.createElement("div"));
        current.lastChild.className = stopItem;
        servicedByRoute = "";
        for(var route of this.stopsReal[keys[i]].routes){
            if(!(inactiveNames.includes(route))){
                servicedByRoute += "| " + route + " |";
            }
        }
        current.lastChild.innerHTML = keys[i] + "</br><p style='font-size: 1.5vh; font-weight: normal;'>" + servicedByRoute + "</p>";
        current.lastChild.addEventListener('click', function(){showStopOnMap(keys[i])})
    }
    for(var stop of Object.keys(stopsReal)){
        if(stopsReal[stop].routes != [])
            renderCircle(stopsReal[stop].routes, stop);
    }
    this.stopsLoaded = true;
}

function loadAlerts(){
    for(var msg of this.alerts.msgs){
        this.alertsReal.push({
            id: msg.id,
            heading: msg.name,
            message: msg.html,
            time: msg.createdF
        });
    }
    var current = $("#alertsList").find('[class="popupList"]')[0];
    for(var alert of this.alertsReal){
        current.append(document.createElement('div'));
        current.lastChild.className = alertItem;
        current.lastChild.innerHTML = alert.heading + " | <span style='font-size: 1.5vh;'>" +alert.time + "</span></br><p style='font-size: 1.5vh';>" + alert.message + "</p>";
    }
}

function showRoute(which){
    let toEdit = document.getElementById(which).lastChild;
    console.log(toEdit.style.display === "block");
    $(toEdit).slideToggle();
}
    
function selectRoute(which){
    var box = $(document.getElementById(which)).find('[class="routeSelector"]')[0];
    if(Object.keys(selectedRoutes).includes(which)){
        delete selectedRoutes[which];
        box.style.backgroundColor = "";
    } else{
        selectedRoutes[which] = this.routesReal[which];
        box.style.backgroundColor = box.parentNode.style.borderColor;
    }
    displayRoutes();
}

function displayRoutes(){
    for(var key of this.currentRoutes){
        try{
            map.removeLayer(key);
            map.removeLayer(key+"bg");
            map.removeSource(key);
        } catch{
            {};
        }
    }
    for(var toShow of Object.keys(this.selectedRoutes)){
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
            'id': this.selectedRoutes[toShow].full+"bg",
            'type': 'line',
            'source': this.selectedRoutes[toShow].full,
            'layout':{
                'line-join':'round',
                'line-cap': 'round'
            },
            'paint':{
                'line-color': color,
                'line-width': 5
            }
        })
        map.addLayer({
            'id': this.selectedRoutes[toShow].full,
            'type': 'line',
            'source': this.selectedRoutes[toShow].full,
            'layout':{
                'line-join':'round',
                'line-cap': 'round'
            },
            'paint':{
                'line-color': this.selectedRoutes[toShow].color,
                'line-width': 5
            }
        })
}
this.currentRoutes = Object.keys(this.selectedRoutes);
}

const ratio = 1.5;

function fixSizes(){
    var zoomb = map.getZoom();
    for(var mapRoute of this.currentRoutes){
        map.setPaintProperty(mapRoute, 'line-width', (ratio*zoomb)/5);
        map.setPaintProperty(mapRoute+"bg", 'line-width', (ratio*zoomb)/5);
    }
    for(var marker of document.querySelectorAll('.stopMarker')){
        for(var svug of marker.childNodes){
            marker.setAttribute('style', `height: ${(zoomb*ratio).toString()}px; width: ${(zoomb*ratio).toString()}px;`)
            $(svug).attr('height', (zoomb*ratio).toString()+"px");
            $(svug).attr('width', (ratio*zoomb).toString()+"px")
        }
    }
}

function lighten(what){
    var temp = what;
    temp += 120;
    if(temp>255){
        temp = 255;
    }
    return temp;
}

function renderRoute(routeName){
    var newNode = document.getElementById(routeName).appendChild(document.createElement('div'))
    var inner = "<ol style='font-weight: lighter; font-size: 2.25vh'>\n";
    var paath = this.routesReal[routeName].path;
    for(var stop of paath){
        inner += `<li onclick='showStopOnMap("${this.stopsHashMap[stop[1]]}")'>` + this.stopsHashMap[stop[1]] + "</li>";
    }
    inner += '</ol>';
    newNode.innerHTML = inner;
    $(newNode).hide();
}

function renderCircle(routeList, stopName){
    let routList = []
    let inRoutes = []
    for(var inRoute of this.inactiveRoutes){
        inRoutes.push(inRoute.nameOrig)
    }
    for(var rout of routeList){
        if(inRoutes.includes(rout)){
            {}
        } else{
            routList.push(rout);
        }
    }
    let svg = document.createElement('div');
    svg.className = 'stopMarker';
    svg.id = 'stop: '+stopName;
    let inner = '';
    if(routList.length > 0){
        for(var i = 0; i<routList.length; i++){
            inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "${routesReal[routList[i]].color}" stroke="#FFFFFF" stroke-width="0.3em">\n`
            inner += "<path d='"+arc({x:0,y:0,r:50,start:((360/routList.length)*i), end:((360/routList.length)*(i+1))})+"'></path>\n";
            inner += '</svg>\n';
        }
    }else{
        inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "#FFFFFFF" stroke="#FFFFFF" stroke-width="0.3em">\n`
        inner += "<path d='"+arc({x:0,y:0,r:50})+"'></path>\n";
        inner += '</svg>\n';
    }
    svg.innerHTML = inner;
    svg.addEventListener('click', function(){showStopDetails(stopName)}.bind(this));
    new mapboxgl.Marker(svg).setLngLat([stopsReal[stopName].long, stopsReal[stopName].lat]).addTo(map);
}

function showStopDetails(stopName){

}

function showStopOnMap(stopName){
    $("#stopsList").hide();
    $("#routesList").hide();
    map.setCenter([this.stopsReal[stopName].long, this.stopsReal[stopName].lat])
    map.setZoom(16);
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

const arc =  (opts = {}) => {
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

function colorToHex(color){
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
    for(var mapRoute of this.currentRoutes){
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
    