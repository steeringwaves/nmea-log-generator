global.$ = $;

const remote = require("@electron/remote");
const { Menu, BrowserWindow, MenuItem, shell, dialog } = remote;

const os = require("os");
const execSync = require("child_process").execSync;
const spawn = require("child_process").spawn;
const fs = require("fs");

var HISTORY_FILENAME = os.tmpdir() + "/NMEALogGeneratorHistory.json";
var SettingsObject = null;
var SettingsFileData = null;
var DefaultSettingsJSON = '{"Altitude":0, "Speed": 10, "HeadingEnabled": true, "ReverseEnabled": false}';

/* Function to click on elements */
function clickInput(id) {
	var event = document.createEvent("MouseEvents");
	event.initMouseEvent("click");
	document.getElementById(id).dispatchEvent(event);
}

function ReadSettings() {
	fs.readFile(HISTORY_FILENAME, "utf-8", function (error, contents) {
		SettingsFileData = contents;

		if (null != SettingsFileData && "" != SettingsFileData) {
			try {
				SettingsObject = JSON.parse(SettingsFileData);
			} catch (e) {
				SettingsObject = JSON.parse(DefaultSettingsJSON);
			}
		} else {
			SettingsObject = JSON.parse(DefaultSettingsJSON);
		}

		if (undefined != SettingsObject.Altitude) {
			$("#Altitude").val(SettingsObject.Altitude);
		}

		if (undefined != SettingsObject.Speed) {
			$("#Speed").val(SettingsObject.Speed);
		}

		if (undefined != SettingsObject.HeadingEnabled) {
			$("#HeadingEnabled").prop("checked", SettingsObject.HeadingEnabled);
		}

		if (undefined != SettingsObject.ReverseEnabled) {
			$("#ReverseEnabled").prop("checked", SettingsObject.ReverseEnabled);
		}
	});
}

function WriteSettings() {
	var Altitude = $("#Altitude").val();
	var Speed = $("#Speed").val();
	var HeadingEnabled = $("#HeadingEnabled").prop("checked");
	var ReverseEnabled = $("#ReverseEnabled").prop("checked");

	if (
		SettingsObject.Altitude != Altitude ||
		SettingsObject.Speed != Speed ||
		SettingsObject.HeadingEnabled != HeadingEnabled ||
		SettingsObject.ReverseEnabled != ReverseEnabled
	) {
		SettingsObject.Altitude = Altitude;
		SettingsObject.Speed = Speed;
		SettingsObject.HeadingEnabled = HeadingEnabled;
		SettingsObject.ReverseEnabled = ReverseEnabled;

		try {
			SettingsFileData = JSON.stringify(SettingsObject);
		} catch (e) {
			SettingsObject = JSON.parse(DefaultSettingsJSON);
		}

		fs.writeFileSync(HISTORY_FILENAME, SettingsFileData);
	}
}

function InitMenu() {
	var template = [
		{
			label: "File",
			submenu: [
				{
					label: "Load GeoJSON",
					click() {
						LoadGEOJSON();
					}
				},
				{
					label: "Save GeoJSON",
					click() {
						SaveGEOJSON();
					}
				},
				{
					label: "Export NMEA Log",
					click() {
						SaveNMEALog();
					}
				}
			]
		},
		/*
		{
			label: 'Edit',
			submenu: [
				{role: 'undo'},
				{role: 'redo'},
				{type: 'separator'},
				{role: 'cut'},
				{role: 'copy'},
				{role: 'paste'},
				{role: 'delete'},
				{role: 'selectall'}
			]
		},
*/
		///*
		{
			label: "View",
			submenu: [{ role: "reload" }, { role: "forcereload" }, { role: "toggledevtools" }]
		},
		//*/
		{
			role: "window",
			submenu: [{ role: "minimize" }, { role: "close" }]
		}
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

$(function () {
	/*-----------------------------------------------------------------------------------*/
	/*	Anchor Link
	/*-----------------------------------------------------------------------------------*/
	$("a[href*=#]:not([href=#])").click(function () {
		if (location.pathname.replace(/^\//, "") == this.pathname.replace(/^\//, "") || location.hostname == this.hostname) {
			var target = $(this.hash);
			target = target.length ? target : $("[name=" + this.hash.slice(1) + "]");
			if (target.length) {
				$("html,body").animate(
					{
						scrollTop: target.offset().top
					},
					1000
				);
				return false;
			}
		}
	});

	/*-----------------------------------------------------------------------------------*/
	/*  Tooltips
	/*-----------------------------------------------------------------------------------*/
	$(".tooltip-side-nav").tooltip();

	ReadSettings();
	InitMenu();
});

const M_PI = 3.14159265358979323846; /* pi */
const M_PI_180 = 0.01745329251994329576922; /* pi/180 */
const M_180_PI = 57.29577951308232087685; /* 180/pi */

function DegreesToRadians(x) {
	return x * M_PI_180;
}
function RadiansToDegrees(x) {
	return x * M_180_PI;
}

/**
 *****************************************************************************
 * @brief Scales Degrees to (-180 - 180)
 * @param degrees The degrees to scale
 * @return The scaled value in degrees
 *
 ****************************************************************************/
ScaleDegrees = function (degrees) {
	var scaled_degrees = degrees;

	while (scaled_degrees > 180.0) {
		scaled_degrees -= 360.0;
	}

	while (scaled_degrees < -180.0) {
		scaled_degrees += 360.0;
	}

	return scaled_degrees;
};

/**
 *****************************************************************************
 * @brief Calculates the distance from the local (lat,long) and the
 * remote (lat,long).
 * @param local_latitude The local latitude in degrees.
 * @param local_longitude The local longitude in degrees.
 * @param remote_latitude The remote latitude in degrees.
 * @param remote_longitude The remote longitude in degrees.
 * @return The distance in meters
 *
 ****************************************************************************/
CalculateHaversineDistance = function (local_latitude, local_longitude, remote_latitude, remote_longitude) {
	/* Convert degrees to radians */
	var local_lat_rads = local_latitude * M_PI_180;
	var local_lon_rads = local_longitude * M_PI_180;
	var remote_lat_rads = remote_latitude * M_PI_180;
	var remote_lon_rads = remote_longitude * M_PI_180;

	var delta_lat_rads = remote_lat_rads - local_lat_rads;
	var delta_lon_rads = remote_lon_rads - local_lon_rads;

	var a =
		Math.sin(delta_lat_rads / 2.0) * Math.sin(delta_lat_rads / 2.0) +
		Math.cos(local_lat_rads) *
			Math.cos(remote_lat_rads) *
			Math.sin(delta_lon_rads / 2.0) *
			Math.sin(delta_lon_rads / 2.0);

	var c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

	var distance = 6371000.0 * c; /* 6371000 is earth's radius in meters */

	return distance;
};

/**
 *****************************************************************************
 * @brief Calculates the bearing from the local (lat,long) and the
 * remote (lat,long).
 * @param local_latitude The local latitude in degrees.
 * @param local_longitude The local longitude in degrees.
 * @param remote_latitude The remote latitude in degrees.
 * @param remote_longitude The remote longitude in degrees.
 * @return The bearing in degrees
 *
 ****************************************************************************/
CalculateBearing = function (local_latitude, local_longitude, remote_latitude, remote_longitude) {
	var bearing;

	/* Convert degrees to radians */
	var local_lat_rads = local_latitude * M_PI_180;
	var local_lon_rads = local_longitude * M_PI_180;
	var remote_lat_rads = remote_latitude * M_PI_180;
	var remote_lon_rads = remote_longitude * M_PI_180;

	bearing = Math.atan2(
		Math.sin(remote_lon_rads - local_lon_rads) * Math.cos(remote_lat_rads),
		Math.cos(local_lat_rads) * Math.sin(remote_lat_rads) -
			Math.sin(local_lat_rads) * Math.cos(remote_lat_rads) * Math.cos(remote_lon_rads - local_lon_rads)
	);

	/* Convert bearing from radians to degrees */
	return RadiansToDegrees(bearing);
};

function CalculateNMEAChecksum(text) {
	// Compute the checksum by XORing all the character values in the string.
	var checksum = 0;
	for (var i = 0; i < text.length; i++) {
		checksum = checksum ^ text.charCodeAt(i);
	}

	// Convert it to hexadecimal (base-16, upper case, most significant nybble first).
	var hexsum = Number(checksum).toString(16).toUpperCase();

	if (hexsum.length < 2) {
		hexsum = ("00" + hexsum).slice(-2);
	}

	return hexsum;
}

function ConvertDecimalDegreesToNMEAGPS(lat, lon) {
	var lat_dir = "N";
	if (lat < 0) {
		lat *= -1;
		lat_dir = "S";
	}

	var lat_int = parseInt(lat);
	var lat_dec = (lat - lat_int) * 60;
	var nmea_lat = lat_int * 100 + lat_dec;

	var lon_dir = "E";
	if (lon < 0) {
		lon *= -1;
		lon_dir = "W";
	}

	var lon_int = parseInt(lon);
	var lon_dec = (lon - lon_int) * 60;
	var nmea_lon = lon_int * 100 + lon_dec;

	return [nmea_lat, lat_dir, nmea_lon, lon_dir];
}

Number.prototype.pad = function (size) {
	var s = String(this);
	while (s.length < (size || 2)) {
		s = "0" + s;
	}
	return s;
};

function GetTimestamp() {
	function pad(number) {
		if (number < 10) {
			return "0" + number;
		}
		return number;
	}

	var date = new Date();

	return (
		date.getFullYear() +
		"-" +
		pad(date.getMonth() + 1) +
		"-" +
		pad(date.getDate()) +
		" " +
		pad(date.getHours()) +
		":" +
		pad(date.getMinutes()) +
		":" +
		pad(date.getSeconds())
	);
}

function RunCalcs(result, start_geometry, end_geometry, speed) {
	var temp_result = result;

	// y = mx + b
	// m = (y2-y1)/(x2-x1)
	// b = y1 - (m * x1)
	var m = (end_geometry[1] - start_geometry[1]) / (end_geometry[0] - start_geometry[0]);

	var b = start_geometry[1] - m * start_geometry[0];

	var start = start_geometry[0];
	var end = end_geometry[0];

	var delta_x = Math.abs(end - start);

	var speed_meters_per_second = (speed * 1000) / 60 / 60;
	var distance = CalculateHaversineDistance(start_geometry[1], start_geometry[0], end_geometry[1], end_geometry[0]);

	var seconds_required = distance / speed_meters_per_second;
	var increment = delta_x / seconds_required;

	var heading = CalculateBearing(start_geometry[1], start_geometry[0], end_geometry[1], end_geometry[0]);

	if (start < end) {
		for (var x = start; x < end; x += increment) {
			var y = m * x + b;
			temp_result.push([x, y, heading]);
		}
	} else {
		for (var x = start; x > end; x -= increment) {
			var y = m * x + b;
			temp_result.push([x, y, heading]);
		}
	}

	return temp_result;
}

function ParseGEOJSONIntoArray(data, speed, reverse_enabled) {
	var result = [];

	for (var i = 0; i < data.features.length; i++) {
		if (data.features[i].geometry) {
			if (data.features[i].geometry.type == "LineString") {
				for (var j = 0; j < data.features[i].geometry.coordinates.length; j++) {
					if (j < data.features[i].geometry.coordinates.length - 1) {
						var temp_result = RunCalcs(
							result,
							data.features[i].geometry.coordinates[j],
							data.features[i].geometry.coordinates[j + 1],
							speed
						);
						result = temp_result;
					}
				}

				if (true == reverse_enabled) {
					for (var j = data.features[i].geometry.coordinates.length - 1; j > 0; j--) {
						if (j > 0) {
							var temp_result = RunCalcs(
								result,
								data.features[i].geometry.coordinates[j],
								data.features[i].geometry.coordinates[j - 1],
								speed
							);
							result = temp_result;
						}
					}
				}
			}
		}

		break;
	}

	return result;
}

function GetNMEAData(geojson_data, altitude, speed, heading_enabled, reverse_enabled) {
	var coordinates_array = ParseGEOJSONIntoArray(geojson_data, speed, reverse_enabled);

	var nmea = "";

	for (var i = 0; i < coordinates_array.length; i++) {
		var nmea_gps = ConvertDecimalDegreesToNMEAGPS(coordinates_array[i][1], coordinates_array[i][0]);
		var hours = parseInt(i / 3600);
		var minutes = parseInt(i / 60 - hours * 60);
		var seconds = parseInt(i - hours * 3600 - minutes * 60);
		var line =
			"GPGGA," +
			hours.pad(2) +
			minutes.pad(2) +
			seconds.pad(2) +
			"," +
			nmea_gps[0] +
			"," +
			nmea_gps[1] +
			"," +
			nmea_gps[2] +
			"," +
			nmea_gps[3] +
			",5,00,0.0," +
			altitude +
			",M,0.0,M,,";
		var checksum = CalculateNMEAChecksum(line);
		nmea += "$" + line + "*" + checksum + "\n";

		if (true == heading_enabled) {
			var line = "HEHDT," + coordinates_array[i][2].toFixed(2) + ",T";
			var checksum = CalculateNMEAChecksum(line);
			nmea += "$" + line + "*" + checksum + "\n";
		}
	}

	return nmea;
}

async function SaveNMEALog() {
	UpdateDrawnItemsWithGlobalSettings();

	// Extract GeoJson from featureGroup
	var data = drawnItems.toGeoJSON();

	console.log(data);

	var altitude = $("#Altitude").val();
	var speed = $("#Speed").val();
	var heading_enabled = $("#HeadingEnabled").prop("checked");
	var reverse_enabled = $("#ReverseEnabled").prop("checked");
	//geojson object, altitude m, speed km/h
	var nmea_data = GetNMEAData(data, altitude, speed, heading_enabled, reverse_enabled);

	if (nmea_data != "") {
		var filename = GetTimestamp() + ".nmea";

		var response = await dialog.showSaveDialog({ defaultPath: filename });

		var local_filename = "";

		if (typeof response === "object") {
			if (typeof response.filePath === "string") {
				local_filename = response.filePath;
			}
		}

		if (local_filename !== "") {
			fs.writeFileSync(local_filename, nmea_data);
		}
	}
}

async function SaveGEOJSON() {
	UpdateDrawnItemsWithGlobalSettings();

	// Extract GeoJson from featureGroup
	var data = drawnItems.toGeoJSON();

	var filename = GetTimestamp() + ".geojson";

	var response = await dialog.showSaveDialog({ defaultPath: filename });

	var local_filename = "";

	if (typeof response === "object") {
		if (typeof response.filePath === "string") {
			local_filename = response.filePath;
		}
	}

	if (local_filename !== "") {
		fs.writeFileSync(local_filename, JSON.stringify(data)); // Stringify the GeoJson
	}
}

function UpdateDrawnItemsWithGlobalSettings() {
	var altitude = $("#Altitude").val();
	var speed = $("#Speed").val();
	var heading_enabled = $("#HeadingEnabled").prop("checked");
	var reverse_enabled = $("#ReverseEnabled").prop("checked");

	/* We have to convert the object to GeoJSON, then go back
	 * to our layer in order to update layer.feature.properties
	 */
	var temp_object = drawnItems.toGeoJSON();

	drawnItems.clearLayers();

	var geojsonLayer = L.geoJson(temp_object);

	geojsonLayer.eachLayer(function (layer) {
		drawnItems.addLayer(layer);
	});

	drawnItems.eachLayer(function (layer) {
		if (typeof layer.feature !== "undefined") {
			if (typeof layer.feature.properties === "undefined") {
				layer.feature.properties = {};
			}

			layer.feature.properties.Altitude = altitude;
			layer.feature.properties.Speed = speed;
			layer.feature.properties.HeadingEnabled = heading_enabled;
			layer.feature.properties.ReverseEnabled = reverse_enabled;
		}
	});
}

function UpdateGlobalSettingsFromDrawnItems() {
	drawnItems.eachLayer(function (layer) {
		if (typeof layer.feature.properties.Altitude !== "undefined") {
			$("#Altitude").val(layer.feature.properties.Altitude);
		}

		if (typeof layer.feature.properties.Speed !== "undefined") {
			$("#Speed").val(layer.feature.properties.Speed);
		}

		if (typeof layer.feature.properties.HeadingEnabled !== "undefined") {
			if (true == layer.feature.properties.HeadingEnabled) {
				$("#HeadingEnabled").prop("checked", true);
			} else {
				$("#HeadingEnabled").prop("checked", false);
			}
		}

		if (typeof layer.feature.properties.ReverseEnabled !== "undefined") {
			if (true == layer.feature.properties.ReverseEnabled) {
				$("#ReverseEnabled").prop("checked", true);
			} else {
				$("#ReverseEnabled").prop("checked", false);
			}
		}
	});
}

async function LoadGEOJSON() {
	var temp_object = null;

	var response = await dialog.showOpenDialog({
		filters: [
			{ name: "GeoJSON", extensions: ["geojson"] },
			{ name: "JSON", extensions: ["json"] },
			{ name: "All Files", extensions: ["*"] }
		]
	});

	var filename = "";

	if (typeof response === "object") {
		if (typeof response.filePaths === "object") {
			if (typeof response.filePaths[0] === "string") {
				filename = response.filePaths[0];
			}
		}
	}

	if (filename !== "") {
		if (fs.existsSync(filename)) {
			var data = fs.readFileSync(filename, "utf-8").toString();

			if (null != data && "" != data) {
				try {
					temp_object = JSON.parse(data);
				} catch (e) {
					temp_object = null;
				}
			}
		}

		if (null == temp_object) {
			DisplayWarning("Failed to open: " + filename);
		} else {
			drawnItems.clearLayers();

			var geojsonLayer = L.geoJson(temp_object);

			geojsonLayer.eachLayer(function (layer) {
				drawnItems.addLayer(layer);
			});

			UpdateGlobalSettingsFromDrawnItems();

			if (typeof drawnItems.getBounds === "function") {
				var bounds = drawnItems.getBounds();

				if (typeof bounds._southWest !== "undefined" && typeof bounds._northEast !== "undefined") {
					map.fitBounds(bounds);
				}
			}
		}
	}
}

var drawnItems;
var map;

window.onload = function () {
	var osmUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
	var osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors';
	var osm = L.tileLayer(osmUrl, { maxZoom: 18, attribution: osmAttrib });
	map = new L.Map("map", { center: new L.LatLng(0, 0), zoom: 2 });
	drawnItems = L.featureGroup().addTo(map);

	L.control
		.layers(
			{
				"Open Street Maps": osm.addTo(map),
				"Google Satellite": L.tileLayer("http://www.google.com/maps/vt?lyrs=s@189&gl=en&x={x}&y={y}&z={z}", {
					attribution: "google"
				}),
				"Google Hybrid": L.tileLayer("http://www.google.com/maps/vt?lyrs=y@189&gl=en&x={x}&y={y}&z={z}", {
					attribution: "google"
				}),
				"Google Road": L.tileLayer("http://www.google.com/maps/vt?lyrs=r@189&gl=en&x={x}&y={y}&z={z}", {
					attribution: "google"
				})
			},
			{},
			{ position: "topright", collapsed: true }
		)
		.addTo(map);

	map.addControl(
		new L.Control.Draw({
			edit: {
				featureGroup: drawnItems,
				poly: {
					allowIntersection: false
				}
			},
			draw: {
				marker: false,
				circle: false,
				circlemarker: false,
				rectangle: false,
				polygon: false
			}
		})
	);

	var runMarkerGroup = new L.featureGroup().addTo(map);

	map.on(L.Draw.Event.CREATED, function (event) {
		var layer = event.layer;

		drawnItems.clearLayers(); // Only allow one item
		drawnItems.addLayer(layer);
	});

	map.on(L.Draw.Event.EDITED, function (event) {});

	/* Add home button */
	L.easyButton({
		states: [
			{
				icon: "icon ion-home",
				title: "Fit view",
				onClick: function () {
					if (typeof drawnItems.getBounds === "function") {
						var bounds = drawnItems.getBounds();

						if (typeof bounds._southWest !== "undefined" && typeof bounds._northEast !== "undefined") {
							map.fitBounds(bounds);
						}
					}
				}
			}
		]
	}).addTo(map);
};
