export const podTypePrefix = globalThis.location.hostname.split(".").reverse()
  .join(".");

export const attendancePodType = `${podTypePrefix}/attendance`;
export const feedbackPodType = `${podTypePrefix}/feedback`;
export const summaryPodType = `${podTypePrefix}/summary`;
