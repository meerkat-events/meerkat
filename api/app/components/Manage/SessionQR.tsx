import { useState } from "react";
import { Button, NativeSelect, SegmentGroup } from "@chakra-ui/react";
import type { Session } from "../../hooks/use-conference-events.ts";
import { generateQRCodeSVG } from "../../code.ts";
import QR from "../QR.tsx";
import { qaUrl, stageQaUrl } from "./session-urls.ts";
import { useUrlChoice } from "./use-url-choice.ts";

/** The QR code tab: a code for the session or for its whole stage, to download or copy. */
export function QRBlock(
  { session, onCopy }: {
    session: Session;
    onCopy: (text: string, title: string) => void;
  },
) {
  const [target, setTarget] = useUrlChoice("qr", ["session", "stage"] as const, "session");
  const [size, setSize] = useState("1024");
  const url = target === "stage" ? stageQaUrl(session) : qaUrl(session);
  const fileName = target === "stage"
    ? `meerkat-${session.stage}-qr.png`
    : `meerkat-${session.uid}-qr.png`;

  return (
    <div className="m-qr">
      <SegmentGroup.Root
        size="sm"
        value={target}
        onValueChange={(e) => setTarget(e.value === "stage" ? "stage" : "session")}
        aria-label="QR code opens"
      >
        <SegmentGroup.Indicator />
        <SegmentGroup.Items
          items={[
            { value: "session", label: "This session" },
            { value: "stage", label: "Whole stage" },
          ]}
        />
      </SegmentGroup.Root>
      <QR url={url.toString()} />
      <p className="m-hint" style={{ margin: 0, textAlign: "center", maxWidth: "32ch" }}>
        {target === "stage"
          ? `Always opens whatever is live on ${session.stage}. Print it once for the room.`
          : "Opens this session's Q&A."}
      </p>
      <div className="url">{url.host}{url.pathname}</div>
      <div className="m-toolbar">
        <NativeSelect.Root size="xs" width="auto">
          <NativeSelect.Field
            aria-label="Image size"
            value={size}
            onChange={(ev) => setSize(ev.currentTarget.value)}
          >
            <option value="512">512 px</option>
            <option value="1024">1024 px</option>
            <option value="2048">2048 px</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Button
          size="xs"
          colorPalette="brand"
          onClick={() => downloadQRCode(url.toString(), Number(size), fileName)}
        >
          Download PNG
        </Button>
        <Button size="xs" variant="outline" onClick={() => onCopy(url.toString(), "Link copied")}>
          Copy link
        </Button>
      </div>
    </div>
  );
}

/**
 * Draws the session's QR code to a PNG in the browser and downloads it. White
 * background and #36364c modules, the colors of the QR codes printed so far:
 * keep them, so new downloads match the printed ones.
 */
async function downloadQRCode(url: string, size: number, fileName: string) {
  const svg = (await generateQRCodeSVG(url))
    .replace('fill="none"', 'fill="#ffffff"')
    .replace('stroke="currentColor"', 'stroke="#36364c"');
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const margin = Math.round(size * 0.04);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, margin, margin, size - margin * 2, size - margin * 2);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  link.click();
}
