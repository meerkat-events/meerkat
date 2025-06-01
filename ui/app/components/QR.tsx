import { useEffect } from "react";
import { useState } from "react";
import { generateQRCodeSVG } from "../code.ts";

interface QRProps {
  url: URL;
}

const QR = ({
  url,
}: QRProps) => {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    generateQRCodeSVG(url.toString()).then(setSvg);
  }, [url]);

  return (
    <div
      className="qr-code"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default QR;
