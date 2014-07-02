#!/usr/bin/env node

/**
 * Taxi Coding Challenge: Geotemporal Systems
 * @author: Thomas Hunter <me@thomashunter.name>
 *
 * This is the service described in the "Dispatch Backend" document.
 */
var net = require('net');
var async = require('async');
var pg = require('pg').native;
var express = require('express');
var app = express();


// PostgreSQL Connections
var pg_conn = process.env.PGSQL_CONN;
var pg_write = new pg.Client(pg_conn);
var pg_read = new pg.Client(pg_conn);

if (!pg_conn) {
  console.log("Please first configure Postgres via environment variable before running, e.g.:");
  console.log('export PGSQL_CONN="postgres://USER:PASS@HOST/DB"');
  process.exit(1);
}


// Grab Port Numbers from arguments
var tcp_port = parseInt(process.argv[2], 10);
var http_port = parseInt(process.argv[3], 10);

if (!tcp_port || !http_port) {
  console.log("Usage: ./service.js <tcp_port> <http_port>");
  process.exit(2);
}


// Make HTTP and DB Connections
async.auto({
  // Establish PgSQL connection for Writing
  pg_write: function(callback) {
	console.log("Connecting to PgSQL for Writing...");
	pg_write.connect(callback);
  },

  // Deletes the existing data in the database
  pg_clear: ['pg_write', function(callback) {
	console.log("Deleting previous events data...");
	pg_write.query("TRUNCATE events", callback);
  }],

  // Establish PgSQL connection for Reading
  pg_read: function(callback) {
	console.log("Connecting to PgSQL for Reading...");
	pg_read.connect(callback);
  },

  // Establish connection to Taxi Emitter
  taxi: ['pg_write', function(callback) {
	console.log("Connecting to Taxi Car Position Emitter...");
	net.connect({port: tcp_port}, callback)
	  .on('data', function(data) {
		// Convert socket to a string, remove the trailing newline, split on each line, and iterate
		data.toString().trim().split("\r\n").forEach(function(event) {
		  try {
			var obj = JSON.parse(event);
			pg_write.query("INSERT INTO events (event, tripId, lat, lng, fare) VALUES ($1, $2, $3, $4, $5);", [
			  obj.event,
			  obj.tripId,
			  obj.lat,
			  obj.lng,
			  obj.fare || null
			]);
		  } catch (err) {
			console.log("There was an error parsing data from the emitter!");
			console.log(err);
			console.log("Data:");
			console.log(data.toString());
		  }
		});
	  })
	  .on('end', function() {
		console.log("No longer connected to Taxi Emitter. Quitting.");
		process.exit(0);
	  });
  }],

  // Enables the HTTP Endpoints (BLOCKING IO)
  http_endpoints: ['pg_read', 'pg_clear', function(callback) {
	require('./controller.js')({
	  app: app,
	  pg_read: pg_read
	});

	callback();
  }],

  // Listen for Incoming HTTP Requests
  http: ['http_endpoints', function(callback) {
	console.log("Listening for HTTP Requests...");
	app.listen(http_port, callback);
  }]
}, function(err) {
  if (err) {
	console.log("There was an error establishing network connections:");
	console.log(err);
	process.exit(3);
  }
  console.log("HTTP and DB connections have been established.");
});
