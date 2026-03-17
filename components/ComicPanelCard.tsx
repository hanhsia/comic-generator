import type { ComicPanel } from '@/lib/types';

function FallbackVisual({ panel }: { panel: ComicPanel }) {
  return (
    <div className="panel-image">
      <div>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎨</div>
        <strong>预览占位图</strong>
        <p style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
          {panel.imageStatus === 'fallback'
            ? '图片未成功生成，下面保留了本格提示词。'
            : '等待图片生成结果。'}
        </p>
      </div>
    </div>
  );
}

export function ComicPanelCard({ panel }: { panel: ComicPanel }) {
  return (
    <article className="panel-card">
      {panel.imageUrl ? (
        <div className="panel-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={panel.imageUrl} alt={panel.title} />
        </div>
      ) : (
        <FallbackVisual panel={panel} />
      )}

      <div className="panel-body">
        <div className="panel-heading-row">
          <span className="panel-badge">第 {panel.index} 格</span>
          <span className="panel-subtle-id">{panel.id}</span>
        </div>
        <h3 className="panel-title">{panel.title}</h3>
        <p className="panel-copy">{panel.caption}</p>

        {panel.dialogue ? (
          <div className="prompt-block">
            <strong>对白</strong>
            <p className="prompt-copy">{panel.dialogue}</p>
          </div>
        ) : null}

        <div className="prompt-block">
          <strong>画面提示词</strong>
          <p className="prompt-copy">{panel.imagePrompt}</p>
        </div>

        <div className="prompt-block prompt-meta-block">
          <strong>重绘元数据</strong>
          <p className="prompt-copy">镜头：{panel.metadata.shotType}</p>
          <p className="prompt-copy">画面摘要：{panel.metadata.visualSummary}</p>
          <p className="prompt-copy">重绘提示：{panel.metadata.rerunHint}</p>
        </div>

        {panel.imageError ? <p className="footer-note">图片回退原因：{panel.imageError}</p> : null}
      </div>
    </article>
  );
}
