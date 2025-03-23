import { qrcode } from "@libs/qrcode";
import QRCode from "qrcode";

export const generateQRCodeSVG = (url: string) => {
  const svg = qrcode(url, { output: "svg", border: 0 }).replace(
    '<rect width="100%" height="100%" fill="white"/>',
    '<rect width="100%" height="100%" fill="none"/>',
  ).replace(
    'version="1.1"',
    'style="width: 100%; height: 100%;" version="1.1"',
  );
  return svg;
};

export const generateQRCodePNG = async (url: string) => {
  const dataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 0,
    color: {
      // Aubergine 2
      dark: "#342749",
    },
  });
  const [, base64Data] = dataUrl.split(",");
  const imageBytes = Uint8Array.from(
    atob(base64Data),
    (c) => c.charCodeAt(0),
  );
  return imageBytes;
};
