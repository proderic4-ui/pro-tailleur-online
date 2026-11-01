import { queryOptions } from "@tanstack/react-query";
import { getClient, listClients } from "./clients.functions";
export const clientsQuery = queryOptions({ queryKey: ["clients"], queryFn: () => listClients() });
export const clientQuery = (id: string) => queryOptions({ queryKey: ["client", id], queryFn: () => getClient({ data: { id } }) });