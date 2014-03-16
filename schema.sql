CREATE TYPE event_type AS ENUM ('begin', 'update', 'end');

CREATE TABLE events (
	event event_type NOT NULL,
	tripId INT NOT NULL,
	lat DOUBLE PRECISION NOT NULL,
	lng DOUBLE PRECISION NOT NULL,
	created TIMESTAMP default CURRENT_TIMESTAMP,
	fare NUMERIC(6,2)
);

CREATE INDEX ON events (type);
CREATE INDEX ON events (tripId);
CREATE INDEX ON events (lat);
CREATE INDEX ON events (lng);
CREATE INDEX ON events (created);

