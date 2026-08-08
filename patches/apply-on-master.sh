#!/usr/bin/env bash
# ==============================================================================
# apply-on-master.sh
# 将 trae/agent-knU4v4 分支以 R-side 方案合并到 master，生成双父合并 commit。
# 不依赖浅克隆历史，直接复用预先计算并验证过的 FINAL_TREE。
# ==============================================================================
set -euo pipefail

# ---------- 关键参数（本次合并的固定值，由生成器预填） ----------
EXPECTED_MASTER="614dc6c"              # 合并前 master HEAD 的短 SHA
EXPECTED_MASTER_FULL="614dc6cd534bed99264c7024f315dbf82af308da"
OUR_HEAD="5a674df"                     # trae/agent-knU4v4 HEAD (R 侧)
OUR_HEAD_FULL="5a674df585bff9c3f5fe941d1822302494e42ff7"
MERGE_BASE="b144d7a"                   # 共同祖先
FINAL_TREE="4f5c18894a63ac624039158b46ec925c0520afba"   # 合并后的最终 tree (R-side)
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
# 自动定位 git 仓库根（优先 git rev-parse，兼容脚本被移到外部再调用的场景）
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || (cd "$PATCH_DIR/.." && pwd))"
BACKUP_REF="refs/backups/master-before-merge-agent-knU4v4-$(date +%Y%m%d%H%M%S)"

# ---------- 颜色 ----------
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
info()  { printf "  \033[36m·\033[0m %s\n" "$*"; }

cd "$REPO_ROOT"

echo "============================================================"
echo "  Merge: trae/agent-knU4v4 -> master  (R-side resolution)"
echo "============================================================"

# ---------- 1. 前置检查 ----------
echo
yellow "[1/7] 前置检查..."

if [ ! -d ".git" ] && ! git rev-parse --git-dir >/dev/null 2>&1; then
    red "错误: 不在 git 仓库中"
    exit 1
fi

# 工作区已跟踪的文件必须干净（未跟踪文件/目录不影响合并结果，会被保留）
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    red "错误: 当前工作区有未提交的改动，请先 stash / commit / reset"
    echo
    git status --short
    exit 2
fi

# 确认 FINAL_TREE 对象在当前库中可访问
if ! git cat-file -e "$FINAL_TREE^{tree}" 2>/dev/null; then
    red "错误: FINAL_TREE=$FINAL_TREE 不存在于当前 git 对象数据库"
    echo "请先在本仓库中完成补丁生成流程再执行此脚本。"
    exit 3
fi

# ---------- 2. 切换到 master ----------
echo
yellow "[2/7] 切换到 master 分支..."

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")
if [ "$CURRENT_BRANCH" != "master" ]; then
    info "当前分支: $CURRENT_BRANCH ，现在切换到 master..."
    git checkout master
else
    info "已经在 master 分支"
fi

# ---------- 3. 确认 master HEAD 是期望的合并起点 ----------
echo
yellow "[3/7] 校验 master HEAD..."

ACTUAL_MASTER=$(git rev-parse --short=7 HEAD)
ACTUAL_MASTER_FULL=$(git rev-parse HEAD)

if [ "$ACTUAL_MASTER_FULL" != "$EXPECTED_MASTER_FULL" ]; then
    red "错误: 当前 master HEAD = $ACTUAL_MASTER ($ACTUAL_MASTER_FULL)"
    red "      期望 master HEAD = $EXPECTED_MASTER ($EXPECTED_MASTER_FULL)"
    echo
    echo "可能原因："
    echo "  1. master 已经有新提交，建议先 pull，然后重新生成 FINAL_TREE 再合并"
    echo "  2. 本地 master 未同步 origin/master，可先执行: git fetch origin && git reset --hard origin/master"
    exit 4
fi
info "✓ master HEAD = $ACTUAL_MASTER，正确"

# ---------- 4. 备份当前 master 指针（安全回滚点） ----------
echo
yellow "[4/7] 创建 master 备份引用..."

git update-ref "$BACKUP_REF" "$EXPECTED_MASTER_FULL"
info "备份引用: $BACKUP_REF -> $EXPECTED_MASTER"
info "如需回滚: git update-ref refs/heads/master \$(git rev-parse $BACKUP_REF)"

# ---------- 5. 把 FINAL_TREE 写入索引 + 工作区 ----------
echo
yellow "[5/7] 写入合并结果 (FINAL_TREE) 到索引和工作区..."

# 5.1 清空索引，然后读入 FINAL_TREE
git read-tree "$FINAL_TREE"

# 5.2 强制将索引内容同步到工作区（覆盖/新增/删除）
git checkout-index -a -f --prefix=

# 5.3 清理 master 存在但 FINAL_TREE 中不存在的孤儿文件（保持工作区与 tree 严格一致）
# 做法: 列出所有 tracked 文件，删除 FINAL_TREE 中不存在的
git ls-tree -r --name-only "$FINAL_TREE" | sort > /tmp/.final-files.list
git ls-files | sort > /tmp/.index-files.list
TO_REMOVE=$(comm -23 /tmp/.index-files.list /tmp/.final-files.list || true)
if [ -n "$TO_REMOVE" ]; then
    info "清理以下 FINAL_TREE 中不存在的残留文件:"
    echo "$TO_REMOVE" | while read -r f; do
        [ -n "$f" ] || continue
        info "    rm: $f"
        rm -f -- "$f"
        # 同步从索引中移除
        git rm --cached --quiet -- "$f" 2>/dev/null || true
    done
fi
rm -f /tmp/.final-files.list /tmp/.index-files.list

# 5.4 刷新索引并确保无 unmerged / 差异
git update-index --refresh >/dev/null 2>&1 || true
if [ -n "$(git ls-files -u)" ]; then
    red "错误: 写入后索引中仍存在未合并条目！"
    git ls-files -u
    exit 5
fi

ACTUAL_TREE=$(git write-tree)
if [ "$ACTUAL_TREE" != "$FINAL_TREE" ]; then
    red "错误: 写入后的 tree ($ACTUAL_TREE) 与期望 FINAL_TREE ($FINAL_TREE) 不一致！"
    exit 6
fi
info "✓ 索引与工作区已同步到 FINAL_TREE"

# ---------- 6. 创建双父合并 commit + 更新 master ref ----------
echo
yellow "[6/7] 创建双父合并 commit 并更新 master..."

MERGE_MSG=$(cat <<'EOF'
Merge branch 'trae/agent-knU4v4' into master (R-side resolution)

Conflict resolution strategy (all R-side / trae/agent-knU4v4):
  - 产品定位确定为「纯 C 端轻量级代码项目第二大脑」
  - 保留 M1 抽象层（GitProvider / Storage Stores / KB Facade）
  - 插件作为附加能力，in-process 目录加载，无权限体系
  - 以下 10 个真冲突文件全部采用 R 侧版本：
      * app.go
      * docs/rfc/0001-plugin-platform.md
      * handlers_claude.go
      * handlers_config.go
      * handlers_note.go
      * handlers_summary.go
      * internal/db/queries.go
      * wails.json
      * web/src/App.tsx
      * web/src/components/NoteSection.tsx
EOF
)

# 如果 git config 没有 user.name / user.email，使用 fallback，避免 commit-tree 失败
: "${GIT_AUTHOR_NAME:=$(git config user.name 2>/dev/null || echo trae-bot)}"
: "${GIT_AUTHOR_EMAIL:=$(git config user.email 2>/dev/null || echo trae-bot@users.noreply.github.com)}"
: "${GIT_COMMITTER_NAME:=$GIT_AUTHOR_NAME}"
: "${GIT_COMMITTER_EMAIL:=$GIT_AUTHOR_EMAIL}"
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

MERGE_COMMIT=$(git commit-tree "$FINAL_TREE" \
    -p "$EXPECTED_MASTER_FULL" \
    -p "$OUR_HEAD_FULL" \
    -m "$MERGE_MSG")

info "merge commit  = $MERGE_COMMIT"

# 将 refs/heads/master 安全地从 EXPECTED_MASTER_FULL 更新到 MERGE_COMMIT
if ! git update-ref -m "merge trae/agent-knU4v4 (R-side)" refs/heads/master "$MERGE_COMMIT" "$EXPECTED_MASTER_FULL"; then
    red "错误: 更新 master ref 失败（并发变更？），当前 master 已回滚"
    exit 7
fi
info "✓ refs/heads/master -> $MERGE_COMMIT"

# ---------- 7. 结果摘要与校验 ----------
echo
yellow "[7/7] 最终校验..."

# 7.1 工作区无冲突标记
MARKERS=$(grep -rlE '^<<<<<<< |^=======$|^>>>>>>> ' \
    --include='*.go' --include='*.md' --include='*.ts' --include='*.tsx' \
    --include='*.json' --include='*.js' . 2>/dev/null || true)
if [ -n "$MARKERS" ]; then
    red "警告: 仍有冲突标记在以下文件:"
    echo "$MARKERS"
else
    info "✓ 未发现冲突标记残留"
fi

# 7.2 展示合并后的提交图
echo
green "============================================================"
green "  ✓ 合并成功！最终提交："
green "============================================================"
echo
git --no-pager log --oneline --graph --decorate -5

echo
green "--- 冲突文件确认 (SHA 与 R 侧/OUR_HEAD 对比) ---"
CONFLICTS=(app.go docs/rfc/0001-plugin-platform.md handlers_claude.go
    handlers_config.go handlers_note.go handlers_summary.go
    internal/db/queries.go wails.json web/src/App.tsx
    web/src/components/NoteSection.tsx)
for f in "${CONFLICTS[@]}"; do
    A=$(git rev-parse "HEAD:$f" 2>/dev/null || echo "MISSING")
    B=$(git rev-parse "$OUR_HEAD_FULL:$f" 2>/dev/null || echo "MISSING")
    if [ "$A" = "$B" ]; then
        info "✓ $f  ==  R 侧"
    else
        red "✗ $f  !=  R 侧  (HEAD=$A, OUR=$B)"
    fi
done

echo
echo "后续步骤:"
echo "  1. 本地验证 Go 构建:  cd $REPO_ROOT && go vet ./... && go build ./..."
echo "  2. 推送到远程:        git push origin master"
echo "  3. 如需回滚:          git update-ref refs/heads/master \$(git rev-parse $BACKUP_REF)"
echo
