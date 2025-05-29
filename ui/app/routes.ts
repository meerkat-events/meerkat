import {
  index,
  layout,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  index("routes/Home.tsx"),
  layout("layouts/page.tsx", [
    route("/e/:uid", "routes/Event.tsx"),
  ]),
  layout("layouts/app.tsx", [
    route("/e/:uid/remote", "routes/Remote.tsx"),
    route("/e/:uid/qa", "routes/QnA.tsx"),
    route("/e/:uid/card", "routes/EventCard.tsx"),
    route("/e/:uid/feedback", "routes/Feedback.tsx"),
    route("/login", "routes/Login.tsx"),
    route("/speaker", "routes/Speaker.tsx"),
  ]),
] satisfies RouteConfig;
