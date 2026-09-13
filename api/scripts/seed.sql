ALTER SEQUENCE conferences_id_seq RESTART WITH 1;
ALTER SEQUENCE events_id_seq RESTART WITH 1;
ALTER SEQUENCE questions_id_seq RESTART WITH 1;
ALTER SEQUENCE conference_tickets_id_seq RESTART WITH 1;
-- Default theme for seeded conferences (mirrors app/theme/devconnect.ts)
WITH devconnect_theme AS (
	SELECT '{
		"brandColor": "#74acdf",
		"contrastColor": "#FFFFFF",
		"background": "linear-gradient(360deg, #F6B61326 0%, #FF85A626 17%, #9894FF26 35%, #74ACDF26 64%, #F2F9FF26 100%)",
		"textColor": "#36364c",
		"systemTheme": "light",
		"headingFontFamily": "Roboto Condensed",
		"bodyFontFamily": "Roboto"
	}'::jsonb AS theme
)
INSERT INTO conferences (name, logo_url, theme)
VALUES
	('Devconnect ARG', '/logo.png', (SELECT theme FROM devconnect_theme)),
	('DuneCon 2025', '/logo.png', (SELECT theme FROM devconnect_theme))
ON CONFLICT DO NOTHING;
INSERT INTO events (
		conference_id,
		uid,
		title,
		start,
		"end",
		description,
		stage,
		cover,
		speaker,
		live
	)
VALUES -- Past Events
	(
		1,
		'staking-summit-2025',
		'Staking Summit',
		NOW() - INTERVAL '7 days',
		NOW() - INTERVAL '5 days',
		'Join 2000 participants for talks and workshops on validator operations, staking economics, MEV, and the future of Ethereum''s consensus layer. Mixed format event with expert speakers from across the ecosystem.',
		'Infrastructure',
		'/logo.png',
		'Staking Rewards',
		FALSE
	),
	(
		1,
		'ethereum-cypherpunk-congress-2',
		'Ethereum Cypherpunk Congress 2',
		NOW() - INTERVAL '5 days',
		NOW() - INTERVAL '5 days' + INTERVAL '10 hours',
		'A gathering of cypherpunks, privacy advocates, and cryptographers discussing zero-knowledge proofs, encrypted communication, privacy-preserving technologies, and the fight for digital freedom on Ethereum.',
		'Privacy',
		'/logo.png',
		'Web3 Privacy Now',
		FALSE
	),
	(
		1,
		'governance-day-research-2025',
		'Governance Day Devconnect BA 2025 (Day 2: Research Track)',
		NOW() - INTERVAL '5 days',
		NOW() - INTERVAL '5 days' + INTERVAL '6 hours',
		'Deep dive into governance research with 70 participants. Topics include mechanism design, voting theory, quadratic funding, token engineering, and novel coordination mechanisms for DAOs.',
		'Governance',
		'/logo.png',
		'SEED Gov',
		FALSE
	),
	-- Current/Live Event
	(
		1,
		'ethereum-day-2025',
		'Ethereum Day & Devconnect Opening Ceremony',
		NOW() - INTERVAL '2 hours',
		NOW() + INTERVAL '3 hours',
		'Bringing the world of Ethereum to one stage. 3000 attendees gather for the kickoff featuring keynotes on protocol upgrades, ecosystem updates, and the future of Ethereum. Includes the opening of the Ethereum World''s Fair.',
		'Ethereum Day',
		'/logo.png',
		'Devconnect Team',
		TRUE
	),
	-- Upcoming Events
	(
		1,
		'solidity-summit-2025',
		'Solidity Summit',
		NOW() + INTERVAL '6 hours',
		NOW() + INTERVAL '14 hours',
		'Deep technical discussions on Solidity language features, compiler optimizations, security patterns, testing strategies, and the future roadmap of smart contract development on Ethereum.',
		'Development',
		'/logo.png',
		'Vishwa Mehta',
		FALSE
	),
	(
		1,
		'defi-day-del-sur-2025',
		'DeFi Day del Sur',
		NOW() + INTERVAL '1 day',
		NOW() + INTERVAL '1 day' + INTERVAL '8 hours',
		'Comprehensive exploration of DeFi protocols, liquidity provision, lending markets, derivatives, and the unique challenges and opportunities in Latin American DeFi adoption.',
		'DeFi',
		'/logo.png',
		'Aave Labs',
		FALSE
	),
	(
		1,
		'defi-security-summit-2025',
		'DeFi Security Summit',
		NOW() + INTERVAL '2 days',
		NOW() + INTERVAL '4 days',
		'Two-day intermediate summit on securing DeFi protocols. Topics include smart contract auditing, formal verification, incident response, MEV protection, and learning from past exploits.',
		'Security',
		'/logo.png',
		'DeFi Security Summit',
		FALSE
	),
	(
		1,
		'schelling-point-2025',
		'Schelling Point',
		NOW() + INTERVAL '2 days',
		NOW() + INTERVAL '2 days' + INTERVAL '6 hours',
		'Mixed format event exploring coordination mechanisms, commons funding, regenerative finance, and how Ethereum can enable better coordination for solving global challenges.',
		'Public Goods',
		'/logo.png',
		'Gitcoin',
		FALSE
	),
	(
		1,
		'ethglobal-hackathon-2025',
		'ETHGlobal',
		NOW() + INTERVAL '3 days',
		NOW() + INTERVAL '5 days',
		'Join developers from around the world to build decentralized applications. Mentorship from leading projects, workshops, bounties, and prizes. All skill levels welcome to learn and build.',
		'Hackathon',
		'/logo.png',
		'ETHGlobal',
		FALSE
	),
	(
		1,
		'ethproofs-day-2025',
		'Ethproofs Day',
		NOW() + INTERVAL '4 days',
		NOW() + INTERVAL '4 days' + INTERVAL '8 hours',
		'Mixed format event on zero-knowledge proofs, validity proofs, fraud proofs, and their applications in scaling Ethereum. Technical presentations from researchers and protocol developers. Included in World''s Fair ticket.',
		'Research',
		'/logo.png',
		'Ethereum Foundation',
		FALSE
	),
	-- DuneCon 2025
	(
		2,
		'dunecon-opening-2025',
		'DuneCon 2025 Opening Ceremony',
		NOW() - INTERVAL '1 hour',
		NOW() + INTERVAL '4 hours',
		'Join us for the opening of DuneCon 2025, where data analysts, blockchain researchers, and Dune power users gather to share insights on on-chain analytics, SQL wizardry, and the future of blockchain data intelligence.',
		'Analytics',
		'/logo.png',
		'Dune Team',
		TRUE
	) -- Re-seeding moves the schedule to be relative to now again.
	ON CONFLICT (uid) DO
UPDATE
SET start = EXCLUDED.start,
	"end" = EXCLUDED."end";
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
		'Devconnect ARG',
		'1f36ddce-e538-4c7a-9f31-6a4b2221ecac',
		'YwahfUdUYehkGMaWh0+q3F8itx2h8mybjPmt8CmTJSs',
		'bce2e86a-36a3-49d7-929b-b6e659773117',
		'organizer'
	) ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Test data covering every feature: themes, feature flags, invitations, roles,
-- anonymous/banned users, questions in every state, votes and reactions.
-- Safe to re-run. The seeded users are fake and cannot sign in; sign in
-- yourself (email OTP or anonymously) to interact with this data, and pass
-- SEED_ORGANIZER_EMAIL to seed.sh to make your own account an organizer.
--
-- Personas (auth.users ids 5eed0000-0000-4000-8000-00000000000N):
--   1 organizer@example.com  organizer of both conferences (via invitations)
--   2 speaker@example.com    speaker at Devconnect ARG
--   3 alice@example.com      attendee at Devconnect ARG, asks questions
--   4 bob@example.com        asks and votes
--   5 carol@example.com      asks and votes
--   6 dave@example.com       asks and votes
--   7 (anonymous)            anonymous sign-in user
--   8 spam@example.com       banned: questions hidden from Q&A, shown in /moderation
-- ---------------------------------------------------------------------------
-- The RESTARTs above only suit a fresh database; move the sequences past any
-- existing rows so new rows below don't collide on id when re-seeding.
DO $$
BEGIN
	PERFORM setval('conferences_id_seq', COALESCE((SELECT MAX(id) FROM conferences), 0) + 1, FALSE);
	PERFORM setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 0) + 1, FALSE);
	PERFORM setval('questions_id_seq', COALESCE((SELECT MAX(id) FROM questions), 0) + 1, FALSE);
	PERFORM setval('conference_tickets_id_seq', COALESCE((SELECT MAX(id) FROM conference_tickets), 0) + 1, FALSE);
END $$;
-- More sessions on the live events' stages, so the session switcher has past
-- and upcoming entries (it lists the sessions on the current stage).
INSERT INTO events (
		conference_id,
		uid,
		title,
		start,
		"end",
		description,
		stage,
		cover,
		speaker,
		live
	)
SELECT c.id,
	v.uid,
	v.title,
	NOW() + v.starts_in,
	NOW() + v.starts_in + v.duration,
	v.description,
	v.stage,
	'/logo.png',
	v.speaker,
	FALSE
FROM (
		VALUES (
				'Devconnect ARG',
				'ethereum-day-morning-keynotes',
				'Ethereum Day: Morning Keynotes',
				INTERVAL '-5 hours',
				INTERVAL '2 hours',
				'Opening keynotes on the state of the protocol and the roadmap ahead.',
				'Ethereum Day',
				'Ethereum Foundation'
			),
			(
				'Devconnect ARG',
				'ethereum-day-closing-panel',
				'Ethereum Day: Closing Panel',
				INTERVAL '3 hours 30 minutes',
				INTERVAL '1 hour',
				'Client teams take the audience''s questions on what ships next.',
				'Ethereum Day',
				'Devconnect Team'
			),
			(
				'DuneCon 2025',
				'dunecon-sql-workshop',
				'DuneCon SQL Workshop',
				INTERVAL '4 hours 30 minutes',
				INTERVAL '2 hours',
				'Hands-on session writing and optimizing Dune queries.',
				'Analytics',
				'Dune Team'
			)
	) AS v (
		conference,
		uid,
		title,
		starts_in,
		duration,
		description,
		stage,
		speaker
	)
	JOIN conferences c ON c.name = v.conference ON CONFLICT (uid) DO
UPDATE
SET start = EXCLUDED.start,
	"end" = EXCLUDED."end";
-- Feature flags: `collect` adds the Event Card (Zupass) page to the navigation.
INSERT INTO features (conference_id, name, active)
SELECT id,
	'collect',
	name = 'Devconnect ARG'
FROM conferences
WHERE name IN ('Devconnect ARG', 'DuneCon 2025') ON CONFLICT DO NOTHING;
-- Invitations are inserted before the users so the on_auth_user_created
-- trigger claims organizer@example.com's; new.organizer@example.com stays pending.
INSERT INTO invitations (email, conference_id, "role")
SELECT v.email,
	c.id,
	v.role::"role"
FROM (
		VALUES ('organizer@example.com', 'Devconnect ARG', 'organizer'),
			('organizer@example.com', 'DuneCon 2025', 'organizer'),
			('new.organizer@example.com', 'DuneCon 2025', 'organizer')
	) AS v (email, conference, role)
	JOIN conferences c ON c.name = v.conference
WHERE NOT EXISTS (
		SELECT 1
		FROM invitations i
		WHERE i.email = v.email
			AND i.conference_id = c.id
	);
INSERT INTO auth.users (
		instance_id,
		id,
		aud,
		"role",
		email,
		encrypted_password,
		email_confirmed_at,
		raw_app_meta_data,
		raw_user_meta_data,
		is_anonymous,
		banned_until,
		created_at,
		updated_at,
		confirmation_token,
		recovery_token,
		email_change_token_new,
		email_change
	)
SELECT '00000000-0000-0000-0000-000000000000',
	v.id::uuid,
	'authenticated',
	'authenticated',
	v.email,
	'',
	CASE
		WHEN v.email IS NOT NULL THEN NOW() - INTERVAL '30 days'
	END,
	CASE
		WHEN v.email IS NOT NULL THEN '{"provider": "email", "providers": ["email"]}'::jsonb
		ELSE '{}'::jsonb
	END,
	jsonb_build_object('name', v.name),
	v.email IS NULL,
	CASE
		WHEN v.banned THEN NOW() + INTERVAL '30 days'
	END,
	NOW() - INTERVAL '30 days',
	NOW() - INTERVAL '30 days',
	'',
	'',
	'',
	''
FROM (
		VALUES ('5eed0000-0000-4000-8000-000000000001', 'organizer@example.com', 'bold-meerkat-0001', FALSE),
			('5eed0000-0000-4000-8000-000000000002', 'speaker@example.com', 'wise-owl-0002', FALSE),
			('5eed0000-0000-4000-8000-000000000003', 'alice@example.com', 'curious-otter-0003', FALSE),
			('5eed0000-0000-4000-8000-000000000004', 'bob@example.com', 'sleepy-panda-0004', FALSE),
			('5eed0000-0000-4000-8000-000000000005', 'carol@example.com', 'brave-falcon-0005', FALSE),
			('5eed0000-0000-4000-8000-000000000006', 'dave@example.com', 'quick-fox-0006', FALSE),
			('5eed0000-0000-4000-8000-000000000007', NULL, 'quiet-lynx-0007', FALSE),
			('5eed0000-0000-4000-8000-000000000008', 'spam@example.com', 'noisy-hyena-0008', TRUE)
	) AS v (id, email, name, banned) ON CONFLICT DO NOTHING;
INSERT INTO conference_role (conference_id, user_id, "role")
SELECT c.id,
	v.user_id::uuid,
	v.role::"role"
FROM (
		VALUES ('Devconnect ARG', '5eed0000-0000-4000-8000-000000000002', 'speaker'),
			('Devconnect ARG', '5eed0000-0000-4000-8000-000000000003', 'attendee')
	) AS v (conference, user_id, role)
	JOIN conferences c ON c.name = v.conference ON CONFLICT DO NOTHING;
-- Optional: make a real account an organizer of every conference
-- (seed.sh passes SEED_ORGANIZER_EMAIL as the organizer_email variable).
\if :{?organizer_email}
INSERT INTO invitations (email, conference_id, "role")
SELECT lower(:'organizer_email'),
	c.id,
	'organizer'
FROM conferences c
WHERE NOT EXISTS (
		SELECT 1
		FROM invitations i
		WHERE i.email = lower(:'organizer_email')
			AND i.conference_id = c.id
	);
\endif
-- Claim pending invitations for users who already exist (the trigger only
-- handles users created after the invitation).
INSERT INTO conference_role (user_id, conference_id, "role")
SELECT DISTINCT ON (u.id, i.conference_id) u.id,
	i.conference_id,
	i.role
FROM invitations i
	JOIN auth.users u ON lower(u.email) = lower(i.email)
WHERE i.claimed_at IS NULL
ORDER BY u.id,
	i.conference_id,
	i.created_at DESC ON CONFLICT (conference_id, user_id) DO
UPDATE
SET "role" = EXCLUDED.role;
UPDATE invitations i
SET claimed_at = NOW()
FROM auth.users u
WHERE lower(u.email) = lower(i.email)
	AND i.claimed_at IS NULL;
-- Questions in every state. Ages are relative to NOW() so the live events have
-- fresh activity: selected (on screen), answered, open, just asked, near the
-- 200-char limit,
-- non-ASCII, soft-deleted (hidden everywhere) and from the banned user
-- (hidden from Q&A, visible in /moderation).
INSERT INTO questions (
		uid,
		event_id,
		user_id,
		question,
		created_at,
		selected_at,
		answered_at,
		deleted_at
	)
SELECT v.uid,
	e.id,
	v.user_id::uuid,
	v.question,
	NOW() - v.age,
	NOW() - v.selected_ago,
	NOW() - v.answered_ago,
	NOW() - v.deleted_ago
FROM (
		VALUES -- Ethereum Day (live, Devconnect ARG)
			(
				'5eed0001-0000-7000-8000-000000000001',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000003',
				'What is the single biggest UX improvement Ethereum users should expect from the next network upgrade?',
				INTERVAL '25 minutes',
				INTERVAL '2 minutes',
				NULL::interval,
				NULL::interval
			),
			(
				'5eed0001-0000-7000-8000-000000000002',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000004',
				'How is the EF thinking about funding client diversity after the last round of grants?',
				INTERVAL '40 minutes',
				INTERVAL '20 minutes',
				INTERVAL '2 minutes',
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000003',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000005',
				'Will the World''s Fair talks be recorded and published afterwards?',
				INTERVAL '35 minutes',
				NULL,
				INTERVAL '12 minutes',
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000004',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000006',
				'Is running a full node on a phone realistic within the next two years, or is that still a research dream?',
				INTERVAL '18 minutes',
				NULL,
				NULL,
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000005',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000007',
				'¿Cuándo veremos account abstraction nativa en la capa 1?',
				INTERVAL '15 minutes',
				NULL,
				NULL,
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000006',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000003',
				'Which L2 interoperability standard should new projects bet on today?',
				INTERVAL '9 minutes',
				NULL,
				NULL,
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000007',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000004',
				'Can you share the slides after the keynote?',
				INTERVAL '1 minute',
				NULL,
				NULL,
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000008',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000005',
				'With blob fees now a real cost for rollups, how do you balance raising the blob target against keeping home stakers'' bandwidth needs realistic, and what data would change your mind on it? Thanks!',
				INTERVAL '5 minutes',
				NULL,
				NULL,
				NULL
			),
			(
				'5eed0001-0000-7000-8000-000000000009',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000006',
				'this talk is boring lol',
				INTERVAL '30 minutes',
				NULL,
				NULL,
				INTERVAL '28 minutes'
			),
			(
				'5eed0001-0000-7000-8000-000000000010',
				'ethereum-day-2025',
				'5eed0000-0000-4000-8000-000000000008',
				'Free airdrop for everyone in the room, just connect your wallet at totally-legit-claim.example',
				INTERVAL '22 minutes',
				NULL,
				NULL,
				NULL
			),
			-- DuneCon 2025 Opening Ceremony (live, DuneCon 2025)
			(
				'5eed0002-0000-7000-8000-000000000001',
				'dunecon-opening-2025',
				'5eed0000-0000-4000-8000-000000000003',
				'Which Dune tables are best for tracking blob usage per rollup?',
				INTERVAL '30 minutes',
				INTERVAL '5 minutes',
				NULL,
				NULL
			),
			(
				'5eed0002-0000-7000-8000-000000000002',
				'dunecon-opening-2025',
				'5eed0000-0000-4000-8000-000000000004',
				'Are there plans for scheduled query alerts on the free tier?',
				INTERVAL '20 minutes',
				NULL,
				NULL,
				NULL
			),
			(
				'5eed0002-0000-7000-8000-000000000003',
				'dunecon-opening-2025',
				'5eed0000-0000-4000-8000-000000000005',
				'Will today''s dashboards be shared publicly after the event?',
				INTERVAL '12 minutes',
				NULL,
				INTERVAL '8 minutes',
				NULL
			),
			(
				'5eed0002-0000-7000-8000-000000000004',
				'dunecon-opening-2025',
				'5eed0000-0000-4000-8000-000000000007',
				'How do you keep spellbook models consistent across chains?',
				INTERVAL '4 minutes',
				NULL,
				NULL,
				NULL
			),
			-- Staking Summit (past, Devconnect ARG)
			(
				'5eed0003-0000-7000-8000-000000000001',
				'staking-summit-2025',
				'5eed0000-0000-4000-8000-000000000003',
				'What does the max-effective-balance change mean for large node operators?',
				INTERVAL '6 days 2 hours',
				INTERVAL '6 days 1 hour',
				INTERVAL '6 days',
				NULL
			),
			(
				'5eed0003-0000-7000-8000-000000000002',
				'staking-summit-2025',
				'5eed0000-0000-4000-8000-000000000004',
				'How should solo stakers think about MEV-boost relay risk?',
				INTERVAL '6 days 1 hour',
				NULL,
				INTERVAL '6 days',
				NULL
			),
			(
				'5eed0003-0000-7000-8000-000000000003',
				'staking-summit-2025',
				'5eed0000-0000-4000-8000-000000000006',
				'Any recommendations for monitoring validator performance on a budget?',
				INTERVAL '5 days 23 hours',
				NULL,
				NULL,
				NULL
			),
			-- Ethereum Cypherpunk Congress 2 (past, Devconnect ARG)
			(
				'5eed0004-0000-7000-8000-000000000001',
				'ethereum-cypherpunk-congress-2',
				'5eed0000-0000-4000-8000-000000000005',
				'What is the most practical privacy tool attendees can adopt this week?',
				INTERVAL '4 days 18 hours',
				NULL,
				INTERVAL '4 days 17 hours',
				NULL
			),
			(
				'5eed0004-0000-7000-8000-000000000002',
				'ethereum-cypherpunk-congress-2',
				'5eed0000-0000-4000-8000-000000000007',
				'Are stealth addresses ready for mainstream wallets?',
				INTERVAL '4 days 17 hours',
				NULL,
				NULL,
				NULL
			)
	) AS v (
		uid,
		event_uid,
		user_id,
		question,
		age,
		selected_ago,
		answered_ago,
		deleted_ago
	)
	JOIN events e ON e.uid = v.event_uid ON CONFLICT DO NOTHING;
-- Votes drive the "popular" sort and participant counts.
INSERT INTO votes (question_id, user_id, created_at)
SELECT q.id,
	v.user_id::uuid,
	q.created_at + INTERVAL '1 minute'
FROM (
		VALUES ('5eed0001-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000002'),
			('5eed0001-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000004'),
			('5eed0001-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0001-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000006'),
			('5eed0001-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0001-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0001-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000006'),
			('5eed0001-0000-7000-8000-000000000003', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0001-0000-7000-8000-000000000004', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0001-0000-7000-8000-000000000004', '5eed0000-0000-4000-8000-000000000004'),
			('5eed0001-0000-7000-8000-000000000004', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0001-0000-7000-8000-000000000005', '5eed0000-0000-4000-8000-000000000004'),
			('5eed0001-0000-7000-8000-000000000005', '5eed0000-0000-4000-8000-000000000006'),
			('5eed0001-0000-7000-8000-000000000006', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0002-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000004'),
			('5eed0002-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0002-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0002-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0002-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000006'),
			('5eed0002-0000-7000-8000-000000000003', '5eed0000-0000-4000-8000-000000000006'),
			('5eed0003-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000004'),
			('5eed0003-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0003-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000006'),
			('5eed0003-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0003-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000005'),
			('5eed0003-0000-7000-8000-000000000003', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0004-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000003'),
			('5eed0004-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000004'),
			('5eed0004-0000-7000-8000-000000000001', '5eed0000-0000-4000-8000-000000000007'),
			('5eed0004-0000-7000-8000-000000000002', '5eed0000-0000-4000-8000-000000000005')
	) AS v (question_uid, user_id)
	JOIN questions q ON q.uid = v.question_uid ON CONFLICT DO NOTHING;
-- Reactions on the live events.
INSERT INTO reactions (uid, user_id, event_id, created_at)
SELECT format('%s-%s', v.prefix, lpad(n::text, 4, '0')),
	(
		ARRAY ['5eed0000-0000-4000-8000-000000000003',
		'5eed0000-0000-4000-8000-000000000004',
		'5eed0000-0000-4000-8000-000000000005',
		'5eed0000-0000-4000-8000-000000000006',
		'5eed0000-0000-4000-8000-000000000007']
	) [1 + n % 5]::uuid,
	e.id,
	NOW() - make_interval(secs => n * 97)
FROM (
		VALUES ('ethereum-day-2025', 'seed-reaction-ethereum-day', 24),
			('dunecon-opening-2025', 'seed-reaction-dunecon', 8)
	) AS v (event_uid, prefix, total)
	JOIN events e ON e.uid = v.event_uid
	CROSS JOIN LATERAL generate_series(1, v.total) AS n ON CONFLICT DO NOTHING;
-- Keep sequences ahead of existing rows (the RESTARTs above are for fresh
-- databases) so re-running the seed doesn't break inserts from the app.
DO $$
BEGIN
	PERFORM setval('conferences_id_seq', COALESCE((SELECT MAX(id) FROM conferences), 0) + 1, FALSE);
	PERFORM setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 0) + 1, FALSE);
	PERFORM setval('questions_id_seq', COALESCE((SELECT MAX(id) FROM questions), 0) + 1, FALSE);
	PERFORM setval('conference_tickets_id_seq', COALESCE((SELECT MAX(id) FROM conference_tickets), 0) + 1, FALSE);
	PERFORM setval('invitations_id_seq', COALESCE((SELECT MAX(id) FROM invitations), 0) + 1, FALSE);
END $$;
