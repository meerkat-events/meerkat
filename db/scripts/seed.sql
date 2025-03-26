ALTER SEQUENCE conferences_id_seq RESTART WITH 1;
ALTER SEQUENCE events_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE questions_id_seq RESTART WITH 1;
ALTER SEQUENCE conference_tickets_id_seq RESTART WITH 1;
INSERT INTO conferences (name, logo_url)
VALUES (
		'My Conference',
		'/logo.png'
	) ON CONFLICT DO NOTHING;
INSERT INTO events (
		conference_id,
		uid,
		title,
		submission_type,
		start,
		"end",
		abstract,
		description,
		track,
		cover,
		speaker
	)
VALUES (
		1,
		'EVENT',
		'Title',
		'Talk',
		NOW(),
		NOW() + INTERVAL '1 week',
		'Join us for an engaging exploration of innovative ideas and cutting-edge developments',
		'In this comprehensive session, we will delve into emerging trends and transformative concepts that are shaping our industry. Through real-world examples and interactive discussions, participants will gain practical insights into implementing these ideas in their own work. We will examine best practices, common challenges, and effective solutions while fostering an environment of collaborative learning and knowledge sharing.',
		'Innovation & Technology',
		'/logo.png',
		'Speaker'
	) ON CONFLICT DO NOTHING;

INSERT INTO conference_tickets (
    conference_id,
    collection_name,
    event_id,
    signer_public_key,
    product_id,
    "role"
)
VALUES (
		1,
		'ETHDenver Test',
		'cd92f88c-5b87-5769-8af7-a49d68d3ae87',
		'BNK3P9+x82ZiYaEaBTxISgdD4+i7JVVT1cqqG/E47JA',
		'dfcfc8dc-9ee2-5b78-ab70-a8276c220d14',
		'organizer'
	) ON CONFLICT DO NOTHING;

INSERT INTO features (conference_id, name, active)
VALUES 
    (1, 'temple-background', true),
    (1, 'speaker-feedback', true),
    (1, 'fileverse-link', true),
    (1, 'zupass-login', true),
		(1, 'leaderboard', true),
		(1, 'anonymous-user', true)
ON CONFLICT (conference_id, name) DO UPDATE SET active = true;