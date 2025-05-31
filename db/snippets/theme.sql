-- Set protocol berg theme for conference with id <conference_id>
UPDATE conferences
SET theme = '{
  "backgroundColor": "brand.900",
  "brandColor": "#1382aa",
  "contrastColor": "white",
  "headingFontFamily": "Latin Modern, Georgia, Cambria, Times New Roman, Times, serif",
  "bodyFontFamily": "Latin Modern, Georgia, Cambria, Times New Roman, Times, serif"
}'::jsonb 
WHERE id = <conference_id>;