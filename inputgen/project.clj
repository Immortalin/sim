(defproject inputgen "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.7.0"]
                 [org.clojure/java.jdbc "0.4.2"]
                 [org.clojure/data.json "0.2.6"]
                 [mysql/mysql-connector-java "5.1.25"]
                 [clj-time "0.11.0"]]
  :main ^:skip-aot inputgen.core
  :target-path "target/%s"
  :profiles {:uberjar {:aot :all}})
