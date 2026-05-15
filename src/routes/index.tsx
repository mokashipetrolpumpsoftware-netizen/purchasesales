import { createFileRoute, Link, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/login" }); },
  component: () => <Link to="/login">Go to Login</Link>,
});
