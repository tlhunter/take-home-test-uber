module.exports = function(params) {
  var app = params.app;
  var pg_read = params.pg_read;

  /**
   * GET /
   */
  app.get('/', function(req, res) {
	res.send([
	  '/trip-count',
	  '/fare-sum',
	  '/snapshot-count'
	]);
  });

  /**
   * GET /trip-count?p1_lat={latitude1}&p1_lng={longitude1}&p2_lat={latitude2}&p2_lng={longitude2}
   */
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

  /**
   * GET /fare-sum?p1_lat={latitude1}&p1_lon={longitude1}&p2_lat={latitude2}&p2_lon={longitude2}
   */
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

  /**
   * GET /snapshot-count?timestamp={timestamp}
   */
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
};

/**
 * Expects an object with the four keys:
 * p1_lat, p1_lng, p2_lat, p2_lng
 * These represent two opposing corners of a geographical rectangle. Doesn't actually matter which corners.
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
