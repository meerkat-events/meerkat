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
    route("/stage/:stage", "routes/Stage.tsx"),
  ]),
  layout("layouts/app.tsx", [
    route("/login", "routes/Login.tsx"),
    route("/account", "routes/Account.tsx"),
    route("/legal", "routes/Legal.tsx"),
    route("/e/:uid/qa", "routes/QnA.tsx"),
    layout("layouts/manage.tsx", [
      route("/manage", "routes/manage/Feed.tsx"),
      route("/manage/schedule", "routes/manage/Schedule.tsx"),
      route("/manage/analytics", "routes/manage/Analytics.tsx"),
      route("/manage/moderation", "routes/manage/Moderation.tsx"),
      route("/manage/permissions", "routes/manage/Permissions.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
