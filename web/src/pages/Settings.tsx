import { useState, useEffect, useRef } from 'react'
import { getConfig, updateConfig, updateScanRoots, triggerScan, importClaudeMemory,
  getPluginStatuses, getKnowledgeSources, triggerKnowledgeImport, reloadPlugins,
  type PluginStatus, type SourceStatus } from '../api/client'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '../utils/theme'
import { usePageMeta } from '../utils/seo'
import { useInstallPrompt } from '../utils/install'

interface ConfigData {
  config: Record<string, string>
  scan_roots: string[]
}

type TabKey = 'scan' | 'standards' | 'authors' | 'appearance' | 'actions' | 'plugins'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'scan', label: '扫描目录' },
  { key: 'standards', label: '代码标准' },
  { key: 'authors', label: '作者配置' },
  { key: 'appearance', label: '外观' },
  { key: 'plugins', label: '插件' },
  { key: 'actions', label: '操作' },
]

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'light', label: '浅色', description: '始终使用浅色主题' },
  { value: 'dark', label: '深色', description: '始终使用深色主题' },
  { value: 'system', label: '跟随系统', description: '自动匹配系统外观设置' },
]

function Settings() {
  usePageMeta({ title: '设置 - GitBuddy', description: 'GitBuddy 设置：扫描目录、代码标准、作者配置、外观、插件与操作。', path: '/settings' })
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newRoot, setNewRoot] = useState('')
  const [codeStandard, setCodeStandard] = useState('500')
  const [scanDepth, setScanDepth] = useState('2')
  const [authorName, setAuthorName] = useState('')
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [tab, setTab] = useState<TabKey>('scan')
  const [plugins, setPlugins] = useState<PluginStatus[]>([])
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [importingSource, setImportingSource] = useState<string>('')
  const [autoImport, setAutoImport] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showMessage = (msg: string) => {
    setMessage(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(''), 3000)
  }

  useEffect(() => {
    setThemeMode(getStoredTheme())
    getConfig()
      .then((d) => {
        setData(d)
        setCodeStandard(d.config.daily_code_standard || '500')
        setScanDepth(d.config.scan_depth || '2')
        setAuthorName(d.config.git_author || '')
        setAutoImport(d.config.auto_import !== '0')
      })
      .finally(() => setLoading(false))
    refreshPluginState()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const refreshPluginState = async () => {
    const [p, s] = await Promise.all([getPluginStatuses(), getKnowledgeSources()])
    setPlugins(p)
    setSources(s)
  }

  const handleReloadPlugins = async () => {
    setSaving(true)
    try {
      const p = await reloadPlugins()
      setPlugins(p)
      const s = await getKnowledgeSources()
      setSources(s)
      showMessage('插件已重新加载')
    } catch (e: unknown) {
      showMessage('插件重载失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const handleImportSource = async (name: string) => {
    setImportingSource(name)
    try {
      const r = await triggerKnowledgeImport(name)
      showMessage(`导入完成：新增 ${r.created}，更新 ${r.updated}，跳过 ${r.skipped}`)
    } catch (e: unknown) {
      showMessage('导入失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setImportingSource('')
    }
  }

  const handleAutoImportToggle = async (on: boolean) => {
    setSaving(true)
    try {
      await updateConfig('auto_import', on ? '1' : '0')
      setAutoImport(on)
      showMessage(on ? '已开启启动时自动导入' : '已关闭启动时自动导入')
    } catch (e: unknown) {
      showMessage('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveConfig = async () => {
    const num = parseInt(codeStandard, 10)
    if (isNaN(num) || num < 100 || num > 10000) {
      showMessage('每日目标行数应在 100-10000 之间')
      return
    }
    const depth = parseInt(scanDepth, 10)
    if (isNaN(depth) || depth < 1 || depth > 2) {
      showMessage('扫描深度应在 1-2 之间')
      return
    }
    setSaving(true)
    try {
      await updateConfig('daily_code_standard', String(num))
      await updateConfig('scan_depth', String(depth))
      showMessage('配置已保存')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '保存失败'
      showMessage('保存失败: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAuthor = async () => {
    const trimmed = authorName.trim()
    if (!trimmed) {
      showMessage('请输入 Git 作者名称')
      return
    }
    setSaving(true)
    try {
      await updateConfig('git_author', trimmed)
      showMessage('作者配置已保存')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '保存失败'
      showMessage('保存失败: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const handleAddRoot = async () => {
    if (!newRoot.trim() || !data) return
    setSaving(true)
    try {
      const updated = [...data.scan_roots, newRoot.trim()]
      await updateScanRoots(updated)
      setData({ ...data, scan_roots: updated })
      setNewRoot('')
      showMessage('扫描目录已添加')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '添加失败'
      showMessage('添加失败: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveRoot = async (path: string) => {
    if (!data) return
    setSaving(true)
    try {
      const updated = data.scan_roots.filter((r) => r !== path)
      await updateScanRoots(updated)
      setData({ ...data, scan_roots: updated })
      showMessage('扫描目录已移除')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '移除失败'
      showMessage('移除失败: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const handleRescan = async () => {
    setSaving(true)
    try {
      await triggerScan()
      showMessage('重新扫描完成')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '扫描失败'
      showMessage('扫描失败: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const r = await importClaudeMemory()
      showMessage(`导入完成：新增 ${r.synced}，更新 ${r.updated}，跳过 ${r.skipped}`)
    } catch (e: unknown) {
      showMessage('导入失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setImporting(false)
    }
  }

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    storeTheme(mode)
    applyTheme(mode)
    showMessage('外观已更新')
  }

  if (loading) {
    return (
      <div className="settings">
        <h1>设置</h1>
        <div className="skeleton skeleton-text" style={{width: '100%', height: 24, marginBottom: 12}} />
        <div className="skeleton skeleton-text" style={{width: '100%', height: 64, marginBottom: 8}} />
        <div className="skeleton skeleton-text" style={{width: '100%', height: 64, marginBottom: 8}} />
      </div>
    )
  }

  return (
    <div className="settings">
      <h1>设置</h1>

      {message && <div className="message-banner">{message}</div>}

      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <div className="settings-section">
          <h2>扫描根目录</h2>
          <div className="form-group">
            <label>添加新目录：</label>
            <div className="input-row">
              <input
                type="text"
                value={newRoot}
                onChange={(e) => setNewRoot(e.target.value)}
                placeholder="/Users/you/Projects"
                className="form-input"
              />
              <button className="btn btn-primary" onClick={handleAddRoot} disabled={saving}>
                添加
              </button>
            </div>
          </div>
          <ul className="root-list">
            {data?.scan_roots.map((root) => (
              <li key={root} className="root-item">
                <span className="root-path">{root}</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleRemoveRoot(root)}
                  disabled={saving}
                >
                  移除
                </button>
              </li>
            ))}
            {(!data?.scan_roots || data.scan_roots.length === 0) && (
              <li className="root-item empty">暂无扫描目录，请添加</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'standards' && (
        <div className="settings-section">
          <h2>代码量标准</h2>
          <div className="form-group">
            <label>工作日每日目标行数：</label>
            <input
              type="number"
              value={codeStandard}
              onChange={(e) => setCodeStandard(e.target.value)}
              className="form-input"
              min={100}
              max={10000}
            />
            <span className="form-hint">范围: 100-10000</span>
          </div>
          <div className="form-group">
            <label>最大扫描深度：</label>
            <input
              type="number"
              value={scanDepth}
              onChange={(e) => setScanDepth(e.target.value)}
              className="form-input"
              min={1}
              max={2}
            />
            <span className="form-hint">范围: 1-2</span>
          </div>
          <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
            保存配置
          </button>
        </div>
      )}

      {tab === 'authors' && (
        <div className="settings-section">
          <h2>Git 作者配置</h2>
          <p className="section-desc">配置用于统计个人代码量的 Git 作者名称。</p>
          <div className="form-group">
            <label>作者名称：</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="John Doe"
              className="form-input"
            />
            <span className="form-hint">与 git log --author 过滤的名称一致</span>
          </div>
          <button className="btn btn-primary" onClick={handleSaveAuthor} disabled={saving}>
            保存作者
          </button>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="settings-section">
          <h2>外观</h2>
          <p className="section-desc">选择你喜欢的界面主题风格。</p>
          <div className="theme-options">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`theme-option ${themeMode === opt.value ? 'theme-option-active' : ''}`}
                onClick={() => handleThemeChange(opt.value)}
              >
                <div className="theme-preview" data-preview={opt.value} />
                <div className="theme-info">
                  <span className="theme-label">{opt.label}</span>
                  <span className="theme-desc">{opt.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'plugins' && (
        <div className="settings-section">
          <p className="section-desc">
            插件是放置在配置目录 <code>plugins/</code> 下的 Go 脚本，启动时自动加载。
            每个插件目录包含一个 <code>plugin.go</code>，导出 <code>Name</code> 与 <code>Init</code>。
          </p>

          <div className="form-group">
            <label>启动时自动导入知识源</label>
            <div className="toggle-row">
              <button
                className={`toggle ${autoImport ? 'toggle-on' : ''}`}
                onClick={() => handleAutoImportToggle(!autoImport)}
                disabled={saving}
                aria-pressed={autoImport}
              >
                <span className="toggle-knob" />
              </button>
              <span className="form-hint" style={{ marginTop: 0 }}>
                {autoImport ? '应用启动时自动导入所有知识源' : '仅在手动点击时导入'}
              </span>
            </div>
          </div>

          <div className="section-header-row">
            <h2 style={{ margin: 0 }}>已加载插件</h2>
            <button className="btn btn-secondary btn-sm" onClick={handleReloadPlugins} disabled={saving}>
              重新加载
            </button>
          </div>

          {plugins.length === 0 ? (
            <div className="empty-hint">暂无插件。可将插件目录放入配置目录的 plugins/ 下后点击「重新加载」。</div>
          ) : (
            <ul className="plugin-list">
              {plugins.map((p) => (
                <li key={p.path} className={`plugin-item ${p.loaded ? 'plugin-ok' : 'plugin-err'}`}>
                  <div className="plugin-info">
                    <span className="plugin-name">{p.name || '(未命名)'}</span>
                    <span className="plugin-path">{p.path}</span>
                  </div>
                  <span className={`plugin-badge ${p.loaded ? 'badge-ok' : 'badge-err'}`}>
                    {p.loaded ? '已加载' : '加载失败'}
                  </span>
                  {p.error && <div className="plugin-error">{p.error}</div>}
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginTop: 24 }}>知识导入源</h2>
          {sources.length === 0 ? (
            <div className="empty-hint">暂无知识导入源。</div>
          ) : (
            <ul className="plugin-list">
              {sources.map((s) => (
                <li key={s.name} className="plugin-item plugin-ok">
                  <div className="plugin-info">
                    <span className="plugin-name">{s.name}</span>
                    <span className="plugin-path">来自 {s.plugin || 'builtin'}</span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleImportSource(s.name)}
                    disabled={importingSource !== '' || !s.enabled}
                  >
                    {importingSource === s.name ? '导入中…' : '立即导入'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'actions' && (
        <div className="settings-section">
          <h2>操作</h2>
          <p className="section-desc">手动触发全量重新扫描，刷新所有仓库的统计数据。</p>
          <div className="action-row">
            <button className="btn btn-primary" onClick={handleRescan} disabled={saving}>
              立即重新扫描所有项目
            </button>
          </div>

          <h2 style={{ marginTop: 24 }}>导入 Claude 记忆</h2>
          <p className="section-desc">
            将 <code>~/.claude/projects/*/memory/*.md</code> 中的笔记按项目匹配导入为知识笔记。
            重复导入会更新已有笔记而非重复创建。
          </p>
          <div className="action-row">
            <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? '导入中…' : '导入 Claude 记忆'}
            </button>
            <a href="/#/knowledge" className="btn btn-secondary">前往知识库查看</a>
          </div>

          <h2 style={{ marginTop: 24 }}>安装到桌面</h2>
          <p className="section-desc">
            GitBuddy 可作为 PWA 安装到桌面 / 主屏幕，获得独立窗口与离线支持。
            {installed ? '当前已处于安装模式。' : canInstall ? '您的浏览器支持安装。' : '请使用支持 PWA 安装的浏览器（Chrome / Edge）。'}
          </p>
          {canInstall && (
            <div className="action-row">
              <button className="btn btn-primary" onClick={() => void promptInstall()}>
                安装 GitBuddy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Settings
