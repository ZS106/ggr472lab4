/*--------------------------------------------------------------------
GGR472 LAB 4: Incorporating GIS Analysis into web maps using Turf.js 
--------------------------------------------------------------------*/

/*--------------------------------------------------------------------
Step 1: INITIALIZE MAP
--------------------------------------------------------------------*/
//Define access token
mapboxgl.accessToken = 'pk.eyJ1IjoienNnZ3I0NzJoMSIsImEiOiJjbGU2MHQ4ZTYwaTZoM25xbDRnNXNhYWRvIn0.DOkNRgk75AzyG_TGFXMLqA'; //****ADD YOUR PUBLIC ACCESS TOKEN*****

//Initialize map
const map = new mapboxgl.Map({
    container: 'map', //container id in HTML
    style: 'mapbox://styles/zsggr472h1/clfhjpnxy001u01pb02c957v6',  //stylesheet location
    center: [ -79.37, 43.68 ],  // starting point, longitude/latitude 43.652652, -79.393014
    zoom: 10.5 // starting zoom level
});


/*--------------------------------------------------------------------
ADD MAP LAYERS & MAPBOX CONTROLS (AS ELEMENTS) ON MAP
--------------------------------------------------------------------*/
//zoom/rotation controls.
map.addControl(new mapboxgl.NavigationControl());

//fullscreen control to the map
map.addControl(new mapboxgl.FullscreenControl());

//Create geocoder variable
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: "ca"
});

//position geocoder on page by html div
document.getElementById('geocoder').appendChild(geocoder.onAdd(map));
const popup1 = new mapboxgl.Popup();



/*--------------------------------------------------------------------
Step 2: VIEW GEOJSON POINT DATA ON MAP
--------------------------------------------------------------------*/
let mygeojson;


// Fetch GeoJSON from URL and store response
fetch('https://raw.githubusercontent.com/ZS106/ggr472lab4/main/pedcyc_collision_06-21.geojson')
    .then(response => response.json())
    .then(response => {
        console.log(response); //Check response in console
        mygeojson = response; // Store geojson as variable using URL from fetch response
    });


/*--------------------------------------------------------------------
    Step 3 and 4: CREATE BOUNDING BOX AND HEXGRID; AGGREGATE COLLISIONS BY HEXGRID
--------------------------------------------------------------------*/

// /*--------------------------------------------------------------------
// GIS ANALYSIS: USE TURF FUNCTIONS TO ANALYSE GEOJSON VARIABLES
// --------------------------------------------------------------------*/

//Create a bounding box around points
document.getElementById('bboxbutton').addEventListener('change', () => {
    let bboxgeojson;
    let bbox = turf.envelope(mygeojson); //send point geojson to turf, creates an 'envelope' (bounding box) around points
    let bboxscaleup = turf.transformScale(bbox, 1.10); //increase bbox size by 10%

    //put the resulting envelope (scaled one) in a geojson format FeatureCollection
    bboxgeojson = {
        "type": "FeatureCollection",
        "features": [bboxscaleup]
    };

    //add the bounding box we just created to the map
    map.addSource('envelopeGeoJSON', {
        "type": "geojson",
        "data": bboxgeojson  //use bbox geojson variable as data source
    });

    //draw the bounding box
    map.addLayer({
        "id": "myEnvelope",
        "type": "fill",
        "source": "envelopeGeoJSON",
        "paint": {
            'fill-color': "grey", //set color
            'fill-opacity': 0.5,
            'fill-outline-color': "black"
        }
    });

    //accessing and storing the coordiantes of bounding box in a correct order.
    let bboxcoords = [bboxscaleup.geometry.coordinates[0][0][0],
                        bboxscaleup.geometry.coordinates[0][0][1],
                        bboxscaleup.geometry.coordinates[0][2][0],
                        bboxscaleup.geometry.coordinates[0][2][1]];
    //create a grid of 0.5km hexagons inside the spatial limits of the bounding box
    let hexgeojson = turf.hexGrid(bboxcoords, 0.5, {units: 'kilometers'});

    //collect/count the number of accidents inside each of hexagons.
    let collishex = turf.collect(hexgeojson, mygeojson, '_id', 'values');

    //) identify the maximum number of collisions in a polygon, set initial to 0
    let maxcount = 0;

    collishex.features.forEach((feature) => {//for each of the hexagon counted and collected by the collishex collection.
        feature.properties.COUNT = feature.properties.values.length //the total number of accidents of each hexagon COUNT is the length of (how many) locations inside each hexagon.
        if (feature.properties.COUNT > maxcount){ //if such number (COUNT) is greater than the max accident number stored before this hexagon, update the maxcount to this COUNT
            console.log(feature); //console to check this feature
            maxcount = feature.properties.COUNT //update the value of maxcount to this count
        }
    });//loop to the next hexagon.

    //add the data layer of hexgon
    map.addSource('collis-hex',{
        type: 'geojson',
        data: hexgeojson
    });


    //draw the hexagon layer
    map.addLayer({
        'id': 'hexgrid',
        'type': 'fill',
        'source': 'collis-hex',
        'paint':{
            'fill-color':[
                'step',
                ['get','COUNT'],
                '#34eb37',
                3, '#a1eb34',
                10, 'yellow',
                25, 'orange',
                35, 'red'
            ],
            'fill-opacity':0.5,
            'fill-outline-color': "white"
        }
    });

}); 

//Display the popup contains how many accidents inside each of hexgon on click.
popup1.remove();//avoid the overlap between two layers, the accident layer and hexgon layer
map.on('click', 'hexgrid',(n) => {
    popup1.remove();
    new mapboxgl.Popup()
    .setLngLat(n.lngLat)
    .setHTML("<b>Collision count:</b> "+n.features[0].properties.COUNT)//display count
    .addTo(map);
    popup1.remove();
})

// Change the cursor to a pointer when the mouse is over the places layer.
map.on('mouseenter', 'hexgrid', () => {
    popup1.remove();
    map.getCanvas().style.cursor = 'pointer';
    popup1.remove();
});
         
// Change it back to a pointer when mouse leaves.
map.on('mouseleave', 'hexgrid', () => {
    popup1.remove();
    map.getCanvas().style.cursor = '';
    popup1.remove();
});



// /*--------------------------------------------------------------------
// add accident data TO the base map
// --------------------------------------------------------------------*/
map.on('load', () => {

    //Add accident datasource
    map.addSource('collisToronto', {
        type: 'geojson',
        data: mygeojson
    });


    //draw the accident locations layer
    map.addLayer({
        'id': 'collisTorontoPts',
        'type': 'circle',
        'source': 'collisToronto',
        'paint': {
            'circle-radius': 5,
            'circle-color': 'blue'
        }
    });

});

//Display the popup contains the detailed information related for each of accident location on click.
map.on('click', 'collisTorontoPts',(e) => {
    const id = e.features[0].properties.ACCNUM;
    const year = e.features[0].properties.YEAR;
    const acclass = e.features[0].properties.ACCLASS;
    const type = e.features[0].properties.INVTYPE;
    const loc = e.features[0].properties.NEIGHBOURHOOD_158;
    popup1
    .setLngLat(e.lngLat)
    .setHTML('Accident Number: ' + id + ' <br />YEAR: ' + year + ' <br />CLASS: ' + acclass + 
    ' <br />TYPES: <br />' + type + ' <br />LOCATION: <br />' + loc)//display the information
    .addTo(map);
})

popup1.remove();//avoid the overlap between two layers, the accident layer and hexgon layer
// Change the cursor to a pointer when the mouse is over the places layer.
map.on('mouseenter', 'collisTorontoPts', () => {
    map.getCanvas().style.cursor = 'pointer';
});
         
// Change it back to a pointer when mouse leaves.
map.on('mouseleave', 'collisTorontoPts', () => {
    map.getCanvas().style.cursor = '';
});



// /*--------------------------------------------------------------------
// Step 5: FINALIZE YOUR WEB MAP
// --------------------------------------------------------------------*/

//Welcoming Popup (include some smaller tutorials).
const popup = new mapboxgl.Popup({ closeOnClick: false })
.setLngLat([-79.05, 43.7]) //postion of Popup.
.setHTML('<h1>In this map,</h1> <br > - you can click on each accident point to view more information!<br >' + 
            ' - click on Bounding box to view the hexgrid analysis of the accident locations<br >'+
            '(Notice: it is recommend to hide the accident location layer in order to better view and click on each hexgon to view the total number of accidents in each of hexgon)')
.addTo(map);



/*--------------------------------------------------------------------
add legend
--------------------------------------------------------------------*/
//Declare arrayy variables for labels and colours
const legendlabels = [
    'collision location',
    '',
    'Hexgrid analysis',
    '(# collisions/polygon)',
    '0-2',
    '3-9',
    '10-24',
    '25-34',
    '>= 35'
];

const legendcolours = [//lengend colours based on the color choices above.
'blue',
'',
'',
'',
'#34eb37',
'#a1eb34',
'yellow',
'orange',
'red'
];

//Declare legend variable using legend div
const legend = document.getElementById('legend');

//For each layer create a block to put the colour and label in
legendlabels.forEach((label, i) => {
    const color = legendcolours[i];

    const item = document.createElement('div'); //each layer gets a 'row' - this isn't in the legend yet, we do this later
    const key = document.createElement('span'); //add a 'key' to the row. A key will be the color circle

    key.className = 'legend-key'; //the key will take on the shape and style properties defined in css
    key.style.backgroundColor = color; // the background color is retreived from teh layers array

    const value = document.createElement('span'); //add a value variable to the 'row' in the legend
    value.innerHTML = `${label}`; //give the value variable text based on the label

    item.appendChild(key); //add the key (color cirlce) to the legend row
    item.appendChild(value); //add the value to the legend row

    legend.appendChild(item); //add row to the legend
});


//returns map view to full screen on button click
document.getElementById('returnbutton').addEventListener('click', () => {
    map.flyTo({
        center:[ -79.37, 43.68 ], //my map start point
        zoom: 10.5,
        essential: true
    });
});


//Change display of legend based on check box
let legendcheck = document.getElementById('legendcheck');

legendcheck.addEventListener('click', () => {//dafault box is checked.
    if (legendcheck.checked) {
        legendcheck.checked = true;
        legend.style.display = 'block';
    }
    else {
        legend.style.display = "none";
        legendcheck.checked = false;
    }
});


//Change the accident location layer display based on check box using setlayoutproperty
//I design so that the user could choose to display each layer independently.
//default boxes are checked.
document.getElementById('layercheck').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'collisTorontoPts',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );

});


//Change the hexgon layer display based on check box using setlayoutproperty
//I design so that the user could choose to display each layer independently.
//default boxes are unchecked.
document.getElementById('bboxbutton').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'hexgrid',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );
});


document.getElementById('bboxbutton').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'myEnvelope',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );
});


