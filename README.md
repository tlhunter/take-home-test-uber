# Uber Coding Challenge: Geotemporal Systems by Thomas Hunter II

## Requirements

This project requires that PostgreSQL be installed.


## Installation

Before using this project, you'll need to have the Node Modules installed. Run the following:

```
npm install
```

Once that is done, you'll need to configure the project to connect to your Postgres database:

```
export PGSQL_CONN="postgres://USER:PASS@HOST/DB"
```


## Sample Data Server

This emits sample data following the criteria outlined in the "Dispatch Backend" document.
It transmits data over a TCP socket, specified as the only argument to the script.

It's not technically part of the project, but the project would be quite boring without it ;).
If you were to actually examine the coordinates, you'd see a lot of drunk Uber drivers changing directions erratically and driving in the bay.

```
./emitter.js 2900
```


## Subscription Service

This is the tool which consumes the data.
It also provides an HTTP server for getting data.

Incoming data is immediately put into a PgSQL table.
Two connections are made, one for writes and one for reads, to maximize performance.

```
./service.js 2900 8000
```


### HTTP Endpoints

The service provides three HTTP endpoints for answering the questions asked in the "Dispatch Backend" document.


#### Count Trips within Geo-Rect

This will count all trips which happened within the specified Geo-Rect for the entire known history.

The two points can be any two opposing corners of a rectangle.

	GET /trip-count?p1_lat={latitude1}&p1_lon={longitude1}&p2_lat={latitude2}&p2_lon={longitude2}

	{
	  "trip_count": 200
	}


#### Count Trip Start/Stops and Sum Fares within Geo-Rect

This will count all trips which have started and stopped within the specified Geo-Rect and a sum of their fares for the entire known history.

The two points can be any two opposing corners of a rectangle.

	GET /fare-sum?p1_lat={latitude1}&p1_lon={longitude1}&p2_lat={latitude2}&p2_lon={longitude2}

	{
	  "trip_count": 200,
	  "fare_sum": 100.00
	}


#### Count Concurrent Trips at Specific Time

This will count all distinct trips which were occuring at the specified time.

The timestamp needs to be formatted as ISO 8601.

	GET /snapshot-count?timestamp=2014-03-15T04:02:08Z

	{
	  "trip_count": 300
	}


## Validating the Application

These three commands can be executed to see how quickly the server replies with data.

The third command will require tweaking the timestamp and providing timezone data.

```
time curl http://localhost:8000/trip-count?p1_lat=37.777058&p1_lng=-122.401729&p2_lat=37.763998&p2_lng=-122.380357
time curl http://localhost:8000/fare-sum?p1_lat=37.777058&p1_lng=-122.401729&p2_lat=37.763998&p2_lng=-122.380357
time curl http://localhost:8000/snapshot-count?timestamp=2014-03-16T18:30:00Z
```


## Benchmark Information

On my Quad 2Ghz/8GB/RAM/SSD Debian laptop, with ~300k rows of event data, the SQL queries usually take between 10ms and 20ms to execute.
