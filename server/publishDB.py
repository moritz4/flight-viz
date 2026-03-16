# Script to publish last 24 hours of data from the database as a JSON file that can be consumed by the frontend
# Write the JSON file to GCP bucket

import sqlite3
import json
from google.cloud import storage

import time


def upload_blob(bucket_name, source_file_name, destination_blob_name):
    """Uploads a file to the bucket."""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    # Remove generation_match_precondition to allow overwriting
    blob.upload_from_filename(source_file_name)

    print(
        f"File {source_file_name} uploaded to {destination_blob_name}."
    )

# Read from db
conn = sqlite3.connect('flights.db')
cursor = conn.cursor()
cursor.execute("""
-- Calculate 
-- change in heading altitude and speed
-- rows/positions for each plane
WITH UK_flights AS (
	SELECT 	
		p.*,
		
		-- Change in heading, altitude and speed (in percent)
		ABS(((LAG(heading) OVER (PARTITION BY id ORDER BY time) - heading) / CAST(heading AS REAL))) AS change_heading,
		ABS(((LAG(alt) OVER (PARTITION BY id ORDER BY time) - alt) / CAST(alt AS REAL))) AS change_alt,
		ABS(((LAG(speed) OVER (PARTITION BY id ORDER BY time) - speed) / CAST(speed AS REAL))) AS change_speed
		
		FROM positions AS p
		
		WHERE
			-- within last 24 h
			time >= strftime('%s', 'now') - 24*60*60 

			-- over the UK
			AND lon > -24 AND lon < 19 AND lat > 36 AND lat < 66 AND speed > 50
			ORDER BY id
)

-- 
SELECT id, lat, lon, heading, alt, speed, time, origin, dest
FROM (
SELECT id, lat, lon, heading, alt, speed, time, origin, dest, COUNT(*) OVER (PARTITION BY id) AS positions_count
FROM UK_flights
WHERE change_heading IS NULL OR change_heading > 0.01 OR change_alt > 0.01 OR change_speed > 0.05
)
WHERE positions_count > 3
""")
rows = cursor.fetchall()

# We want a JSON file with the id as key and values are dest origin and array of positions (time, lat, lon, alt)
data = {}
for row in rows:
    id = row[0]
    lat = row[1]
    lon = row[2]
    heading = row[3]
    alt = row[4]
    speed = row[5]
    time = row[6]
    origin = row[7]
    dest = row[8]

    if id not in data:
        data[id] = {
            'origin': origin,
            'dest': dest,
            'positions': []
        }
    
    data[id]['positions'].append([time, lat, lon, alt])

# Write JSON directly to file
with open('flights.json', 'w', encoding='utf-8') as f:
    json.dump(data, f)

# Upload to GCP bucket
upload_blob('flight-vis', 'flights.json', 'flights.json')
