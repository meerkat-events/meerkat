import { Image, type ImageProps } from "@chakra-ui/react";

type LogoProps = Omit<ImageProps, "src" | "alt">;

// The wordmark ships in two colorways: lavender for dark themes and
// near-black for light themes (e.g. Devconnect). Render both and let the
// active color mode hide the one that doesn't fit.
export function Logo(props: LogoProps) {
  return (
    <>
      <Image
        src="/logo-on-dark.svg"
        alt="Meerkat"
        _light={{ display: "none" }}
        {...props}
      />
      <Image
        src="/logo-on-light.svg"
        alt="Meerkat"
        _dark={{ display: "none" }}
        {...props}
      />
    </>
  );
}
