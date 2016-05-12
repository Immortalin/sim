'use strict';

goog.require('goog.Promise');
goog.require('goog.dom');
goog.require('goog.ui.Component');
goog.require('goog.ui.Slider');
goog.require('goog.ui.ToggleButton');
goog.require('goog.ui.CustomButton');
goog.require('goog.ui.Css3ButtonRenderer');
goog.require('goog.style');
goog.require('goog.fs.FileReader');
goog.require('goog.events.FileDropHandler');
goog.require('goog.async.Deferred');

var app_state = {
  map: null, // a Google Map object.
  slider: null, // a Google Closure slider object.
  play: null, // a Google Closure toggle button.
  load: null, // a Google Closure FileDropHandler object.
  data: null, // the loaded log object.
  symbols: null, // the symbols on the map.
  polylines: null, // the polylines (arrows) on the map.
  speed: 100000, // the playback speed multiplier.
  interval_id: null, // the id returned by window.setInterval().
  current_record: null
};

// The entrance of the script.
function main() {
  app_init();
  // experiment();
}

// For testing, this function gets called after app_init() in
// the main function.
function experiment() {
  update_map_center_at('Shanghai');
}

// This function handles basic setup of the application.
function app_init() {

  // Init application state.
  var map = new google.maps.Map(document.getElementById("map"), {
    center: {lat: 34.0500, lng: -118.2500},
    zoom: 11
  });

  var slider = new goog.ui.Slider();
  slider.decorate(document.getElementById("slider"));

  var play = new goog.ui.ToggleButton();
  play.decorate(document.getElementById("play"));

  var load = new goog.events.FileDropHandler(document.getElementById("load"), true);

  var data = {};

  slider.addEventListener(goog.ui.Component.EventType.CHANGE, function() {
    // The behevior when the slider slides.
    var timestamp = app_state.slider.getValue();

    var record = get_record_by_timestamp(timestamp);
    app_state.current_record = record;
    update_markers_with_computed_record(record);
  });

  play.addEventListener(goog.ui.Component.EventType.ACTION, function(e) {
    // The behavior when the play button is toggled.
    if (e.target.isChecked()) {
      // Set animation frames.
      app_state.interval_id = setInterval(update_on_timeout, 1);
      goog.style.setStyle(document.getElementById('play'), 'background-image', 'url(\"assets/controls/pause.png\")');
    } else {
      clearInterval(app_state.interval_id);
      app_state.interval_id = null;
      goog.style.setStyle(document.getElementById('play'), 'background-image', 'url(\"assets/controls/play.png\")');
    }
  });

  load.addEventListener(goog.events.FileDropHandler.EventType.DROP, function(e) {
    var reader = new FileReader();
    reader.onload = function(e) {
      app_start_with_data(JSON.parse(e.target.result));
    };
    reader.readAsText(e.getBrowserEvent().dataTransfer.files[0]);
  });

  app_state.map = map;
  app_state.slider = slider;
  app_state.play = play;
  app_state.load = load;
  app_state.data = data;
  app_state.speed = 10;
  app_state.interval_id = null;
  app_state.symbols = {
    'couriers': {},
    'orders': {}
  };
  app_state.polylines = {};
}

// Initialize the application states and other stuff according
// to the data loaded.
function app_start_with_data(data) {
  app_state.data = data;
  update_map_center_at(data.city);

  // Assume the input array is sorted by timestamp.
  app_state.slider.setMinimum(data.records[0].timestamp);
  app_state.slider.setMaximum(data.records[data.records.length - 1].timestamp);
  app_state.slider.setValue(app_state.slider.getMinimum());
  app_state.slider.setStep(0.001);

  for (var key in app_state.symbols.couriers) {
    app_state.symbols.couriers[key].setMap(null);
    delete app_state.symbols.couriers[key];
  }

  for (var key in app_state.symbols.orders) {
    app_state.symbols.orders[key].setMap(null);
    delete app_state.symbols.orders[key];
  }

  for (var key in data.records[0].couriers) {
    app_state.symbols.couriers[key] = courier_symbol_new(key, data.records[0].couriers[key].location);
    // app_state.polylines[key] = courier_route_polyline_new(key, data.records[0]);
  }

  for (var key in data.records[0].orders) {
    app_state.symbols.orders[key] = order_symbol_new(key, data.records[0].orders[key].location);
  }

}

function courier_route_polyline_new(id, record) {
  var waypoints = [record.couriers[id].location];
  record.couriers[id].queue.map(function(order_id) {
    waypoints.push(record.orders[order_id].location);
  });

  var retval = new google.maps.Polyline({
    path: waypoints,
    icons: [{
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
      },
      offset: '100%'
    }],
    map: null,
    strokeColor: 'red'
  });

  return retval;
}

function courier_route_polyline_update(id, record) {
  var waypoints = [record.couriers[id].location];
  record.couriers[id].queue.map(function(order_id) {
    waypoints.push(record.orders[order_id].location);
  });

  app_state.polylines[id].setPath(waypoints);
}

function courier_route_polyline_show(id) {
  app_state.polylines[id].setMap(app_state.map);
}

function courier_route_polyline_hide(id) {
  app_state.polylines[id].setMap(null);
}

function update_map_center_at(city) {
  var geocoder = new google.maps.Geocoder();
  geocoder.geocode({address: city}, function(results, status) {
    app_state.map.setCenter(results[0].geometry.location);
  });
}

// Given a timestamp, either return the record of the exact time
// or interpolate a result from the real data.
function get_record_by_timestamp(timestamp) {
  var records = app_state.data.records;
  var min_t = records[0].timestamp;
  var max_t = records[records.length - 1].timestamp;

  if (timestamp < min_t || timestamp > max_t) {
    console.warn('Timestamp out of range');
    return null;
  }

  // If we have real record for that timestamp, just return the record.
  // Otherwise, find the one before and the one after, then interpolate them.
  var before = null;
  var after = null;
  for (var i = 0; i < records.length; i++) {
    if (records[i].timestamp === timestamp) {
      return deep_copy(records[i]);
    }

    if (before === null && records[i].timestamp > timestamp) {
      before = records[i - 1];
      after = records[i];
      break;
    }
  }

  var interp_percentage = (timestamp - before.timestamp) /
                          (after.timestamp - before.timestamp);

  var retval = recursive_interp(before, after, interp_percentage);
  console.log(before);
  console.log(after);
  console.log(retval);
  retval.timestamp = timestamp; // the timestamp in retval has been interpolated.
                                // Use the exact number instead.
  return retval;
}

function recursive_interp(before, after, interp_percentage) {
  if (typeof before === 'number') {
    return before + interp_percentage * (after - before);
  } else if (before instanceof Array) {
    var retval = [];
    for (var i in before) {
      retval.push(recursive_interp(before[i], after[i], interp_percentage));
    }
    return retval;
  } else if (typeof before === 'object') {

    var retval = {};
    for (var key in before) {
      retval[key] = recursive_interp(before[key], after[key], interp_percentage);
    }
    return retval;
  } else {
    return before;
  }
}

function update_markers_with_computed_record(record) {
  if (app_state.symbols === null) {
    return;
  }

  for (var key in record.couriers) {
    if (app_state.symbols.couriers[key]) {
      app_state.symbols.couriers[key].setPosition(record.couriers[key].location);
    } else {
      // Create a new symbol.
      app_state.symbols.couriers[key] = courier_symbol_new(key, record.couriers[key].location);
    }

    if (app_state.polylines[key]) {
      courier_route_polyline_update(key, record);
    } else {
      app_state.polylines[key] = courier_route_polyline_new(key, record);
    }
  }

  for (var key in app_state.symbols.couriers) {
    if (!record.couriers[key]) {
      app_state.symbols.couriers[key].setMap(null);
      delete app_state.symbols.couriers[key];
      app_state.polylines[key].setMap(null);
      delete app_state.polylines[key];
    }
  }

  for (var key in record.orders) {
    if (app_state.symbols.orders[key]) {
      app_state.symbols.orders[key].setPosition(record.orders[key].location);
    } else {
      // Create a new symbol.
      app_state.symbols.orders[key] = order_symbol_new(key, record.orders[key].location);
    }
  }

  for (var key in app_state.symbols.orders) {
    if (!record.orders[key]) {
      app_state.symbols.orders[key].setMap(null);
      delete app_state.symbols.orders[key];
    }
  }
}

function courier_symbol_new(id, position) {

  var retval = new google.maps.Marker({
    courier_id: id,
    info_window: null,
    position: position,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6
    },
    draggable: false,
    map: app_state.map
  });

  retval.info_window = new google.maps.InfoWindow({
    courier_id: id,
    content: "",
    opened: false
  });

  retval.info_window.addListener('position_changed', function() {
    var domstring = '<table class="table table-hover">' +
      '<caption>' + retval.courier_id + '</caption>' +
      '<tbody>' + 
      '<tr><td>' + 'Latitude' + '</td><td>' + retval.position.lat().toFixed(3) + '</td></tr>' + 
      '<tr><td>' + 'Longitude' + '</td><td>' + retval.position.lng().toFixed(3) + '</td></tr>' + 
      '</tbody>'
      '</table>';

    retval.info_window.setContent(domstring);
  });

  retval.info_window.addListener('closeclick', function() {
    retval.info_window.close();
    retval.info_window.opened = false;
  });

  retval.addListener('click', function() {
    if (retval.info_window.opened) {
      retval.info_window.close();
      retval.info_window.opened = false;
      courier_route_polyline_hide(id);
    } else {
      retval.info_window.open(app_state.map, retval);
      retval.info_window.opened = true;
      courier_route_polyline_show(id);
    }
  });
  return retval;
}

function order_symbol_new(id, position) {

  var retval = new google.maps.Marker({
    order_id: id,
    info_window: null,
    position: position,
    icon: {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      scale: 4
    },
    draggable: false,
    map: app_state.map
  });

  retval.info_window = new google.maps.InfoWindow({
    order_id: id,
    content: "",
    opened: false
  });

  retval.info_window.addListener('position_changed', function() {
    var domstring = '<table class="table table-hover">' +
      '<caption>' + retval.order_id + '</caption>' +
      '<tbody>' + 
      '<tr><td>' + 'Latitude' + '</td><td>' + retval.position.lat().toFixed(3) + '</td></tr>' + 
      '<tr><td>' + 'Longitude' + '</td><td>' + retval.position.lng().toFixed(3) + '</td></tr>' + 
      '</tbody>'
      '</table>';

    retval.info_window.setContent(domstring);
  });

  retval.info_window.addListener('closeclick', function() {
    retval.info_window.close();
    retval.info_window.opened = false;
  });

  retval.addListener('click', function() {
    if (retval.info_window.opened) {
      retval.info_window.close();
      retval.info_window.opened = false;
    } else {
      retval.info_window.open(app_state.map, retval);
      retval.info_window.opened = true;
    }
  });
  return retval;
}

// Handle frame update.
function update_on_timeout() {
  var slider = app_state.slider;
  if (app_state.play.isChecked()) {
    if (slider.getValue() < slider.getMaximum()) {
      slider.setValue(slider.getValue() + 0.0001 * (slider.getMaximum() - slider.getMinimum()));
    } else {
      app_state.play.setChecked(false);
      app_state.play.dispatchEvent(goog.ui.Component.EventType.ACTION);
    }
  }
}

function deep_copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}
