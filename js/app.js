'use strict'

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
  speed: 10, // the playback speed multiplier.
  interval_id: null // the id returned by window.setInterval().
};

// The entrance of the script.
function main() {
  app_init();
  experiment();
}

function experiment() {
  update_map_center_at('Shanghai');
}

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
    console.log(slider.getValue());

    var record = get_record_by_timestamp(timestamp);
    update_markers_with_computed_record(record);
    console.log(record);
  });

  play.addEventListener(goog.ui.Component.EventType.ACTION, function(e) {
    // The behavior when the play button is toggled.
    console.log(e.target.isChecked());
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
}

function app_start_with_data(data) {
  console.log(data);
  app_state.data = data;
  update_map_center_at(data.city);

  // Assume the input array is sorted by timestamp.
  app_state.slider.setMinimum(data.records[0].timestamp);
  app_state.slider.setMaximum(data.records[data.records.length - 1].timestamp);
  app_state.slider.setValue(app_state.slider.getMinimum());
  app_state.slider.setStep(0.001);

  app_state.symbols = {
    'couriers': {},
    'orders': {}
  };

  for (var key in data.records[0].couriers) {
    app_state.symbols.couriers[key] = new google.maps.Marker({
      position: data.records[0].couriers[key].location,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6
      },
      draggable: false,
      map: app_state.map
    });
  }

  for (var key in data.records[0].orders) {
    app_state.symbols.orders[key] = new google.maps.Marker({
      position: data.records[0].orders[key].location,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6
      },
      draggable: false,
      map: app_state.map
    });
  }

  console.log(app_state);
}

function update_map_center_at(city) {
  var geocoder = new google.maps.Geocoder();
  geocoder.geocode({address: city}, function(results, status) {
    app_state.map.setCenter(results[0].geometry.location);
  });
}

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
  retval.timestamp = timestamp; // the timestamp in retval has been interpolated.
                                // Use the exact number instead.
  return retval;
}

function recursive_interp(before, after, interp_percentage) {
  if (typeof before === 'number') {
    return before + interp_percentage * (after - before);
  } else if (typeof before === 'array') {
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
    return;
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
      app_state.symbols.couriers[key] = new google.maps.Marker({
        position: record.couriers[key].location,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6
        },
        draggable: false,
        map: app_state.map
      });
    }
  }

  for (var key in record.orders) {
    if (app_state.symbols.orders[key]) {
      app_state.symbols.orders[key].setPosition(record.orders[key].location);
    } else {
      // Create a new symbol.
      app_state.symbols.orders[key] = new google.maps.Marker({
        position: record.orders[key].location,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6
        },
        draggable: false,
        map: app_state.map
      });
    }
  }
}

function update_on_timeout() {
  var slider = app_state.slider;
  if (slider.getValue() < slider.getMaximum()) {
    slider.setValue(slider.getValue() + app_state.speed * 0.001);
  }
}

function deep_copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}
