import { uuidv7 } from "uuidv7";
// Check if cookie exists
function getCookie(name: string) {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split("=");
    if (cookieName.trim() === name) {
      return cookieValue;
    }
  }
  return null;
}

const cookieName = "deviceId";
// Set cookie if it doesn't exist
if (!getCookie(cookieName)) {
  document.cookie = `deviceId=${uuidv7()}; expires=${
    new Date(Date.now() + 86400000).toUTCString()
  }; path=/`;
}
