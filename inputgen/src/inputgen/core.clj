(ns inputgen.core)

(require '[clojure.java.jdbc :as jdbc]
         '[clojure.string :as str]
         '[clj-time.core :as t]
         '[clj-time.coerce :as tc]
         '[clj-time.local :as tl]
         '[clojure.data.json :as json]
)

(def db-host "prod-db.cqxql2suz5ru.us-west-2.rds.amazonaws.com")
(def db-name "ebdb")
(def db-port "3306")
(def db-user "wotaoyin")
(def db-password "JNHDB837666Hhbdh7")

(def mysql-db {
    :classname "com.mysql.jdbc.Driver"
    :subprotocol "mysql"
    :subname (str "//" db-host ":" db-port "/" db-name)
    :user db-user
    :password db-password
})

(defn zone-string->zone-list
      [zone-string]
      (map read-string (str/split zone-string #","))      
)

(defn zip-code-string->zip-code-list
  [zip-code-string]
  (str/split zip-code-string #","))

(defn query-orders-between
      [start end]
      (jdbc/query 
        mysql-db
        ["SELECT id, gas_type, gallons, target_time_start, target_time_end, address_zip, lat, lng FROM orders WHERE target_time_start >= ? AND target_time_start < ?" start end])
)

(defn query-zones
  []
  (jdbc/query
    mysql-db
    ["SELECT id, zip_codes FROM zones"]))

(defn zone-result-entry->zone-map-entry
  [zone-result-entry]
  (let [zips (zip-code-string->zip-code-list (:zip_codes zone-result-entry))]
    (reduce
      (fn [coll elem]
        (assoc coll elem (:id zone-result-entry)))
      {}
      zips)))

(defn make-zone-lookup-map-helper
  [coll elem]
  (into coll (zone-result-entry->zone-map-entry elem)))

(defn make-zone-lookup-map
  []
  (let [query-result (query-zones)]
    (reduce make-zone-lookup-map-helper '{} query-result)))

(def zone-lookup-map (make-zone-lookup-map))

(defn db-order-entry->order-appear-event
  [entry]
  {:timestamp (* 1000 (:target_time_start entry))
   :type "order_appear"
   :oid (:id entry)
   :order {:oid (:id entry)
           :lat (:lat entry)
           :lng (:lng entry)
           :courier_id ""
           :courier_pos -1
           :zone (get zone-lookup-map (:address_zip entry))
           :gas_type (:gas_type entry)
           :gallons (:gallons entry)
           :target_time_start (* 1000 (:target_time_start entry))
           :target_time_end (* 1000 (:target_time_end entry))
           :status "unassigned"
           :status_times {}}})

(defn la-order-filter
  [order]
  (and 
    (> (:lat order) 33) 
    (< (:lat order) 35)
    (> (:lng order) -119)
    (< (:lng order) -117)))

(defn ymd->long-in-second
  [year month day]
  (/ 
    (tc/to-long 
      (t/from-time-zone 
        (t/date-time year month day) 
        (t/time-zone-for-id "US/Pacific")))
    1000))

(defn order-events-on
  [year month day]
  (let [start (ymd->long-in-second year month day)
        end (+ start 86400)]
    (->>
      (query-orders-between start end)
      (filter la-order-filter)
      (map db-order-entry->order-appear-event))))

(defn query-couriers
  []
  (jdbc/query 
    mysql-db
    ["SELECT id, zones, lat, lng FROM couriers"]))

(defn la-courier-filter
  [courier]
  (and 
    (> (:lat courier) 33) 
    (< (:lat courier) 35)
    (> (:lng courier) -119)
    (< (:lng courier) -117)))

(defn db-courier-entry->courier-appear-event
  [timestamp entry]
  {:timestamp (* 1000 timestamp)
   :type "courier_appear"
   :cid (:id entry)
   :courier {:cid (:id entry)
             :lat (:lat entry)
             :lng (:lng entry)
             :connected true
             :zones (map read-string (str/split (:zones entry) #","))
             :queue []
             :latv 0
             :lngv 0
             :last_update 1}})

(defn courier-appear-events-now-as-init-conf
  [year month day]
  (->>
    (query-couriers)
    (filter la-courier-filter)
    (map (partial db-courier-entry->courier-appear-event (ymd->long-in-second year month day)))))

(defn make-events-on
  [year month day]
  (->>
    (into
      (order-events-on year month day)
      (courier-appear-events-now-as-init-conf year month day))
    (sort-by :timestamp)))

(defn make-json-input
  [year month day]
  (json/write-str
    {:real_time true
     :events (make-events-on year month day)}))

(defn -main
  "I don't do a whole lot ... yet."
  [& args]
  (spit 
    "input.json" 
    (make-json-input 
      (read-string (first args))
      (read-string (second args)) 
      (read-string (nth args 2)))))
