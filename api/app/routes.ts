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
    route("/login", "routes/Login.tsx"),
    route("/account", "routes/Account.tsx"),
    route("/e/:uid/qa", "routes/QnA.tsx"),
    layout("layouts/manage.tsx", [
      route("/manage", "routes/manage/Feed.tsx"),
      route("/manage/schedule", "routes/manage/Schedule.tsx"),
      route("/manage/analytics", "routes/manage/Analytics.tsx"),
      route("/manage/permissions", "routes/manage/Permissions.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
