-- Set protocol berg theme for conference with id <conference_id>
UPDATE conferences
SET theme = '{
    "backgroundColor": "#292929",
    "brandColor": "#7dd3fc",
    "contrastColor": "#000000",
    "headingFontFamily": "Latin Modern, Georgia, Cambria, Times New Roman, Times, serif",
    "bodyFontFamily": "Latin Modern, Georgia, Cambria, Times New Roman, Times, serif"
  }'::jsonb
WHERE id = < conference_id >;