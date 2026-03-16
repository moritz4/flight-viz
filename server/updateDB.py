# Script to update database with planes
# This script should be run periodically (e.g. every minute through a cron job)

import requests
import sqlite3

# UK airports. We are only interested in flights to these airports
airports = [
  "LHR",
  "LGW",
  "MAN",
  "STN",
  "LTN",
  "EDI",
  "BHX",
  "BRS",
  "GLA",
  "BFS",
  "NCL",
  "LPL",
  "LBA",
  "EMA",
  "LCY",
  "SEN",
]

url = "https://data-cloud.flightradar24.com/zones/fcgi/feed.js"

# open database
conn = sqlite3.connect('flights.db')

# create table if not exists
conn.execute("CREATE TABLE IF NOT EXISTS positions (id TEXT, lat REAL, lon REAL, heading INTEGER, alt INTEGER, speed INTEGER, time INTEGER, origin TEXT, dest TEXT);")

# Loop through airports
for airport in airports:
    params = {'to': airport, 'estimated': 1, 'air': 1}
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15'}
    
    response = requests.get(url, params=params, headers=headers)
    data = response.json()

    # remove the full_count and version keys
    data.pop('full_count', None)
    data.pop('version', None)

    # write to db
    for key, value in data.items():
      id = key
      lat = value[1]
      lon = value[2]
      heading = value[3]
      alt = value[4]
      speed = value[5]
      time = value[10]
      origin = value[11]
      dest = value[12]

      conn.execute("INSERT INTO positions (id, lat, lon, heading, alt, speed, time, origin, dest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (id, lat, lon, heading, alt, speed, time, origin, dest))

# Delete any entries with time older than 1 month
conn.execute("DELETE FROM positions WHERE time < strftime('%s', 'now') - 30*24*60*60")

# commit and close database
conn.commit()
conn.close()