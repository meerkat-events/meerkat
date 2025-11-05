import { layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  layout("layouts/page.tsx", [
    route("/e/:uid", "routes/Event.tsx"),
    route("/c/:conferenceId", "routes/Conference.tsx"),
  ]),
  layout("layouts/app.tsx", [
    route("/e/:uid/qa", "routes/QnA.tsx"),
    route("/e/:uid/card", "routes/EventCard.tsx"),
    route("/e/:uid/feedback", "routes/Feedback.tsx"),
  ]),
] satisfies RouteConfig;
