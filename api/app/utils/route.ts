export const parseUid = (url: URL, regex: RegExp) => {
  const match = regex.exec(url.pathname);
  return match?.groups?.uid;
};
