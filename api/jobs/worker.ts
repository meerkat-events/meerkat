const worker = new Worker(
  new URL("./devconnect/job.ts", import.meta.url).href,
  {
    type: "module",
  },
);

worker.onmessage = (e) => {
  console.log("Worker message:", e.data);

  if (e.data?.type === "done") {
    console.log("Worker completed, terminating...");
    worker.terminate();
    Deno.exit(0);
  }
};

worker.onerror = (e) => {
  console.error("Worker error:", e.message);
  worker.terminate();
  Deno.exit(1);
};

console.log("Worker started");
