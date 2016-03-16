const fs = require('fs');

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
      log_state(couriers, orders, log);
      timestamp = event.timestamp;
    }

    var type = event.type;

    switch (type) {
      case 'courier_appear': {
        var courier = event.courier;
        var cid = evnet.cid;
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

function log_state(couriers, orders, log) {
  // TODO: implement me.
}

function order_appear(couriers, orders, events) {
  // TODO: implement me.
}

main(process.argv);
