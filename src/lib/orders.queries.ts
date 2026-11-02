import { queryOptions } from "@tanstack/react-query";
import { getClientHistory, getOrder, getOrderFormData, listOrders } from "./orders.functions";
export const ordersQuery = queryOptions({ queryKey: ["orders"], queryFn: () => listOrders() });
export const orderFormQuery = queryOptions({ queryKey: ["order-form"], queryFn: () => getOrderFormData() });
export const orderQuery = (id: string) => queryOptions({ queryKey: ["order", id], queryFn: () => getOrder({ data: { id } }) });
export const clientHistoryQuery = (id: string) => queryOptions({ queryKey: ["client-history", id], queryFn: () => getClientHistory({ data: { id } }) });
