import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/e/${params.uid}/qa`);
}

export default function Remote() {
  return null;
}
