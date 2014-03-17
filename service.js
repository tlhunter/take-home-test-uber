#!/usr/bin/env node

var net = require('net');
var async = require('async');
var pg = require('pg').native;
var express = require('express');
var app = express();

var pg_conn = "postgres://centric:EKG2Wk_rTtBPT54p@127.0.0.1/centric";
var pg_write = new pg.Client(pg_conn);
var pg_read = new pg.Client(pg_conn);

var tcp_port = parseInt(process.argv[2], 10);
var http_port = parseInt(process.argv[3], 10);

async.waterfall([
  // Step 1: Establish PgSQL connection for Writing
  function(callback) {
	console.log("Connecting to PgSQL for Writing...");
	pg_write.connect(function(err) {
	  console.log("Deleting previous events data...");
	  pg_write.query("TRUNCATE events");
	  callback(err);
	});
  },

  // Step 2: Establish PgSQL connection for Reading
  function(callback) {
	console.log("Connecting to PgSQL for Reads...");
	pg_read.connect(function(err) {
	  callback(err);
	});
  },

  // Step 3: Establish connection to Uber Emitter
  function(callback) {
	console.log("Connecting to Uber Car Position Emitter...");
	var uber = net.connect({port: tcp_port}, callback);

	uber.on('data', function(data) {
	  var raw = data.toString();
	  var split = raw.split("\r\n");
	  split.pop();
	  split.forEach(function(event) {
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

	uber.on('end', function() {
	  console.log("No longer connected to Uber Emitter.");
	  process.exit();
	});
  },

  // Step 4: Listen for HTTP Requests
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

app.get('/', function(req, res) {
  res.send([
	'/trip-count',
	'/fare-sum',
	'/snapshot-count'
  ]);
});

// GET /trip-count?p1_lat={latitude1}&p1_lng={longitude1}&p2_lat={latitude2}&p2_lng={longitude2}
app.get('/trip-count', function(req, res) {
  if (!req.query.p1_lat || !req.query.p1_lng || !req.query.p2_lat || !req.query.p2_lng) {
	res.status(400).send("You must provide the following parameters: p1_lat, p1_lng, p2_lat, p2_lng");
	return;
  }

  pg_read.query(
	"SELECT COUNT(DISTINCT tripId) AS count FROM events WHERE lat > $1 AND lat < $2 AND lng > $3 AND lng < $4;",
	splitLatLng(req.query),
	function(err, result) {
	  if (err || !result.rows) {
		res.status(404).send("Couldn't find anything");
		return;
	  }

	  res.send({
		trip_count: parseInt(result.rows[0].count, 10)
	  });
	}
  );
});

app.get('/fare-sum', function(req, res) {
  if (!req.query.p1_lat || !req.query.p1_lng || !req.query.p2_lat || !req.query.p2_lng) {
	res.status(400).send("You must provide the following parameters: p1_lat, p1_lng, p2_lat, p2_lng");
	return;
  }

  pg_read.query(
	"SELECT SUM(fare) AS fare_sum, COUNT(fare) AS trip_count FROM events WHERE tripId IN (SELECT DISTINCT tripId FROM events WHERE lat > $1 AND lat < $2 AND lng > $3 AND lng > $4 AND (event = 'begin' OR event = 'end')) AND event = 'end';",
	splitLatLng(req.query),
	function(err, result) {
	  if (err || !result.rows) {
		res.status(404).send("Couldn't find anything");
		return;
	  }

	  res.send({
		fare_sum: parseFloat(result.rows[0].fare_sum) || 0,
		trip_count: parseInt(result.rows[0].trip_count, 10) || 0,
	  });
	}
  );
});

app.get('/snapshot-count', function(req, res) {
  if (!req.query.timestamp) {
	res.status(400).send("You must provide the following parameters: timestamp");
	return;
  }

  pg_read.query(
	"SELECT (SELECT COUNT(*) FROM events WHERE event = 'begin' AND created < $1::TIMESTAMP) - (SELECT COUNT(*) FROM events WHERE event = 'end' AND created < $1::TIMESTAMP) AS total;",
	[req.query.timestamp],
	function(err, result) {
	  if (err || !result.rows) {
		res.status(404).send("Couldn't find anything");
		return;
	  }

	  res.send({
		trip_count: parseInt(result.rows[0].total, 10)
	  });
	}
  );
});

/**
 * Expects an object with the four keys:
 * p1_lat, p1_lng, p2_lat, p2_lng
 * These represent two opposing corners of a geographical rectangle.
 * The returned array is the the smaller lat, larger lat, smaller lng, larger lng, intended to be used by PgSQL.
 */
function splitLatLng(data) {
  var lats = [data.p1_lat, data.p2_lat];
  var lngs = [data.p1_lng, data.p2_lng];
  return [
	Math.min.apply(null, lats),
	Math.max.apply(null, lats),
	Math.min.apply(null, lngs),
	Math.max.apply(null, lngs)
  ];
}
