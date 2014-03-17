#!/usr/bin/env node

var net = require('net');
var async = require('async');
var pg = require('pg').native;
var express = require('express');
var app = express();

var pg_conn_string = "postgres://centric:EKG2Wk_rTtBPT54p@127.0.0.1/centric";
var pg_write = new pg.Client(pg_conn_string); // PG connection
var pg_read = new pg.Client(pg_conn_string); // PG connection

var tcp_port = process.argv[2];
var http_port = process.argv[3];

async.waterfall([
  // Step 1: Establish PgSQL connections
  function(callback) {
	console.log("Connecting to PgSQL for Inserts...");
	pg_write.connect(function(err) {
	  pg_write.query("TRUNCATE events");
	  callback(err);
	});
  },

  function(callback) {
	console.log("Connecting to PgSQL for Reads...");
	pg_read.connect(function(err) {
	  callback(err);
	});
  },

  // Step 2: Establish connection to Uber Emitter
  function(callback) {
	console.log("Connecting to Uber Car Position Emitter...");
	var uber_client = net.connect({port: tcp_port}, callback);

	uber_client.on('data', function(data) {
	  var raw = data.toString();
	  var split = raw.split("\r\n");
	  split.forEach(function(event) {
		if (!event) return; // The last item is an empty string due to the trailing \r\n emitted from the emitter
		var obj = JSON.parse(event);
		pg_write.query("INSERT INTO events (event, tripId, lat, lng, fare) VALUES ($1, $2, $3, $4, $5);", [
		  obj.event,
		  obj.tripId,
		  obj.lat,
		  obj.lng,
		  obj.fare || null
		]);
	  });
	});

	uber_client.on('end', function() {
	  console.log("No longer connected to Uber Emitter.");
	});
  },

  // Step 3: Listen for HTTP Requests
  function(callback) {
	console.log("Listening for HTTP Requests...");
	app.listen(http_port, callback);
  }
], function(err, results) {
  if (err) {
	console.log("There was an error with the waterfall");
	console.log(err);
	throw err;
  }
  console.log("Done.");
});

app.get('/', function(req, res){
  res.send([
	'/trip-count',
	'/fare-sum',
	'/snapshot-count'
  ]);
});

// GET /trip-count?p1_lat={latitude1}&p1_lng={longitude1}&p2_lat={latitude2}&p2_lng={longitude2}
app.get('/trip-count', function(req, res) {
  if (!req.query.p1_lat || !req.query.p1_lng || !req.query.p2_lat || !req.query.p2_lng) {
	res.status(400).send("invalid query parameters");
	return;
  }

  var lat_min = Math.min(req.query.p1_lat, req.query.p2_lat);
  var lat_max = Math.max(req.query.p1_lat, req.query.p2_lat);
  var lng_min = Math.min(req.query.p1_lng, req.query.p2_lng);
  var lng_max = Math.max(req.query.p1_lng, req.query.p2_lng);

  pg_read.query("SELECT COUNT(DISTINCT tripId) AS count FROM events WHERE lat > $1 AND lat < $2 AND lng > $3 AND lng < $4;",
	[lat_min, lat_max, lng_min, lng_max],
	function(err, result) {
	  res.send({
		trip_count: result.rows[0].count
	  });
	}
  );
});

app.get('/fare-sum', function(req, res) {
  if (!req.query.p1_lat || !req.query.p1_lng || !req.query.p2_lat || !req.query.p2_lng) {
	res.status(400).send("invalid query parameters");
	return;
  }

  var lat_min = Math.min(req.query.p1_lat, req.query.p2_lat);
  var lat_max = Math.max(req.query.p1_lat, req.query.p2_lat);
  var lng_min = Math.min(req.query.p1_lng, req.query.p2_lng);
  var lng_max = Math.max(req.query.p1_lng, req.query.p2_lng);

  pg_read.query("SELECT SUM(fare) AS fare_sum, COUNT(fare) AS trip_count FROM events WHERE tripId IN (SELECT DISTINCT tripId FROM events WHERE lat > $1 AND lat < $2 AND lng > $3 AND lng > $4 AND (event = 'begin' OR event = 'end')) AND event = 'end';",
	[lat_min, lat_max, lng_min, lng_max],
	function(err, result) {
	  res.send({
		fare_sum: parseFloat(result.rows[0].fare_sum) || 0,
		trip_count: parseInt(result.rows[0].trip_count, 10) || 0,
	  });
	}
  );
});

app.get('/snapshot-count', function(req, res) {
  if (!req.query.timestamp) {
	res.status(400).send("invalid query parameters");
	return;
  }

  pg_read.query("SELECT (SELECT COUNT(*) FROM events WHERE event = 'begin' AND created < $1::TIMESTAMP) - (SELECT COUNT(*) FROM events WHERE event = 'end' AND created < $1::TIMESTAMP) AS total;",
	[req.query.timestamp],
	function(err, result) {
	  console.log(result);
	  res.send({
		trip_count: parseInt(result.rows[0].total, 10)
	  });
	}
  );
});
