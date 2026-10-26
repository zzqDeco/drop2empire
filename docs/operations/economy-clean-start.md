# 新经济清档重开与验收

这是已决定清档重开的不兼容版本。清档范围包括旧账号、进度、库存、订单、股份和旧会话；旧数据库保留作为整体回滚点，不把旧数据复制进新经济。唯一长期部署环境为 production，本地 PostgreSQL 仅用于一次性测试。

## 发布前与切换

1. 精确 PR 提交通过架构、Go race/vet/build、PostgreSQL、前端与三份仿真重放检查后合并；确认合并提交 CI，通过不可变版本归档 `release/v1.1.0` 和 `v1.1.0`。发布客户端与后端同一个 SHA。
2. 查询线上后端 `/version` 的完整 SHA，作为 `EXPECTED_PREVIOUS_SHA`。使用干净的合并提交工作区执行：

```sh
VERSION=v1.1.0 \
CLEAN_START_DATABASE=d2e_restart_20261026_v110 \
EXPECTED_PREVIOUS_SHA=<已核验的旧版完整SHA> \
bash ops/deploy-aliyun.sh
```

3. 脚本先构建新镜像，核验旧 SHA 和新库名称未被使用，再停止 D2E 前后端写入。备份旧库为 `pg_dump -Fc`，校验目录可读；备份配置、镜像 ID 和旧 release 路径到 `/srv/drop2empire/backups/<UTC时间>-<新短SHA>/`，目录权限 0700、数据库与配置 0600。不会删除旧库或操作其他应用。
4. 创建独立空库，修改本机 `production.env` 的 `POSTGRES_DB`，启动同 SHA 的新前后端。空库必须有 16–64 位 `D2E_ADMIN_PASSWORD`；部署脚本在配置缺失时在服务器生成随机值，绝不打印或写进 Git。只创建管理员，不创建示例玩家、进度、公司、行情或金币。已有管理员重启不改密码。
5. 自动检查前后端 SHA、readiness、公网管理路由 403、SSH 管理入口 200 后才更新 `/srv/drop2empire/current`。切换中发生错误会恢复旧配置、旧镜像及旧库连接；失败的新库保留调查，不覆盖重试。
6. 通过 SSH 隧道进入管理台，核验发行/国库/公共账户均零、公司为空；签发单次邀请码。正常启动已有管理员，公共 bootstrap 码不能再注册玩家；管理员不能从公网登录。

## 首批受控公共采购

清档验收后按以下一次性试运行参数签发政策，使用固定政策 ID `s1-v110-issue-001`、`s1-v110-fund-001`、`s1-v110-buy-<资源>-001`，重试同 ID 不重复记账。此处是策划明确采用的有限启动方案，不能按注册人数自动扩张或在预算耗尽时自动补发。

- 发行 8,000 Gold 到联盟准备金，拨 8,000 Gold 给公共采购；玩家注册、职业选择均为零金币。
- 限价采购水 8,000 ×0.1、木材 4,000 ×0.45、石材 2,000 ×0.95、木炭 1,000 ×1.2、铁锭 500 ×3.2、燧石 250 ×2.8 Gold，总承诺 8,000 Gold。
- 只能与真实玩家卖单撮合，卖方每笔扣 1% 交易税进入国库。公共实物库存保留；销毁、撤单、收回预算或追加发行必须另有政策记录。
- 仿真以四个活跃操作者验证了这一预算。开放后观察实际参与人数、公共成交消耗、库存和现金集中度，再决定下一笔政策。该额度不是永续回购承诺。
- 初始不创建公司。先确认四职业制造和真实市场深度，再按合金/晶材 → 机造/控制 → 工务/精工分批引入。仿真的 1,000 股 ×0.5 Gold、500 Gold 周转金是一组验证参数；实际 IPO 需策划核对可投资余额、上游库存及普通玩家剩余购买力后签发，不自动上市。

## 验收边界

生产先验证旧会话失效、空库无示例账号、邀请注册和零资源开局、真实打水招募、公网隔离、政策审计与完整货币恒等式。由新玩家自然推进中期；不能用管理加速或注入资源来声称生产中期已验收。

本地一次性夹具可验收制造材料、批数、实际扣料、队列、跨职业使用、IPO 与投票界面，但必须标明夹具。`-launch` 用真实聚落生产推进 12 小时，覆盖四职业、跨职业实际成交、IPO 及二级设施的公司包消费；它不是生产运行 12 小时的证据。

内容赛季保留货币、公司、股份、IPO 与投票，仅重置个人生产/远征进度，先撤玩家订单再处理季节性实物。单账号重置拒绝有效股份、认购或投票头寸。内容赛季按钮不能用于此次旧经济切换。

## 回滚

自动回滚只覆盖切换失败且尚未开放的窗口。开放真实交易后，应先停服、保存新库快照和审计，确认恢复范围，再整体恢复旧库与旧镜像；这会撤销清档以来的新进度。不要混用新旧账本。

在生产主机指定部署输出的备份目录后执行下列恢复步骤；`ROLLBACK_DIR` 必须选本次发布记录，不猜路径：

```sh
ROLLBACK_DIR=/srv/drop2empire/backups/<本次发布记录目录>
PREVIOUS_DIR=$(cat "$ROLLBACK_DIR/previous-release")
docker stop drop2empire-web-1 drop2empire-game-1
# 开放交易后的回滚，先额外 pg_dump 当前新库并保存审计。
cp -p "$ROLLBACK_DIR/production.env" /srv/drop2empire/config/production.env
docker compose -p drop2empire --project-directory "$PREVIOUS_DIR/deploy" \
  --env-file /srv/drop2empire/config/production.env --env-file "$PREVIOUS_DIR/images.env" \
  -f "$PREVIOUS_DIR/deploy/compose.production.yaml" up -d --remove-orphans
ln -sfn "$PREVIOUS_DIR" /srv/drop2empire/current
```

恢复后重新核验镜像 ID、前后端 SHA、健康状态及旧账号数据。旧库若损坏，应先在另一个新数据库执行备份恢复验证，不能直接覆盖唯一备份或原库。永久 release 分支与标签禁止删除或重写。

## 可复现验证

```sh
make gen
# 生成结果暂存后运行，避免未暂存生成文件被误判为漂移
make check-arch
DATABASE_URL_TEST=<一次性本地PostgreSQL数据库> make test
make simulate-economy
(cd services/game && go run ./cmd/economy-sim -consumables)
(cd services/game && go run ./cmd/economy-sim -launch)
```

仿真只运行领域引擎，无数据库/网络配置。CI 重跑并逐字节比较三个固定报告。回归覆盖职业不送礼包、实际制造成本/额度、仓容与缺铁提示、有限需求与停产、事件 ID 和多弹窗确认、四位盘口精度、空库管理员引导、邀请单次使用、数据库事务和旧经济拒绝；既有夜班燃料测试继续运行。
