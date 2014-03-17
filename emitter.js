#!/usr/bin/env node

/**
 * Uber Coding Challenge: Geotemporal Systems
 * @author: Thomas Hunter <me@thomashunter.name>
 *
 * This program emits sample data.
 * I wrote it hastily so that I could get to the real project,
 * so please don't consider this a reflection of my skill!
 */
var net = require('net');

// Grab Port Numbers from arguments
var tcp_port = parseInt(process.argv[2], 10);

if (!tcp_port) {
  console.log("Usage: ./emitter.js <tcp_port>");
  process.exit(1);
}

// Big ol' array of all concurrent trips
var trips = [];

// Array of all clients (service.js) connected to this server
var clients = [];

// Announces some data to all connected clients
var announce = function(message) {
  clients.forEach(function(client) {
	client.write(JSON.stringify(message) + "\r\n");
  });
};

var max_trip_id = 0;

// How frequently we want to transmit update locations in ms
var update_interval = 1 * 1000;

// How many trips should be happening at the same time
var average_concurrent_trips = 500;

// What is the bounding box for spawning cars in
var spawn = {
  ne: {
	lat:   37.814039,
	lng: -122.359200,
  },
  sw: {
	lat:   37.704382,
	lng: -122.514381,
  }
};

var server = net.createServer(function(connection) {
  // Add to list of clients
  clients.push(connection);

  connection.on('end', function() {
	// Remove from list of clients
	console.log("Client is disconnecting gracefully. Removing from client pool.");
    clients.splice(clients.indexOf(connection), 1);
  });

  connection.on('error', function(err) {
	// Remove from list of clients
	console.log("Client is disconnecting uncleanly. Removing from client pool.");
    clients.splice(clients.indexOf(connection), 1);
  });
});

var create_trip = function() {
  max_trip_id++;

  var trip = {
	tripId: max_trip_id,
	lat: (spawn.ne.lat - spawn.sw.lat) * Math.random() + spawn.sw.lat,
	lng: (spawn.ne.lng - spawn.sw.lng) * Math.random() + spawn.sw.lng,
  };
  trips.push(trip);

  announce({
	event: 'begin',
	tripId: trip.tripId,
	lat: trip.lat,
	lng: trip.lng,
  });
};

var tick = function() {
  // Move each car randomly
  var i = 0;
  trips.forEach(function(trip) {
	var action_threshold = Math.random();

	if (action_threshold < 0.01) { // Trip Ends
	  setTimeout(function() {
		announce({
		  event: 'end',
		  tripId: trip.tripId,
		  lat: trip.lat,
		  lng: trip.lng,
		  fare: Math.floor(Math.random() * 20) + 10,
		});
	  }, i);

	  trips.splice(trips.indexOf(trip), 1);

	} else { // Car Drives
	  trip.lat += Math.random() * 0.01 - 0.005;
	  trip.lng += Math.random() * 0.01 - 0.005;
	  setTimeout(function() {
		announce({
		  event: 'update',
		  tripId: trip.tripId,
		  lat: trip.lat,
		  lng: trip.lng,
		});
	  }, i);
	}

	i += 1.8; // slightly less than 2ms, which would be a continuous broadcast and could have race conditions
  });

  // Occasionally create new trips and attempt to catch up to the average
  if (Math.random() < 0.75) {
	for (var i = 0; i < (average_concurrent_trips + 5 - trips.length); i++) {
	  if (Math.random() < 0.65) {
		create_trip();
	  }
	}
  }

  console.log("Concurrent Trips: " + trips.length);
};

console.log("Waiting 5 seconds before starting simulation. Connect clients now...");
setTimeout(function() {
  console.log("Commencing.");
  // Seed some in-progress trips
  for (var i = 1; i <= average_concurrent_trips; i++) {
	create_trip();
  }

  setInterval(tick, update_interval);
}, 5 * 1000);

server.listen(tcp_port, function() {
  console.log('Emitting sample data on port:', tcp_port);
});
