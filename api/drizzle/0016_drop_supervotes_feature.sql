-- Supervotes are on in every conference: nothing reads the `supervotes`
-- feature flag any more.
DELETE FROM "features" WHERE "name" = 'supervotes';
