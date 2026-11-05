import { useEffect } from "react";
import { useState } from "react";
import { generateQRCodeSVG } from "../code.ts";

interface QRProps {
  url: string;
}

const QR = ({
  url,
}: QRProps) => {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    // A slower call for the previous url must not overwrite this one's code.
    let current = true;
    generateQRCodeSVG(url).then((code) => {
      if (current) setSvg(code);
    });
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <div
      className="qr-code"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default QR;
