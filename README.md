# Uber Code Challenge by Thomas Hunter

## Requirements

This project makes heavy use of redis. You'll need to install the service to get it working.

## Installation

```
npm install
```

## Sample Data Server

This emits sample data following the criteria specified in the "Dispatch Backend" document.

This happens over a TCP socket, specified as the only argument to the script.

```
./emitter.js 2900
```


## Subscription Service

This is the tool which consumes the data.

It also provides an HTTP server for getting data.

```
./service.js 2900 8000
```


### HTTP Endpoints

The service provides three HTTP endpoints for querying information with.


#### Count Trips within Geo-Rect

This will count all trips which happened within the specified Geo-Rect for the entire known history.

The two points can be any two opposing corners of a rectangle.

	GET /trip-count?p1_lat={latitude}&p1_lon={longitude}&p2_lat={latitude}&p2_lon={longitude}

	{
	  "trip_count": 200
	}


#### Count Trip Start/Stops and Sum Fares within Geo-Rect

This will count all trips which have started and stopped within the specified Geo-Rect and a sum of their fares for the entire known history.

The two points can be any two opposing corners of a rectangle.

	GET /fare-sum?p1_lat={latitude}&p1_lon={longitude}&p2_lat={latitude}&p2_lon={longitude}

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


## Benchmark Information

On my Quad 2 Ghz Debian machine, with ~300k rows of event data, the SQL queries take between 10ms and 20ms to execute.


## Validating Code

```
time curl http://localhost:8000/trip-count?p1_lat=37.777058&p1_lng=-122.401729&p2_lat=37.763998&p2_lng=-122.380357
time curl http://localhost:8000/fare-sum?p1_lat=37.777058&p1_lng=-122.401729&p2_lat=37.763998&p2_lng=-122.380357
time curl http://localhost:8000/snapshot-count?timestamp=2014-03-16T18:30:00Z
```
