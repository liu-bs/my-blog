/**
 * @file index.ts
 * @description 客户端（frontend）专属共享类型的统一出口：表单状态、目录项、请求错误、页面级 Props。
 * @warning 这里是「服务端渲染时序列化后交给客户端」的数据契约，与 server 侧实体不同，增删字段需同时确认两侧
 */
export * from "./forms";
export * from "./toc";
export * from "./request";
export * from "./pages";
