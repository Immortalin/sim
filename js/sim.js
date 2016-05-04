'use strict';

// Require node packages.
const fs = require('fs');
const cp = require('child_process');
const df = require('dateformat');
var sim_start_time = (new Date()).getTime();


/** In-program structures
  * courier:
  *   cid: string
  *   lat: double
  *   lng: double
  *   last_update: double - the time of last update of the structure
  *   connected: bool
  *   zones: [int]
  *   queue: [oid]
  *   latv: double - velocity vector
  *   lngv: double - velocity vector
  *   etf: double - estimate time to finish the courier's current task
  *
  * order:
  *   oid: string
  *   lat: double
  *   lng: double
  *   courier_id: cid
  *   courier_pos: int
  *   zone: int
  *   gas_type: string
  *   gallons: int
  *   target_time_start: int
  *   target_time_end: int
  *   status: string
  *   status_times: {string: int}
  *
  * event:
  *   timestamp: int
  *   type: string
  *   cid: cid
  *   oid: oid
  *   courier: courier
  *   order: order
  */

function main(argv) {
  if (argv.length < 3) {
    throw new Error('Wrong number of arguments');
  }
  var filename = argv[2];
  cp.execFileSync('javac', ['-cp', '../simcore:../simcore/json-simple-1.1.1.jar:../simcore/jackson-all-1.9.9.jar', '../simcore/PurpleOpt.java', '../simcore/PurpleOptAdapter.java'], {});
  // console.log(fs.readFileSync(filename, 'utf-8'));
  var input = JSON.parse(fs.readFileSync(filename, 'utf-8'));
  var events = input.events;

  // For real time simulation, we don't need to
  // modify the starting time of the simulation.
  if (input.real_time === true) {
    sim_start_time = 0;
  }

  simulate(events);
}

// The input is assumed to be sorted by timestamp.
function simulate(events) {
  if (!events instanceof Array) {
    throw new Error('Input JSON must be an array.');
  }

  var couriers = {};
  var orders = {};
  var log = [];

  var timestamp = -1;
  while (events.length > 0) {
    
    // Pop the first event out of the event queue.
    var event = events.splice(0, 1)[0];

    // Avoid repetitive logging.
    if (event.timestamp > timestamp) {
      // Avoid logging in the first iteration.
      if (timestamp >= 0) {
        log_state(timestamp, couriers, orders, log);
      }

      // Update timestamp after logging.
      timestamp = event.timestamp;
    }

    var type = event.type;

    switch (type) {
      case 'courier_appear': {
        console.log('courier_appear at timestamp' + timestamp);

        // Add the new courier to the courier array.
        var courier = event.courier;
        var cid = event.cid;
        couriers[cid] = courier;

        // Call auto-assignment to react to the status change.
        auto_assign_call(couriers, orders, events, timestamp);
        break;
      }

      case 'courier_start_serving': {
        console.log('courier_appear at timestamp' + timestamp);
        break;
      }

      case 'courier_end_serving': {
        console.log('courier_end_serving at timestamp' + timestamp);
        console.log('event at timestamp' + event.timestamp);

        // The courier should be updated to the order's location.
        // The order should be labeled completed.
        var courier = couriers[event.cid];
        var order = orders[event.oid];
        courier.lat = order.lat;
        courier.lng = order.lng;
        courier.last_update = timestamp;
        order.status = 'completed';

        // Call auto-assignment because we may have an extra free courier.
        auto_assign_call(couriers, orders, events, timestamp);
        break;
      }

      case 'order_appear': {
        console.log('order_appear at timestamp' + timestamp);

        // Add the new order to the orders array.
        var order = event.order;
        var oid = event.oid;
        orders[oid] = order;

        // Call auto-assignment because we have a new order to optimize.
        auto_assign_call(couriers, orders, events, timestamp);
        break;
      }
    }
  }

  // Log the last event if it exists.
  if (timestamp >= 0) {
    log_state(timestamp, couriers, orders, log);
  }

  // Write the log to file system.
  fs.writeFileSync('log.json', JSON.stringify({
    city: "los angeles",
    records: log
  }));
}

function log_state(timestamp, couriers, orders, log) {
  // console.log(JSON.stringify(couriers));
  console.log("loggging");
  var log_entry = {
    timestamp: timestamp,
    couriers: {},
    orders: {}
  };

  for (var key in couriers) {
    var courier = couriers[key];
    log_entry.couriers[key] = {
      location: {
        lat: courier.lat,
        lng: courier.lng
      },
      queue: courier.queue
    };
  }

  for (var key in orders) {
    var order = orders[key];
    log_entry.orders[key] = {
      location: {
        lat: order.lat,
        lng: order.lng
      },
      courier: order.courier_id
    };
  }

  log.push(JSON.parse(JSON.stringify(log_entry)));
}

// The function that does the heavy-lifting - generate
// input to auto-assignment, get response and update
// courier and order status.
function auto_assign_call(couriers, orders, events, timestamp) {
  var couriers_in = {};
  var orders_in = {};

  for (var key in couriers) {
    var courier = couriers[key];
    var courier_in = {
      id: courier.cid,
      lat: courier.lat,
      lng: courier.lng,
      connected: courier.connected,
      zones: courier.zones
    }

    couriers_in[key] = courier_in;
  }

  for (var key in orders) {
    var order = orders[key];
    var order_in = {
      lat: order.lat,
      lng: order.lng,
      id: order.oid,
      courier_id: order.courier_id,
      zone: order.zone,
      gas_type: order.gas_type,
      gallons: order.gallons,
      target_time_start: df(new Date(sim_start_time + order.target_time_start), 'yyyy-mm-dd HH:MM:ss') + ' PDT',
      target_time_end: df(new Date(sim_start_time + order.target_time_end), 'yyyy-mm-dd HH:MM:ss') + ' PDT',
      // target_time_start: sim_start_time + order.target_time_start,
      // target_time_end: sim_start_time + order.target_time_end,
      status: order.status,
      status_times: order.status_times,
    }

    orders_in[key] = order_in;
  }

  var input = {
    // current_time: sim_start_time + timestamp,
    current_time: df(new Date(sim_start_time + timestamp), 'yyyy-mm-dd HH:MM:ss') + ' PDT',
    orders: orders_in,
    couriers: couriers_in,
    human_time_format: true,
    verbose_output: true,
    simulation_mode: true
  }

  var aa_result = auto_assignment_call(input);
  console.log(JSON.stringify(aa_result));
  // process the output. adjust simulator states as needed.
  for (var key in aa_result) {
    if (aa_result[key].new_assignment === true) {
      var order = orders[key]; // the order object in this system.
      var result = aa_result[key]; // the order object returned by auto-assignment.
      couriers[result.courier_id].queue.push(key); // throw orders to queues and sorting will happen afterwards.
      order.courier_id = result.courier_id;
      order.courier_pos = result.courier_pos;
      order.status = 'assigned';
      order.etf = (new Date(df(new Date(), "dddd mmmm d yyyy ") + result.etf)).getTime();
      console.log((new Date(df(new Date(), "dddd mmmm d yyyy ") + result.etf)).getTime());
      console.log(sim_start_time);

      // Generate event for the end of serving of this order.
      var event = {
        timestamp: (new Date(df(new Date(), "dddd mmmm d yyyy ") + result.etf)).getTime() - sim_start_time,
        type: 'courier_end_serving',
        cid: result.courier_id,
        oid: key,
        courier: couriers[result.courier_id],
        order: orders[key]
      };

      // Insert the event to appropriate index of the array.
      var i = 0;
      for (; i < events.length; i++) {
        if (events[i].timestamp > event.timestamp) {
          break;
        }
      }
      events.splice(i, 0, event);
    }
  }

  for (var key in couriers) {
    // For each courier, remove completed orders on its queue.
    var courier = couriers[key];
    var queue = couriers[key].queue;
    for (var i = 0; i < queue.length; i++) {
      if (orders[queue[i]].status === 'completed') {
        console.log(queue[i]);
        queue.splice(i, 1);
      }
    }

    // Sort the queue by courier_pos as promised before.
    queue.sort(function(a, b) {
      return orders[a].courier_pos - orders[b].courier_pos;
    });

    // Update courier location.
    courier.lat = courier.lat + (timestamp - courier.last_update) * courier.latv;
    courier.lng = courier.lng + (timestamp - courier.last_update) * courier.lngv;
    courier.last_update = timestamp;

    // Update courier moving direction and speed.
    if (queue.length > 0) {
      orders[queue[0]].status = 'enroute';
      couriers[key].etf = orders[queue[0]].etf;
      couriers[key].latv = (orders[queue[0]].lat - couriers[key].lat) / (couriers[key].etf - sim_start_time - timestamp);
      couriers[key].lngv = (orders[queue[0]].lng - couriers[key].lng) / (couriers[key].etf - sim_start_time - timestamp);
    } else {
      couriers[key].latv = 0;
      couriers[key].lngv = 0;
    }
  }
}

function auto_assignment_call(input) {
  var opt = {
    input: JSON.stringify(input)
  };
  console.log(JSON.stringify(input));
  return JSON.parse(cp.execFileSync('java', ['-cp', '../simcore:../simcore/json-simple-1.1.1.jar:../simcore/jackson-all-1.9.9.jar', 'PurpleOptAdapter'], opt).toString());
}

main(process.argv);
