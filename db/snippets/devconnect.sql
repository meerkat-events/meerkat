UPDATE conferences
SET theme = '{
  "textColor": "#36364c",
  "background": "linear-gradient(360deg, #F6B61326 0%, #FF85A626 17%, #9894FF26 35%, #74ACDF26 64%, #F2F9FF26 100%)",
  "brandColor": "#74acdf",
  "systemTheme": "light",
  "contrastColor": "#FFFFFF",
  "bodyFontFamily": "Roboto",
  "headingFontFamily": "Roboto Condensed"
}'::jsonb
WHERE name = 'Devconnect ARG';