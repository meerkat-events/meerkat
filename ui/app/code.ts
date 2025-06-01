import QRCode from "qrcode";

export const generateQRCodeSVG = async (url: string) => {
  const code = await QRCode.toString(url, {
    errorCorrectionLevel: "Q",
    type: "svg",
    margin: 0,
  });

  // Monkey patch to take currentColor for pixels and transparent for background
  return code.replace('<path fill="#ffffff"', '<path fill="none"')
    .replace('<path stroke="#000000"', '<path stroke="currentColor"');
};
