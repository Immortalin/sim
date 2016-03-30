const fs = require('fs');
const cp = require('child_process');
/** courier:
  *   cid: string
  *   lat: double
  *   lng: double
  *   connected: bool
  *   zones: [int]
  *   queue: [oid]
  *
  * order:
  *   oid: string
  *   lat: double
  *   lng: double
  *   courier_id: cid
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
  // console.log(fs.readFileSync(filename, 'utf-8'));
  var events = JSON.parse(fs.readFileSync(filename, 'utf-8'));
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
    var event = events.splice(0, 1)[0];

    if (event.timestamp > timestamp) {
      if (timestamp >= 0) {
        log_state(timestamp, couriers, orders, log);
      }
      timestamp = event.timestamp;
    }

    var type = event.type;

    switch (type) {
      case 'courier_appear': {
        var courier = event.courier;
        var cid = event.cid;
        couriers[cid] = courier;
        auto_assign_call(couriers, orders, events);
        break;
      }

      case 'courier_start_serving': {
        break;
      }

      case 'courier_end_serving': {
        break;
      }

      case 'order_appear': {
        var order = event.order;
        var oid = event.oid;
        orders[oid] = order;
        auto_assign_call(couriers, orders, events);
        break;
      }
    }
  }
}

function log_state(timestamp, couriers, orders, log) {
  var log_entry = {
    timestamp: timestamp,
    couriers: {},
    orders: {}
  };

  for (var key in couriers) {
    var courier = couriers[key];
    log_entry.couriers['key'] = {
      location: {
        lat: courier.lat;
        lng: courier.lng;
      },
      queue: courier.queue;
    };
  }

  for (var key in orders) {
    var order = orders[key];
    log_entry.orders['key'] = {
      location: {
        lat: order.lat,
        lng: order.lng
      },
      courier: order.courier_id
    };
  }

  log.push(log_entry);
}

function auto_assign_call(couriers, orders, events) {
  var couriers_in = {};
  var orders_in = {};

  for (var key in couriers) {
    var courier = couriers[key];
    var courier_in = {
      lat: courier.lat,
      lng: courier.lng,
      connected: courier.connected,
      last_ping: 0,
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
      target_time_start: order.target_time_start,
      target_time_end: order.target_time_end,
      status: order.status,
      status_times: order.status_times,
    }

    orders_in[key] = order_in;
  }

  var input = {
    orders: orders_in,
    couriers: couriers_in,
    human_time_format: false,
    verbose_output: true
  }

  var aa_result = auto_assignment_call(input);
  // TODO: process the output. adjust simulator states as needed.
}

function auto_assignment_call(input) {
  var opt = {
    input: JSON.stringify(input)
  };

  return JSON.parse(cp.execFileSync('java', ['-jar', 'aa.jar'], opt).toString());
}

main(process.argv);
