import { c as curatedData } from "../../../../chunks/curated.js";
import { error } from "@sveltejs/kit";
const load = async ({ params }) => {
  const signature = params.signature;
  const entry = curatedData.signatures[signature];
  if (!entry) {
    throw error(404, "Not Found");
  }
  return {
    signature,
    entry
  };
};
export {
  load
};
