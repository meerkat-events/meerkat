/** @jsxImportSource @hono/hono/jsx */
import type { FC } from "@hono/hono/jsx";

const Document: FC<{ title?: string; children: any }> = (
  { children, title },
) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/index.css" />
        <title>{title ?? "Meerkat - engaging conferences"}</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
};

export default Document;
