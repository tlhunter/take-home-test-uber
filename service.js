#!/usr/bin/env node

var net = require('net');
var http = require('http');
var async = require('async');
var pg = require('pg').native;

var pg_conn_string = "postgres://centric:EKG2Wk_rTtBPT54p@127.0.0.1/centric";
var postgres = new pg.Client(pg_conn_string); // PG connection

var tcp_port = process.argv[2];
var http_port = process.argv[3];

async.waterfall([
  // Step 1: Establish PgSQL connection
  function(callback) {
	console.log("Connecting to PgSQL...");
	postgres.connect(function(err) {
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
		console.log(obj);
		postgres.query("INSERT INTO events (event, tripId, lat, lng, fare) VALUES ($1, $2, $3, $4, $5);", [
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
	http.createServer(function(req, res) {
	  if (req.url == '/trip-count') {
		console.log(req.params);
		// SELECT COUNT(DISTINCT tripId) AS count FROM events WHERE lat > 37.763998 AND lat < 37.777058 AND lng < -122.380357 AND lng > -122.401729;
	  } else if (req.url == '/fare-sum') {
		// SELECT SUM(fare) AS fare_sum, COUNT(fare) AS trip_count FROM events WHERE tripId IN (SELECT DISTINCT tripId FROM events WHERE lat > 37.763998 AND lat < 37.777058 AND lng < -122.380357 AND lng > -122.401729 AND (event = 'begin' OR event = 'end')) AND event = 'end';
	  } else if (req.url == '/snapshot-count') {
		// SELECT (SELECT COUNT(*) FROM events WHERE event = 'begin' AND created < '2014-03-16 18:30:00'::TIMESTAMP) - (SELECT COUNT(*) FROM events WHERE event = 'end' AND created < '2014-03-16 18:30:00'::TIMESTAMP) AS total;
	  } else {
		res.statusCode = 404;
		res.end('invalid url');
	  }
	}).listen(http_port, callback);
  }
], function(err, results) {
  if (err) {
	console.log("There was an error with the waterfall");
	console.log(err);
	throw err;
  }
  console.log("Done.");
});
