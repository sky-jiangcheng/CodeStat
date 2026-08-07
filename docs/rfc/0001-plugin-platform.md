# RFC 0001: 插件平台

> **⚠️ Superseded by [ADR 0002](../adr/0002-c-end-repositioning.md)**
> 本 RFC 中的 M2（常驻 HTTP Server / RBAC / AK-SK）、M3（插件协议网关 + scope 权限）、M4（PG/ES / K8s / gitbuddy-server）均已废弃。
> M1 抽象层保留，作为附加插件扩展接口的底层支撑。

- 状态：Superseded by ADR 0002
- 日期：2026-08-07

## 概述

最初设想将产品打造为可插拔的代码统计与仓库分析平台，支持第三方插件通过外部协议接入，并面向多用户 / 服务端部署场景。

## 里程碑规划

### M1：本地抽象层

建立 `storage.Stores`、`ScanTxer`、KB Facade 等本地抽象，作为后续插件扩展接口的底层支撑。该层保留。

### M2：常驻 HTTP Server / RBAC / AK-SK

提供常驻 HTTP 服务、基于角色的访问控制（RBAC）以及 AK/SK 凭证体系，支撑远程访问与多用户鉴权。**已废弃。**

### M3：插件协议网关 + scope 权限

设计对外插件协议网关，插件通过网络协议接入，并通过 scope 权限控制访问范围。**已废弃。**

### M4：PG/ES / K8s / gitbuddy-server

将存储迁移至 PostgreSQL / Elasticsearch，支持 Kubernetes 部署与独立服务端组件。**已废弃。**

## 结论

产品定位转向 C 端「代码项目第二大脑」（见 ADR 0002）。插件机制改为进程内加载（in-process plugin），保留 M1 抽象层作为扩展支撑。
