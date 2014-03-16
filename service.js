#!/usr/bin/env node

var net = require('net');
var http = require('http');
var async = require('async');
var pg = require('pg').native;
var postgres; // PG connection

var tcp_port = process.argv[2];
var http_port = process.argv[3];
var pg_conn_string = "postgres://centric:EKG2Wk_rTtBPT54p@127.0.0.1/centric";

async.waterfall([
  // Step 1: Establish PgSQL connection
  function(callback) {
	console.log("Connecting to PgSQL...");
	pg.Client(pg_conn_string).connect(function(err, connection) {
	  postgres = connection;
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
	  } else if (req.url == '/fare-sum') {
	  } else if (req.url == '/snapshot-count') {
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
