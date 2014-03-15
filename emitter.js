#!/usr/bin/env node

var net = require('net');
var tcp_port = process.argv[2];

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

// Seed some in-progress trips
for (var i = 1; i <= average_concurrent_trips; i++) {
  create_trip();
}

var tick = function() {
  // Move each car randomly
  trips.forEach(function(trip) {
	var action_threshold = Math.random();

	if (action_threshold < 0.001) { // Trip Ends
	  announce({
		event: 'end',
		tripId: trip.tripId,
		lat: trip.lat,
		lng: trip.lng,
		fare: Math.floor(Math.random() * 20) + 10,
	  });

	  trips.splice(trips.indexOf(trip), 1);

	} else { // Car Drives
	  trip.lat += Math.random() * 0.01 - 0.005;
	  trip.lng += Math.random() * 0.01 - 0.005;
	  announce({
		event: 'update',
		tripId: trip.tripId,
		lat: trip.lat,
		lng: trip.lng,
	  });
	}
  });

  // Create new trips to catch back up to the average
  for (var i = 0; i < (average_concurrent_trips - trips.length); i++) {
	create_trip();
  }

  console.log(trips);
};

setInterval(tick, update_interval);

server.listen(tcp_port, function() {
  console.log('Emitting sample data on port:', tcp_port);
});
