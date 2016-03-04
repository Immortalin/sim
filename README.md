Purple Auto-assignment Simulator
---
### Introduction
PAS is a simulator for visualization of the log of the auto-assignment algorithm.
### Quick Start
- `git clone` the repository.
- Open `index.html` in Google Chrome.
- Drag a log file to the archive icon.
- Hit the play button!

### Format of the Log File
The log file is a JSON. A sample log is shown below. PAS currently assumes that the outmost array has already been sorted by timestamps.
```JSON
{
  "city": "Los Angeles",
  "records": [
    {
      "timestamp": 1457026460,
      "couriers": {
        "C1": {
          "location": {
            "lat": 34.063270, 
            "lng": -118.445280
          }
        },

        "C2": {
          "location": {
            "lat": 34.065902, 
            "lng": -118.373110
          }
        }
      },
      "orders": {
        "O1": {
          "location": {
            "lat": 34.014990,
            "lng": -118.461460
          }
        },

        "O2": {
          "location": {
            "lat": 33.959845,
            "lng": -118.291290
          }
        }
      }
    },

    {
      "timestamp": 1457026470,
      "couriers": {
        "C1": {
          "location": {
            "lat": 34.065270, 
            "lng": -118.445280
          }
        },

        "C2": {
          "location": {
            "lat": 34.065902, 
            "lng": -118.376110
          }
        }
      },
      "orders": {
        "O1": {
          "location": {
            "lat": 34.017990,
            "lng": -118.469460
          }
        },

        "O2": {
          "location": {
            "lat": 33.950845,
            "lng": -118.292290
          }
        }
      }
    },

    {
      "timestamp": 1457026480,
      "couriers": {
        "C1": {
          "location": {
            "lat": 34.068270, 
            "lng": -118.445280
          }
        },

        "C2": {
          "location": {
            "lat": 34.061902, 
            "lng": -118.374110
          }
        }
      },
      "orders": {
        "O1": {
          "location": {
            "lat": 34.010990,
            "lng": -118.463460
          }
        },

        "O2": {
          "location": {
            "lat": 33.957845,
            "lng": -118.295290
          }
        }
      }
    }
  ]
}
```
