import QRCode from "qrcode";

export const generateQRCodePNG = async (url: string, width: number) => {
  const dataUrl = await QRCode.toDataURL(url, {
    width,
    margin: 1,
    color: {
      dark: "#36364c",
    },
  });
  const [, base64Data] = dataUrl.split(",");
  const imageBytes = Uint8Array.from(
    atob(base64Data),
    (c) => c.charCodeAt(0),
  );
  return imageBytes;
};
