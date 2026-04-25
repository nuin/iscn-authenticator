import { c as curatedData } from "../../../chunks/curated.js";
const load = async () => {
  return {
    signatures: Object.keys(curatedData.signatures)
  };
};
export {
  load
};
