ALTER SEQUENCE conferences_id_seq RESTART WITH 1;
ALTER SEQUENCE events_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE questions_id_seq RESTART WITH 1;
ALTER SEQUENCE conference_tickets_id_seq RESTART WITH 1;
INSERT INTO conferences (name, logo_url)
VALUES 
	('Devconnect ARG', '/logo.png'),
	('DuneCon 2025', '/logo.png') 
ON CONFLICT DO NOTHING;
INSERT INTO events (
		conference_id,
		uid,
		title,
		submission_type,
		start,
		"end",
		description,
		track,
		cover,
		speaker,
		live
	)
VALUES -- Past Events
	(
		1,
		'staking-summit-2025',
		'Staking Summit',
		'Conference',
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
		'Conference',
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
		'Workshop',
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
		'Keynote',
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
		'Conference',
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
		'Conference',
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
		'Conference',
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
		'Conference',
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
		'Hackathon',
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
		'Conference',
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
		'Keynote',
		NOW() - INTERVAL '1 hour',
		NOW() + INTERVAL '4 hours',
		'Join us for the opening of DuneCon 2025, where data analysts, blockchain researchers, and Dune power users gather to share insights on on-chain analytics, SQL wizardry, and the future of blockchain data intelligence.',
		'Analytics',
		'/logo.png',
		'Dune Team',
		TRUE
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
		'Devconnect ARG',
		'1f36ddce-e538-4c7a-9f31-6a4b2221ecac',
		'YwahfUdUYehkGMaWh0+q3F8itx2h8mybjPmt8CmTJSs',
		'bce2e86a-36a3-49d7-929b-b6e659773117',
		'organizer'
	) ON CONFLICT DO NOTHING;
INSERT INTO features (conference_id, name, active)
VALUES (2, 'anonymous-user', true)
ON CONFLICT (conference_id, name) DO
UPDATE
SET active = true;