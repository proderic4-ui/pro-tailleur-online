import { queryOptions } from "@tanstack/react-query";
import { getMyWorkshop } from "./workshop.functions";

export const workshopQuery = queryOptions({
  queryKey: ["my-workshop"],
  queryFn: () => getMyWorkshop(),
  refetchInterval: 60_000,
});